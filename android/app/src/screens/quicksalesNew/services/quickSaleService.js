import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

// Función para obtener el número de venta consecutivo
async function getNextSaleNumber() {
  const ref = firestore().collection("counters").doc("sales");
  return await firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = (snap.data()?.lastNumber || 0) + 1;
    tx.set(ref, { lastNumber: next }, { merge: true });
    return String(next).padStart(6, "0");
  });
}

// Suma la cantidad requerida por producto a través de TODO el carrito (items
// normales + bonos): un mismo producto puede aparecer en ambas líneas cuando la
// bonificación es del propio producto comprado, y el stock se valida/descuenta
// una sola vez por producto con el total real que va a consumir.
function sumQuantitiesByProduct(cart) {
  const totals = {};
  cart.forEach((item) => {
    const productId = item.product.id || item.id;
    const qty = Number(item.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error(`Cantidad inválida para ${item.product?.name || productId}.`);
    }
    totals[productId] = (totals[productId] || 0) + qty;
  });
  return totals;
}

// Función para registrar la venta completa, ahora con lógica de bonificaciones
export async function registerQuickSaleFull({
  cart = [],
  subtotal = 0,
  total = 0,
  tip = 0,
  paymentMethod,
  amountPaid,
  change,
  transferNumber = "",
  customer = null,
}) {
  if (!cart.length) throw new Error("El carrito está vacío.");

  const user = auth().currentUser;
  const receiptNumber = await getNextSaleNumber();
  const saleRef = firestore().collection("sales").doc();

  const normalItems = cart.filter(item => !item.isBonus);
  const bonusItems = cart.filter(item => item.isBonus);
  const neededByProduct = sumQuantitiesByProduct(cart);
  const productIds = Object.keys(neededByProduct);

  await firestore().runTransaction(async (tx) => {
    // 1) Leer TODOS los productos involucrados antes de escribir nada (regla de
    // Firestore: todas las lecturas de una transacción van antes que cualquier write).
    const productRefs = productIds.map((id) => firestore().collection('products').doc(id));
    const productSnaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));

    const productsData = {};
    const stockByProduct = {};
    productSnaps.forEach((snap, i) => {
      const productId = productIds[i];
      if (!snap.exists()) {
        throw new Error(`Producto no encontrado: ${productId}`);
      }
      const data = snap.data();
      productsData[productId] = data;

      const currentStock = Number(data.stock || 0);
      const needed = neededByProduct[productId];
      if (currentStock < needed) {
        throw new Error(
          `Stock insuficiente para ${data.name || productId}. Disponible: ${currentStock}, requerido: ${needed}`
        );
      }
      stockByProduct[productId] = { previousStock: currentStock, resultingStock: currentStock - needed };
    });

    const createdAt = firestore.FieldValue.serverTimestamp();

    const saleData = {
      receiptNumber,
      subtotal,
      total,
      tip,
      amountPaid,
      change,
      paymentMethod,
      transferNumber,
      items: normalItems.map(item => ({
        id: item.id,
        name: item.product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        total: item.total,
        // Costo AL MOMENTO de la venta: los reportes históricos no deben calcular
        // el margen contra el precio de compra actual del catálogo.
        purchasePrice: Number(item.product?.purchasePrice) || 0,
      })),
      createdAt,
      soldBy: user?.email || "",
      soldById: user?.uid || "",
      customerId: customer?.id ?? null,
      customerName: customer ? `${customer.firstName} ${customer.lastName}` : "Venta Rápida",
      customerPhone: customer?.phone ?? "",
    };

    tx.set(saleRef, saleData);

    // 2) Descontar stock — un solo write por producto, con el valor ya calculado
    // a partir de la lectura fresca hecha dentro de esta misma transacción.
    productIds.forEach((productId) => {
      tx.update(firestore().collection("products").doc(productId), {
        stock: stockByProduct[productId].resultingStock,
        updatedAt: createdAt,
      });
    });

    // 3) Movimientos de inventario — bono (sin cambios) + venta normal (nuevo).
    bonusItems.forEach(item => {
      const productId = item.product.id || item.id;
      const productInfo = productsData[productId];
      if (!productInfo) return;

      tx.set(firestore().collection("inventoryMovements").doc(), {
        productId: productId,
        productName: productInfo.name,
        quantity: item.quantity,
        type: 'BONUS_OUT',
        reason: 'Bonificación comercial',
        cost: productInfo.purchasePrice || 0,
        totalCost: (productInfo.purchasePrice || 0) * item.quantity,
        relatedSaleId: saleRef.id,
        relatedReceipt: receiptNumber,
        user: user?.email || "",
        createdAt,
      });
    });

    normalItems.forEach(item => {
      const productId = item.product.id || item.id;
      const productInfo = productsData[productId];
      const stockInfo = stockByProduct[productId];

      tx.set(firestore().collection("inventoryMovements").doc(), {
        type: 'sale',
        productId: productId,
        productName: productInfo?.name || item.product?.name,
        quantity: item.quantity,
        previousStock: stockInfo.previousStock,
        resultingStock: stockInfo.resultingStock,
        relatedSaleId: saleRef.id,
        relatedReceipt: receiptNumber,
        createdBy: user?.email || "",
        createdByUid: user?.uid || "",
        createdAt,
      });
    });

    // 4) Crédito si queda saldo pendiente (sin cambios de comportamiento).
    const pending = total - amountPaid;
    if (pending > 0 && customer?.id) {
      tx.set(firestore().collection("credits").doc(), {
        saleId: saleRef.id,
        customerId: customer.id,
        customerName: saleData.customerName,
        total,
        paid: amountPaid,
        pending,
        status: "pending",
        createdAt,
        // Venta rápida: sin flujo de despacho, no hay entregador que asignar.
        createdBy: user?.email || "N/A",
        entregadorId: null,
      });
    }
  });

  return saleRef.id;
}