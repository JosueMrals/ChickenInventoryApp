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

// Función para registrar la venta completa, ahora con lógica de bonificaciones
export async function registerQuickSaleFull({
  cart = [],
  subtotal = 0,
  total = 0,
  tip = 0,
  paymentMethod,
  amountPaid,
  change,
  customer = null,
}) {
  if (!cart.length) throw new Error("El carrito está vacío.");

  const user = auth().currentUser;
  const receiptNumber = await getNextSaleNumber();
  const batch = firestore().batch();
  // --- FIX: Change collection back to "sales" ---
  const saleRef = firestore().collection("sales").doc(); 
  const createdAt = firestore.FieldValue.serverTimestamp();

  const normalItems = cart.filter(item => !item.isBonus);
  const bonusItems = cart.filter(item => item.isBonus);
  
  const productIds = [...new Set(cart.map(item => item.product.id || item.id))];

  const productsSnapshot = await firestore().collection('products').where(firestore.FieldPath.documentId(), 'in', productIds).get();
  const productsData = {};
  productsSnapshot.forEach(doc => {
      productsData[doc.id] = doc.data();
  });

  const saleData = {
    receiptNumber,
    subtotal,
    total,
    tip,
    amountPaid,
    change,
    paymentMethod,
    items: normalItems.map(item => ({
      id: item.id,
      name: item.product.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      total: item.total,
    })),
    createdAt,
    soldBy: user?.email || "",
    soldById: user?.uid || "",
    customerId: customer?.id ?? null,
    customerName: customer ? `${customer.firstName} ${customer.lastName}` : "Venta Rápida",
    customerPhone: customer?.phone ?? "",
  };
  
  batch.set(saleRef, saleData);

  cart.forEach((item) => {
    const productId = item.product.id || item.id;
    const productRef = firestore().collection("products").doc(productId);
    const newStock = firestore.FieldValue.increment(-item.quantity);
    batch.update(productRef, { stock: newStock });
  });

  bonusItems.forEach(item => {
    const productId = item.product.id || item.id;
    const productInfo = productsData[productId];
    if (!productInfo) return;

    const movementRef = firestore().collection("inventoryMovements").doc();
    batch.set(movementRef, {
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

  const pending = total - amountPaid;
  if (pending > 0 && customer?.id) {
    const creditRef = firestore().collection("credits").doc();
    batch.set(creditRef, {
      saleId: saleRef.id,
      customerId: customer.id,
      customerName: saleData.customerName,
      total,
      paid: amountPaid,
      pending,
      status: "pending",
      createdAt,
    });
  }

  try {
    await batch.commit();
    return saleRef.id;
  } catch (e) {
    console.error("🔥 Error registrando la venta y movimientos:", e);
    throw e;
  }
}