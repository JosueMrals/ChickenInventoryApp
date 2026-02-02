import firestore from '@react-native-firebase/firestore';
import auth from "@react-native-firebase/auth";

const presalesCollection = firestore().collection('presales');
const salesCollection = firestore().collection('sales');
const countersCollection = firestore().collection('counters');

// Helper to get next sale number (reused from quick sales)
const getNextSaleNumber = async () => {
  const ref = countersCollection.doc("sales");
  return firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = (snap.data()?.lastNumber || 0) + 1;
    tx.set(ref, { lastNumber: next }, { merge: true });
    return String(next).padStart(6, "0");
  });
};

export const getNextPreSaleNumber = async () => {
  const counterDocRef = countersCollection.doc('preSaleCounter');
  return firestore().runTransaction(async (transaction) => {
    const doc = await transaction.get(counterDocRef);
    const newNumber = (doc.data()?.currentNumber || 0) + 1;
    transaction.set(counterDocRef, { currentNumber: newNumber });
    return newNumber;
  });
};

export const savePreSaleToFirestore = async (preSaleData) => {
  const preSaleNumber = await getNextPreSaleNumber();
  const user = auth().currentUser;

  // Extraemos la ruta si viene en los datos, si no, null
  const { route, ...restData } = preSaleData;

  const newPreSale = {
    customer: preSaleData.customer,
    subtotal: preSaleData.subtotal,
    totalDiscount: preSaleData.totalDiscount,
    total: preSaleData.total,
    preSaleNumber,
    status: 'pending',
    createdAt: firestore.FieldValue.serverTimestamp(),
    createdBy: user?.email || 'N/A',
    items: preSaleData.cart.filter(item => !item.isBonus).map(({ product, ...rest }) => ({ ...rest, productId: product.id, productName: product.name })),
    bonuses: preSaleData.cart.filter(item => item.isBonus).map(({ product, ...rest }) => ({ ...rest, productId: product.id, productName: product.name })),
    // Guardamos la información de la ruta en la pre-venta
    route: route || null,
    routeId: route?.id || null
  };
  const docRef = await presalesCollection.add(newPreSale);
  
  // Create initial history record
  const historyRef = docRef.collection('history').doc();
  await historyRef.set({
    timestamp: firestore.FieldValue.serverTimestamp(),
    user: user?.email || 'N/A',
    action: 'CREATE',
    details: `Pre-venta #${preSaleNumber} creada. Total: ${newPreSale.total.toFixed(2)}`,
  });

  return { ...newPreSale, id: docRef.id };
};

export const updatePreSaleInFirestore = async (preSaleId, oldPreSaleData, newPreSaleData) => {
  const user = auth().currentUser;
  const preSaleRef = presalesCollection.doc(preSaleId);

  // Mantenemos la ruta original si no se proporciona una nueva (generalmente la ruta no cambia al editar, pero por si acaso)
  const route = newPreSaleData.route || oldPreSaleData.route || null;
  const routeId = newPreSaleData.route?.id || oldPreSaleData.routeId || null;

  const updatedPreSale = {
    customer: newPreSaleData.customer,
    subtotal: newPreSaleData.subtotal,
    totalDiscount: newPreSaleData.totalDiscount,
    total: newPreSaleData.total,
    updatedAt: firestore.FieldValue.serverTimestamp(),
    updatedBy: user?.email || 'N/A',
    items: newPreSaleData.cart.filter(item => !item.isBonus).map(({ product, ...rest }) => ({ ...rest, productId: product.id, productName: product.name })),
    bonuses: newPreSaleData.cart.filter(item => item.isBonus).map(({ product, ...rest }) => ({ ...rest, productId: product.id, productName: product.name })),
    route: route,
    routeId: routeId
  };

  const historyRef = preSaleRef.collection('history').doc();
  
  const writeBatch = firestore().batch();
  
  writeBatch.update(preSaleRef, updatedPreSale);
  
  writeBatch.set(historyRef, {
    timestamp: firestore.FieldValue.serverTimestamp(),
    user: user?.email || 'N/A',
    action: 'EDIT',
    details: `Pre-venta actualizada. Total anterior: ${oldPreSaleData.total.toFixed(2)}, nuevo total: ${updatedPreSale.total.toFixed(2)}.`,
  });

  await writeBatch.commit();
  return { ...updatedPreSale, id: preSaleId };
};

export const getPreSaleHistory = async (preSaleId) => {
  const snapshot = await presalesCollection.doc(preSaleId).collection('history').orderBy('timestamp', 'desc').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};


export const getPreSalesFromFirestore = async (filters = {}) => {
  let query = presalesCollection.orderBy('createdAt', 'desc');

  // Aplicar filtro de ruta si existe
  if (filters.routeId) {
    query = query.where('routeId', '==', filters.routeId);
  }

  const snapshot = await query.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const convertPreSaleToSale = async (preSale, paymentDetails) => {
  // ... (existing code remains the same)
};
