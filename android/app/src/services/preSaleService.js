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
    // Separar items y bonificaciones
    items: preSaleData.cart.filter(item => !item.isBonus).map(({ product, ...rest }) => ({ ...rest, productId: product.id, productName: product.name })),
    bonuses: preSaleData.cart.filter(item => item.isBonus).map(({ product, ...rest }) => ({ ...rest, productId: product.id, productName: product.name })),
    route: route || null,
    routeId: route?.id || null
  };
  const docRef = await presalesCollection.add(newPreSale);
  
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

  const route = newPreSaleData.route || oldPreSaleData.route || null;
  const routeId = newPreSaleData.route?.id || oldPreSaleData.routeId || null;

  const updatedPreSale = {
    customer: newPreSaleData.customer,
    subtotal: newPreSaleData.subtotal,
    totalDiscount: newPreSaleData.totalDiscount,
    total: newPreSaleData.total,
    updatedAt: firestore.FieldValue.serverTimestamp(),
    updatedBy: user?.email || 'N/A',
    // Separar items y bonificaciones
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

  if (filters.routeId) {
    query = query.where('routeId', '==', filters.routeId);
  }

  const snapshot = await query.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const convertPreSaleToSale = async (preSale, paymentDetails) => {
  // ... (existing code remains the same)
};

export const updateAggregateProductStatus = async (productName, newStatus, fromStatus = null) => {
  const user = auth().currentUser;
  const batch = firestore().batch();

  // Buscar todas las órdenes activas que contengan este producto
  // Nota: Buscamos órdenes no finalizadas. 'dispatched', 'delivered' y 'cancelled' se ignoran.
  const activeStatuses = ['pending', 'preparing', 'ready_for_delivery'];
  const snapshot = await presalesCollection.where('status', 'in', activeStatuses).get();

  let updateCount = 0;

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    let madeChange = false;

    // Función para actualizar estado de un item individual si coincide el nombre
    // Se asume que item.status undefined = 'pending'
    const updateItemStatus = (item) => {
      const currentStatus = item.status || 'pending';
      const name = item.productName || item.name;

      // Filtro por nombre
      if (name !== productName) return false;

      // Filtro por estado origen (si se especifica)
      if (fromStatus && currentStatus !== fromStatus) return false;

      // Evitar actualización redundante
      if (currentStatus === newStatus) return false;

      item.status = newStatus;
      return true;
    };

    // Procesar items normales
    const items = (data.items || []).map(item => {
      const changed = updateItemStatus(item);
      if (changed) madeChange = true;
      return item;
    });

    // Procesar bonificaciones
    const bonuses = (data.bonuses || []).map(item => {
      const changed = updateItemStatus(item);
      if (changed) madeChange = true;
      return item;
    });

    if (madeChange) {
      updateCount++;
      // --- Lógica de Promoción de Estado de la Orden ---
      // Verificar el estado global de todos los items de la orden
      const allItems = [...items, ...bonuses];
      const allReady = allItems.every(i => i.status === 'ready');
      const allPending = allItems.every(i => !i.status || i.status === 'pending');

      let nextOrderStatus = data.status;

      if (allReady) {
        nextOrderStatus = 'ready_for_delivery';
      } else if (allPending) {
        nextOrderStatus = 'pending';
      } else {
        // Estado mixto: al menos uno en proceso o listo, pero no todos
        nextOrderStatus = 'preparing';
      }

      batch.update(doc.ref, {
        items,
        bonuses,
        status: nextOrderStatus,
        updatedAt: firestore.FieldValue.serverTimestamp(),
        lastWorker: user?.email || 'N/A'
      });
    }
  });

  if (updateCount > 0) {
    await batch.commit();
  }
  return updateCount;
};
