import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

async function getNextSaleNumber() {
  const ref = firestore().collection("counters").doc("sales");

  return await firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);

    let next = 1;
    if (snap.exists && snap.data()?.lastNumber) {
      next = snap.data().lastNumber + 1;
    }

    tx.set(ref, { lastNumber: next }, { merge: true });

    return String(next).padStart(6, "0");
  });
}

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

  // 🔹 Preparamos los items
  const items = cart.map((item) => ({
    id: item.id,
    name: item.product.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discount: item.discount,
    total: item.total,
  }));

  const saleData = {
    receiptNumber,
    subtotal,
    total,
    tip,
    amountPaid,
    change,
    paymentMethod,
    items,               // <- 🔥 AHORA AQUÍ VAN LOS PRODUCTOS
    createdAt: new Date(),

    soldBy: user?.email || "",
    soldById: user?.uid || "",

    customerId: customer?.id ?? null,
    customerName: customer
      ? `${customer.firstName} ${customer.lastName}`
      : "Venta Rápida",
    customerPhone: customer?.phone ?? "",
  };

  try {
    // Guardar venta
    const saleRef = await firestore().collection("sales").add(saleData);

    // Actualización de stock
    const batch = firestore().batch();

    cart.forEach((item) => {
      const pRef = firestore().collection("products").doc(item.id);
      batch.update(pRef, {
        stock: Math.max((item.product.stock ?? 0) - item.quantity, 0),
        updatedAt: new Date(),
      });
    });

    await batch.commit();

    // Créditos si aplica
    const pending = total - amountPaid;

    if (pending > 0 && customer?.id) {
      await firestore().collection("credits").add({
        saleId: saleRef.id,
        customerId: customer.id,
        customerName: saleData.customerName,
        total,
        paid: amountPaid,
        pending,
        status: "pending",
        createdAt: new Date(),
      });
    }

    return saleRef.id;
  } catch (e) {
    console.log("🔥 Error guardando venta:", e);
    throw e;
  }
}
