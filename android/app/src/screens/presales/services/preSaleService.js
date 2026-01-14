import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

async function getNextPreSaleNumber() {
  const ref = firestore().collection("counters").doc("presales");

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

export async function registerPreSale({
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
  const receiptNumber = await getNextPreSaleNumber();

  // 🔹 Preparamos los items
  const items = cart.map((item) => ({
    id: item.id,
    name: item.product.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discount: item.discount,
    total: item.total,
  }));

  const preSaleData = {
    receiptNumber,
    subtotal,
    total,
    tip,
    amountPaid,
    change,
    paymentMethod,
    items,
    createdAt: new Date(),
    status: 'pending', // Add a status for the pre-sale

    soldBy: user?.email || "",
    soldById: user?.uid || "",

    customerId: customer?.id ?? null,
    customerName: customer
      ? `${customer.firstName} ${customer.lastName}`
      : "Preventa",
    customerPhone: customer?.phone ?? "",
  };

  try {
    // Guardar preventa
    const preSaleRef = await firestore().collection("presales").add(preSaleData);

    return preSaleRef.id;
  } catch (e) {
    console.log("🔥 Error guardando preventa:", e);
    throw e;
  }
}
