import firestore from '@react-native-firebase/firestore';
import auth from "@react-native-firebase/auth";
import { buildCustomerName } from "../utils/customerUtils";

const presalesCollection = firestore().collection('presales');
const salesCollection = firestore().collection('sales');
const countersCollection = firestore().collection('counters');
const productsCollection = firestore().collection('products');

const BLOCKING_DELETE_ORDER_STATUSES = new Set([
  'preparing',
  'ready_for_delivery',
  'credit_preparing',
  'credit_ready_for_delivery',
  'dispatched',
  'delivered',
]);

const BLOCKING_DELETE_ITEM_STATUSES = new Set(['preparing', 'ready', 'dispatched', 'delivered']);

const removeUndefinedFields = (obj = {}) => {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (typeof value === 'undefined') return acc;
    acc[key] = value;
    return acc;
  }, {});
};

const mapItemsToPayload = (items = []) => items.map(({ product, ...rest }) => (
  removeUndefinedFields({
    ...rest,
    productId: product.id,
    productName: product.name,
    productCategory: product?.category || rest?.category || null,
  })
));

const buildQtyMap = (items = []) => items.reduce((acc, item) => {
  const productId = item.productId || item.id || item.product?.id;
  if (!productId) return acc;
  const qty = Number(item.quantity) || 0;
  if (!qty) return acc;
  acc[productId] = (acc[productId] || 0) + qty;
  return acc;
}, {});

const mergeQtyMaps = (items = [], bonuses = []) => {
  const baseMap = buildQtyMap(items);
  const bonusMap = buildQtyMap(bonuses);
  Object.keys(bonusMap).forEach((key) => {
    baseMap[key] = (baseMap[key] || 0) + bonusMap[key];
  });
  return baseMap;
};

const diffQtyMaps = (oldMap = {}, newMap = {}) => {
  const productIds = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);
  const deltas = {};
  productIds.forEach((id) => {
    const delta = (newMap[id] || 0) - (oldMap[id] || 0);
    if (delta !== 0) deltas[id] = delta;
  });
  return deltas;
};

const applyStockDeltas = (tx, deltas = {}) => {
  Object.keys(deltas).forEach((productId) => {
    const delta = deltas[productId];
    if (!delta) return;
    tx.update(productsCollection.doc(productId), {
      stock: firestore.FieldValue.increment(-delta),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  });
};

const restoreStockFromMap = (tx, qtyMap = {}) => {
  Object.keys(qtyMap).forEach((productId) => {
    const quantity = Number(qtyMap[productId]) || 0;
    if (!quantity) return;
    tx.update(productsCollection.doc(productId), {
      stock: firestore.FieldValue.increment(quantity),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  });
};

const hasItemsInWarehousePreparation = (items = [], bonuses = []) => {
  const allItems = [...(items || []), ...(bonuses || [])];
  return allItems.some((item) => BLOCKING_DELETE_ITEM_STATUSES.has(item?.status || 'pending'));
};

const validateStockAvailability = async (tx, deltas = {}) => {
  const productIds = Object.keys(deltas).filter((id) => deltas[id] > 0);
  if (!productIds.length) return;

  const docs = await Promise.all(productIds.map((id) => tx.get(productsCollection.doc(id))));
  docs.forEach((docSnap) => {
    const needed = deltas[docSnap.id] || 0;
    const currentStock = docSnap.exists ? Number(docSnap.data()?.stock || 0) : 0;
    if (!docSnap.exists) {
      throw new Error(`Producto no encontrado: ${docSnap.id}`);
    }
    if (currentStock < needed) {
      throw new Error(`Stock insuficiente para ${docSnap.data()?.name || docSnap.id}. Disponible: ${currentStock}, requerido: ${needed}`);
    }
  });
};

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

  const { route, paymentMethod } = preSaleData;

  const customerId = preSaleData.customer?.id || null;
  const customerName = buildCustomerName(preSaleData.customer, "Cliente sin nombre");

  const isCredit = paymentMethod === 'credit';

  const items = mapItemsToPayload(preSaleData.cart.filter(item => !item.isBonus));
  const bonuses = mapItemsToPayload(preSaleData.cart.filter(item => item.isBonus));
  const inventoryMap = mergeQtyMaps(items, bonuses);

  const newPreSale = {
    customer: preSaleData.customer,
    customerId,
    customerName,
    subtotal: preSaleData.subtotal,
    totalDiscount: preSaleData.totalDiscount,
    categoryDiscountTotal: Number(preSaleData.categoryDiscountTotal || 0),
    total: preSaleData.total,
    preSaleNumber,
    paymentMethod: paymentMethod || 'cash',
    status: isCredit ? 'credit_pending' : 'pending',
    createdAt: firestore.FieldValue.serverTimestamp(),
    createdBy: user?.email || 'N/A',
    items,
    bonuses,
    route: route || null,
    routeId: route?.id || null,
    inventoryDeducted: true,
    inventoryDeductedAt: firestore.FieldValue.serverTimestamp(),
    inventoryDeductedBy: user?.email || 'N/A',
  };

  const docRef = presalesCollection.doc();
  const historyRef = docRef.collection('history').doc();

  await firestore().runTransaction(async (tx) => {
    await validateStockAvailability(tx, inventoryMap);
    tx.set(docRef, newPreSale);
    applyStockDeltas(tx, inventoryMap);
    tx.set(historyRef, {
      timestamp: firestore.FieldValue.serverTimestamp(),
      user: user?.email || 'N/A',
      action: 'CREATE',
      details: `Pre-venta #${preSaleNumber} creada. Total: ${newPreSale.total.toFixed(2)}`,
    });
  });

  return { ...newPreSale, id: docRef.id };
};

export const updatePreSaleInFirestore = async (preSaleId, oldPreSaleData, newPreSaleData) => {
  const user = auth().currentUser;
  const preSaleRef = presalesCollection.doc(preSaleId);

  // Verificar que el estado actual permite edición (guard del lado del servidor)
  const TERMINAL_STATUSES = new Set(['paid', 'cancelled', 'dispatched', 'delivered']);
  const currentStatusCheck = oldPreSaleData.status || 'pending';
  if (TERMINAL_STATUSES.has(currentStatusCheck)) {
    throw new Error(`No se puede editar una pre-venta en estado: ${currentStatusCheck}.`);
  }

  const route = newPreSaleData.route || oldPreSaleData.route || null;
  const routeId = newPreSaleData.route?.id || oldPreSaleData.routeId || null;

  const customerId = newPreSaleData.customer?.id || null;
  const customerName = buildCustomerName(newPreSaleData.customer, "Cliente sin nombre");
  const paymentMethod = newPreSaleData.paymentMethod || oldPreSaleData.paymentMethod || 'cash';
  const isCredit = paymentMethod === 'credit';

  // Mapa de conversión de estados normales → crédito
  const creditStatusMap = {
    pending: 'credit_pending',
    preparing: 'credit_preparing',
    ready_for_delivery: 'credit_ready_for_delivery',
  };
  // Mapa inverso: crédito → normal
  const normalStatusMap = {
    credit_pending: 'pending',
    credit_preparing: 'preparing',
    credit_ready_for_delivery: 'ready_for_delivery',
  };
  const creditStatuses = new Set(Object.keys(normalStatusMap));
  const editableStatuses = new Set([...Object.keys(creditStatusMap), ...creditStatuses]);

  const baseStatus = oldPreSaleData.status || 'pending';

  // Solo transformar estados editables; nunca modificar terminales
  let normalizedStatus = baseStatus;
  if (editableStatuses.has(baseStatus)) {
    if (isCredit) {
      normalizedStatus = creditStatuses.has(baseStatus) ? baseStatus : (creditStatusMap[baseStatus] || 'credit_pending');
    } else {
      normalizedStatus = creditStatuses.has(baseStatus) ? (normalStatusMap[baseStatus] || 'pending') : baseStatus;
    }
  }

  const items = mapItemsToPayload(newPreSaleData.cart.filter(item => !item.isBonus));
  const bonuses = mapItemsToPayload(newPreSaleData.cart.filter(item => item.isBonus));

  const updatedPreSale = {
    customer: newPreSaleData.customer,
    customerId,
    customerName,
    subtotal: newPreSaleData.subtotal,
    totalDiscount: newPreSaleData.totalDiscount,
    categoryDiscountTotal: Number(newPreSaleData.categoryDiscountTotal || oldPreSaleData.categoryDiscountTotal || 0),
    total: newPreSaleData.total,
    paymentMethod,
    status: normalizedStatus,
    updatedAt: firestore.FieldValue.serverTimestamp(),
    updatedBy: user?.email || 'N/A',
    items,
    bonuses,
    route: route,
    routeId: routeId,
    inventoryDeducted: !!oldPreSaleData.inventoryDeducted,
    inventoryDeductedAt: oldPreSaleData.inventoryDeductedAt || null,
    inventoryDeductedBy: oldPreSaleData.inventoryDeductedBy || null,
  };

  const historyRef = preSaleRef.collection('history').doc();
  const writeBatch = firestore().batch();

  await firestore().runTransaction(async (tx) => {
    if (updatedPreSale.inventoryDeducted) {
      const oldInventoryMap = mergeQtyMaps(oldPreSaleData.items || [], oldPreSaleData.bonuses || []);
      const newInventoryMap = mergeQtyMaps(items, bonuses);
      const deltas = diffQtyMaps(oldInventoryMap, newInventoryMap);
      await validateStockAvailability(tx, deltas);
      applyStockDeltas(tx, deltas);
    }

    tx.update(preSaleRef, updatedPreSale);

    tx.set(historyRef, {
      timestamp: firestore.FieldValue.serverTimestamp(),
      user: user?.email || 'N/A',
      action: 'EDIT',
      details: `Pre-venta actualizada. Total anterior: ${oldPreSaleData.total.toFixed(2)}, nuevo total: ${updatedPreSale.total.toFixed(2)}.`,
    });
  });

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

export const getPreSaleById = async (preSaleId) => {
  const doc = await presalesCollection.doc(preSaleId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
};

export const convertPreSaleToSale = async (preSale, paymentDetails) => {
  if (!preSale?.id) throw new Error('Pre-venta inválida: id requerido.');

  const user = auth().currentUser;
  const saleNumber = await getNextSaleNumber();

  const preSaleRef = presalesCollection.doc(preSale.id);
  const saleRef = salesCollection.doc();
  const historyRef = preSaleRef.collection('history').doc();

  const salePayload = {
    preSaleId: preSale.id,
    preSaleNumber: preSale.preSaleNumber || null,
    saleNumber,
    customer: preSale.customer || null,
    customerId: preSale.customerId || null,
    customerName: preSale.customerName || null,
    items: preSale.items || [],
    bonuses: preSale.bonuses || [],
    subtotal: Number(preSale.subtotal) || 0,
    totalDiscount: Number(preSale.totalDiscount) || 0,
    categoryDiscountTotal: Number(preSale.categoryDiscountTotal) || 0,
    total: Number(preSale.total) || 0,
    paymentMethod: paymentDetails?.paymentMethod || preSale.paymentMethod || 'cash',
    amountPaid: Number(paymentDetails?.amountPaid) || Number(preSale.total) || 0,
    change: Number(paymentDetails?.change) || 0,
    route: preSale.route || null,
    routeId: preSale.routeId || null,
    createdAt: firestore.FieldValue.serverTimestamp(),
    createdBy: user?.email || 'N/A',
    originalCreatedBy: preSale.createdBy || null,
    inventoryDeducted: true,
  };

  await firestore().runTransaction(async (tx) => {
    const preSaleSnap = await tx.get(preSaleRef);

    if (!preSaleSnap.exists) {
      throw new Error('La pre-venta no existe o ya fue eliminada.');
    }

    const currentStatus = preSaleSnap.data()?.status;
    if (currentStatus === 'paid') {
      throw new Error('Esta pre-venta ya fue pagada.');
    }
    if (currentStatus === 'cancelled') {
      throw new Error('No se puede cobrar una pre-venta cancelada.');
    }
    if (!['pending', 'dispatched'].includes(currentStatus)) {
      throw new Error(`Estado inválido para cobrar: ${currentStatus}.`);
    }

    tx.set(saleRef, salePayload);

    tx.update(preSaleRef, {
      status: 'paid',
      saleId: saleRef.id,
      fechaPago: firestore.FieldValue.serverTimestamp(),
      amountPaid: salePayload.amountPaid,
      change: salePayload.change,
      paymentMethod: salePayload.paymentMethod,
      updatedAt: firestore.FieldValue.serverTimestamp(),
      updatedBy: user?.email || 'N/A',
    });

    tx.set(historyRef, {
      timestamp: firestore.FieldValue.serverTimestamp(),
      user: user?.email || 'N/A',
      action: 'PAID',
      details: `Pre-venta cobrada. Monto: ${salePayload.amountPaid.toFixed(2)}, Método: ${salePayload.paymentMethod}. Venta #${saleNumber}`,
    });
  });

  return saleRef.id;
};

export const updateAggregateProductStatus = async (productName, newStatus, fromStatus = null) => {
  const user = auth().currentUser;
  const batch = firestore().batch();

  const activeStatuses = ['pending', 'credit_pending', 'credit_preparing', 'credit_ready_for_delivery', 'preparing', 'ready_for_delivery'];
  const snapshot = await presalesCollection.where('status', 'in', activeStatuses).get();

  // Estados terminales que NUNCA deben ser regresados automáticamente
  const TERMINAL_STATUSES = new Set(['paid', 'cancelled', 'dispatched', 'delivered']);

  let updateCount = 0;

  snapshot.docs.forEach(doc => {
    const data = doc.data();

    // Doble guarda: si el documento ya está en estado terminal, lo omitimos
    if (TERMINAL_STATUSES.has(data.status)) return;

    let madeChange = false;

    const updateItemStatus = (item) => {
      const currentStatus = item.status || 'pending';
      const name = item.productName || item.name;

      if (name !== productName) return false;
      if (fromStatus && currentStatus !== fromStatus) return false;
      if (currentStatus === newStatus) return false;

      item.status = newStatus;
      return true;
    };

    const items = (data.items || []).map(item => {
      const changed = updateItemStatus(item);
      if (changed) madeChange = true;
      return item;
    });

    const bonuses = (data.bonuses || []).map(item => {
      const changed = updateItemStatus(item);
      if (changed) madeChange = true;
      return item;
    });

    if (madeChange) {
      updateCount++;

      const allItems = [...items, ...bonuses];

      // Guarda: si no hay ítems, no calcular nuevo estado (evitar vacuously-true)
      let nextOrderStatus = data.status;

      if (allItems.length > 0) {
        const allReady = allItems.every(i => i.status === 'ready');
        const allPending = allItems.every(i => !i.status || i.status === 'pending');

        if (allReady) {
          nextOrderStatus = data.paymentMethod === 'credit' ? 'credit_ready_for_delivery' : 'ready_for_delivery';
        } else if (allPending) {
          // Solo regresar a pending si la preventa estaba en preparing (retroceso válido de bodega)
          // No regresar desde ready_for_delivery o estados superiores sin validación explícita
          const canRegress = data.status === 'preparing' || data.status === 'credit_preparing';
          if (canRegress) {
            nextOrderStatus = data.paymentMethod === 'credit' ? 'credit_pending' : 'pending';
          }
          // Si no puede regresar, mantener el estado actual (nextOrderStatus = data.status)
        } else {
          // Estado mixto
          nextOrderStatus = data.paymentMethod === 'credit' ? 'credit_preparing' : 'preparing';
        }
      }

      batch.update(doc.ref, {
        items,
        bonuses,
        status: nextOrderStatus,
        updatedAt: firestore.FieldValue.serverTimestamp(),
        lastWorker: user?.email || 'N/A',
      });
    }
  });

  if (updateCount > 0) {
    await batch.commit();
  }
  return updateCount;
};

export const deletePreSaleInFirestore = async ({ preSaleId, reason }) => {
  const user = auth().currentUser;
  const normalizedReason = (reason || '').trim();
  if (!normalizedReason) {
    throw new Error('Debe ingresar una descripción de la eliminación.');
  }

  const preSaleRef = presalesCollection.doc(preSaleId);

  await firestore().runTransaction(async (tx) => {
    const preSaleSnap = await tx.get(preSaleRef);
    if (!preSaleSnap.exists) {
      throw new Error('La pre-venta no existe o ya fue eliminada.');
    }

    const preSaleData = preSaleSnap.data() || {};

    if (preSaleData.status === 'cancelled') {
      throw new Error('La pre-venta ya está cancelada.');
    }

    if (BLOCKING_DELETE_ORDER_STATUSES.has(preSaleData.status)) {
      throw new Error('No se puede eliminar: la pre-venta ya está en preparación o en un estado posterior.');
    }

    if (hasItemsInWarehousePreparation(preSaleData.items, preSaleData.bonuses)) {
      throw new Error('No se puede eliminar: hay productos que ya fueron trabajados por bodega.');
    }

    const inventoryWasDeducted = !!preSaleData.inventoryDeducted;
    const inventoryAlreadyRestored = !!preSaleData.inventoryRestored;

    if (inventoryWasDeducted && !inventoryAlreadyRestored) {
      const qtyMap = mergeQtyMaps(preSaleData.items || [], preSaleData.bonuses || []);
      restoreStockFromMap(tx, qtyMap);
    }

    tx.update(preSaleRef, {
      status: 'cancelled',
      cancelledAt: firestore.FieldValue.serverTimestamp(),
      cancelledBy: user?.email || 'N/A',
      cancellationReason: normalizedReason,
      updatedAt: firestore.FieldValue.serverTimestamp(),
      updatedBy: user?.email || 'N/A',
      inventoryRestored: inventoryWasDeducted,
      inventoryRestoredAt: inventoryWasDeducted ? firestore.FieldValue.serverTimestamp() : null,
      inventoryRestoredBy: inventoryWasDeducted ? (user?.email || 'N/A') : null,
    });

    const historyRef = preSaleRef.collection('history').doc();
    tx.set(historyRef, {
      timestamp: firestore.FieldValue.serverTimestamp(),
      user: user?.email || 'N/A',
      action: 'DELETE',
      details: `Pre-venta cancelada. Motivo: ${normalizedReason}`,
    });
  });

  return true;
};
