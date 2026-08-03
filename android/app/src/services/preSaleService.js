import firestore from '@react-native-firebase/firestore';
import auth from "@react-native-firebase/auth";
import { buildCustomerName } from "../utils/customerUtils";

const presalesCollection = firestore().collection('presales');
const creditsCollection = firestore().collection('credits');
const salesCollection = firestore().collection('sales');
const countersCollection = firestore().collection('counters');
const productsCollection = firestore().collection('products');

const BLOCKING_DELETE_ORDER_STATUSES = new Set([
  'preparing',
  'ready_for_delivery',
  'credit_preparing',
  'credit_ready_for_delivery',
  'dispatched',
  'credit_dispatched',
  'delivered',
  // Terminales: cancelar una factura ya cobrada o con devolución aprobada
  // restauraría stock que ya salió (o que la devolución ya repuso).
  'paid',
  'partially_returned',
  'returned',
]);

const BLOCKING_DELETE_ITEM_STATUSES = new Set(['preparing', 'ready', 'dispatched', 'delivered']);

// Estados terminales: una vez alcanzados, bodega ya no puede reescribir la
// preventa. Incluye las devoluciones aprobadas, que ya movieron stock y totales.
export const TERMINAL_PRESALE_STATUSES = new Set([
  'paid', 'cancelled', 'dispatched', 'credit_dispatched', 'delivered',
  'partially_returned', 'returned',
]);

// Estado de la ORDEN → estado que corresponde a cada uno de sus PRODUCTOS.
// El Panel de Control agrupa por `items[].status` (pending/preparing/ready), no
// por el estado de la orden: si solo se mueve la orden, los productos se quedan
// en la pestaña anterior.
const ORDER_TO_ITEM_STATUS = {
  pending: 'pending',
  credit_pending: 'pending',
  preparing: 'preparing',
  credit_preparing: 'preparing',
  ready_for_delivery: 'ready',
  credit_ready_for_delivery: 'ready',
};

/**
 * Cambia el estado de una preventa releyendo el documento dentro de una
 * transacción, y arrastra con él el estado de todos sus productos.
 *
 * Con `update()` a secas la escritura es ciega: se envía tal cual, y si el
 * dispositivo estaba sin señal queda encolada y se reproduce al reconectar —
 * horas o días después — pisando un estado más nuevo escrito por otro usuario.
 * Así es como una factura ya cobrada reaparecía como pendiente.
 * La transacción relee el estado real en el servidor y aborta si ya es terminal;
 * además falla en vez de encolarse cuando no hay conexión.
 *
 * Los productos se sincronizan porque "Empezar Preparación" / "Marcar Lista"
 * (detalle de la orden) y los swipes del panel escribían SOLO el estado de la
 * orden: el Panel de Control y el avance individual de productos —que leen
 * `items[].status`— nunca se enteraban del cambio.
 */
export const updatePreSaleStatusGuarded = async (preSaleId, newStatus) => {
  const user = auth().currentUser;
  const ref = presalesCollection.doc(preSaleId);

  return firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('La pre-venta ya no existe.');

    const data = snap.data() || {};
    const current = data.status;
    if (TERMINAL_PRESALE_STATUSES.has(current)) {
      throw new Error(
        `Esta orden ya está en estado "${current}" y no puede regresar a "${newStatus}".`
      );
    }
    if (current === newStatus) return current;

    const payload = {
      status: newStatus,
      updatedAt: firestore.FieldValue.serverTimestamp(),
      lastWorker: user?.email || 'N/A',
    };

    // Solo para los estados de bodega; los demás no tienen equivalente por producto.
    const itemStatus = ORDER_TO_ITEM_STATUS[newStatus];
    if (itemStatus) {
      const applyStatus = (list) =>
        (list || []).map((item) => (item.status === itemStatus ? item : { ...item, status: itemStatus }));
      payload.items = applyStatus(data.items);
      payload.bonuses = applyStatus(data.bonuses);
    }

    tx.update(ref, payload);
    return newStatus;
  });
};

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
    // Costo AL MOMENTO de la venta. Sin esto, los reportes históricos calculan el
    // margen contra el precio de compra de hoy, que es simplemente otro número.
    purchasePrice: Number(product?.purchasePrice) || 0,
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
    const currentStock = docSnap.exists() ? Number(docSnap.data()?.stock || 0) : 0;
    if (!docSnap.exists()) {
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

  const { route, paymentMethod, creditDueDate } = preSaleData;

  const customerId = preSaleData.customer?.id || null;
  const customerName = buildCustomerName(preSaleData.customer, "Cliente sin nombre");

  const isCredit = paymentMethod === 'credit';
  const dueDateTs = isCredit && creditDueDate
    ? firestore.Timestamp.fromDate(new Date(creditDueDate))
    : null;

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
    creditDueDate: dueDateTs,
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

  // Una pre-venta a crédito debe existir TAMBIÉN como cuenta por cobrar. Antes solo
  // se marcaba la preventa como 'credit_pending' y el documento en `credits` no se
  // creaba nunca: aparecía en "Mis Pre-Ventas → Crédito" (que lee `presales`) pero
  // el módulo de Créditos salía vacío. createCreditFromPreSale tampoco podía
  // repararlo después: rechaza las preventas cuyo estado ya empieza por 'credit_'.
  const creditRef = isCredit ? creditsCollection.doc() : null;
  if (creditRef) newPreSale.creditId = creditRef.id;

  await firestore().runTransaction(async (tx) => {
    await validateStockAvailability(tx, inventoryMap);
    tx.set(docRef, newPreSale);
    applyStockDeltas(tx, inventoryMap);

    if (creditRef) {
      tx.set(creditRef, {
        preSaleId: docRef.id,
        customerId,
        customerName,
        clientName: customerName,
        dueDate: dueDateTs,
        total: newPreSale.total,
        paid: 0,
        pending: newPreSale.total,
        status: 'pending',
        createdAt: firestore.FieldValue.serverTimestamp(),
        createdBy: user?.email || 'N/A',
        payments: [],
      });
    }

    tx.set(historyRef, {
      timestamp: firestore.FieldValue.serverTimestamp(),
      user: user?.email || 'N/A',
      action: 'CREATE',
      details: `Pre-venta #${preSaleNumber} creada. Total: ${newPreSale.total.toFixed(2)}`,
    });
  });

  return { ...newPreSale, id: docRef.id };
};

// Localiza el crédito de una pre-venta. Prefiere `creditId`; los créditos creados
// por la Cloud Function de cobro pueden no haberlo dejado en la preventa, así que
// cae a buscar por `preSaleId`.
const resolveCreditRef = async (preSaleId, creditId) => {
  const safeId = typeof creditId === 'string' ? creditId.trim() : '';
  if (safeId && !safeId.includes('/')) return creditsCollection.doc(safeId);

  const snap = await creditsCollection.where('preSaleId', '==', preSaleId).limit(1).get();
  return snap.empty ? null : snap.docs[0].ref;
};

export const updatePreSaleInFirestore = async (preSaleId, oldPreSaleData, newPreSaleData) => {
  const user = auth().currentUser;
  const preSaleRef = presalesCollection.doc(preSaleId);

  // Verificar que el estado actual permite edición (guard del lado del servidor)
  const TERMINAL_STATUSES = new Set([
    'paid', 'cancelled', 'dispatched', 'credit_dispatched', 'delivered',
    // Una factura con devolución aprobada ya movió stock y totales: es terminal.
    'partially_returned', 'returned',
  ]);
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
  const creditDueDate = isCredit
    ? (newPreSaleData.creditDueDate
        ? firestore.Timestamp.fromDate(new Date(newPreSaleData.creditDueDate))
        : oldPreSaleData.creditDueDate || null)
    : null;

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
    creditDueDate,
    // `status` e `inventoryDeducted*` se fijan DENTRO de la transacción, a partir
    // del documento releído — nunca de los datos que traía la pantalla.
    updatedAt: firestore.FieldValue.serverTimestamp(),
    updatedBy: user?.email || 'N/A',
    items,
    bonuses,
    route: route,
    routeId: routeId,
  };

  const historyRef = preSaleRef.collection('history').doc();

  // La cuenta por cobrar debe seguir a la pre-venta: si cambia el monto, cambia lo
  // adeudado. Se resuelve la referencia ANTES de la transacción porque el SDK
  // cliente no admite queries dentro de una (los créditos viejos creados por la
  // Cloud Function pueden no tener `creditId` en la preventa).
  const existingCreditRef = await resolveCreditRef(preSaleId, oldPreSaleData.creditId);
  const newCreditRef = isCredit && !existingCreditRef ? creditsCollection.doc() : null;
  if (newCreditRef) updatedPreSale.creditId = newCreditRef.id;

  await firestore().runTransaction(async (tx) => {
    // Todas las lecturas antes de cualquier escritura (requisito de Firestore).
    // Relectura fresca de la pre-venta: el guard de arriba usa los datos que traía
    // la pantalla, que pueden venir de una caché de días atrás. Si en el servidor
    // ya fue cobrada/entregada/devuelta, guardar la edición la regresaría a
    // "pendiente" y volvería a mover stock. Decide el estado RELEÍDO.
    const freshSnap = await tx.get(preSaleRef);
    if (!freshSnap.exists()) {
      throw new Error('La pre-venta no existe o ya fue eliminada.');
    }
    const freshData = freshSnap.data() || {};
    const freshStatus = freshData.status || 'pending';
    if (TERMINAL_STATUSES.has(freshStatus)) {
      throw new Error(`No se puede editar una pre-venta en estado: ${freshStatus}.`);
    }

    const creditSnap = existingCreditRef ? await tx.get(existingCreditRef) : null;

    // Solo transformar estados editables; nunca modificar terminales
    let normalizedStatus = freshStatus;
    if (editableStatuses.has(freshStatus)) {
      if (isCredit) {
        normalizedStatus = creditStatuses.has(freshStatus) ? freshStatus : (creditStatusMap[freshStatus] || 'credit_pending');
      } else {
        normalizedStatus = creditStatuses.has(freshStatus) ? (normalStatusMap[freshStatus] || 'pending') : freshStatus;
      }
    }
    updatedPreSale.status = normalizedStatus;
    updatedPreSale.inventoryDeducted = !!freshData.inventoryDeducted;
    updatedPreSale.inventoryDeductedAt = freshData.inventoryDeductedAt || null;
    updatedPreSale.inventoryDeductedBy = freshData.inventoryDeductedBy || null;

    if (updatedPreSale.inventoryDeducted) {
      // El diff de stock también parte de los ítems releídos: los de la pantalla
      // pueden no reflejar una devolución o edición hecha entretanto.
      const oldInventoryMap = mergeQtyMaps(freshData.items || [], freshData.bonuses || []);
      const newInventoryMap = mergeQtyMaps(items, bonuses);
      const deltas = diffQtyMaps(oldInventoryMap, newInventoryMap);
      await validateStockAvailability(tx, deltas);
      applyStockDeltas(tx, deltas);
    }

    const total = Number(updatedPreSale.total) || 0;

    if (creditSnap?.exists()) {
      const paid = Number(creditSnap.data()?.paid) || 0;

      if (!isCredit) {
        // Pasa a contado: un crédito con abonos no puede desaparecer sin más.
        if (paid > 0) {
          throw new Error(
            `Esta pre-venta tiene C$${paid.toFixed(2)} abonados al crédito. Elimina los abonos antes de cambiarla a contado.`
          );
        }
        tx.delete(existingCreditRef);
        updatedPreSale.creditId = firestore.FieldValue.delete();
      } else {
        if (total < paid) {
          throw new Error(
            `El nuevo total (C$${total.toFixed(2)}) es menor que lo ya abonado (C$${paid.toFixed(2)}).`
          );
        }
        tx.update(existingCreditRef, {
          total,
          pending: Number((total - paid).toFixed(2)),
          dueDate: creditDueDate,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      }
    } else if (newCreditRef) {
      // Pasa de contado a crédito: la cuenta por cobrar todavía no existía.
      tx.set(newCreditRef, {
        preSaleId,
        customerId,
        customerName,
        clientName: customerName,
        dueDate: creditDueDate,
        total,
        paid: 0,
        pending: total,
        status: 'pending',
        createdAt: firestore.FieldValue.serverTimestamp(),
        createdBy: user?.email || 'N/A',
        payments: [],
      });
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
  if (!doc.exists()) return null;
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

    if (!preSaleSnap.exists()) {
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

// Calcula el nuevo estado de UNA preventa al cambiar el estado de un producto.
// Pura: recibe el doc y devuelve { items, bonuses, nextStatus } o null si no hay
// cambio (o si la orden es terminal). Se usa para pre-filtrar candidatos y, con
// la relectura fresca, para decidir la escritura dentro de la transacción.
const computeProductStatusUpdate = (data, { targetNames, targetCategory, fromStatus, newStatus, normalize }) => {
  if (!data) return null;
  if (TERMINAL_PRESALE_STATUSES.has(data.status)) return null;

  let madeChange = false;
  const updateItemStatus = (item) => {
    const currentStatus = item.status || 'pending';
    const name = item.productName || item.name || item.product?.name;
    const category = item.category || item.productCategory || item.categoryName || item.product?.category;

    if (!targetNames.has(normalize(name))) return item;
    if (targetCategory && normalize(category) !== targetCategory) return item;
    if (fromStatus && currentStatus !== fromStatus) return item;
    if (currentStatus === newStatus) return item;

    madeChange = true;
    return { ...item, status: newStatus };
  };

  const items = (data.items || []).map(updateItemStatus);
  const bonuses = (data.bonuses || []).map(updateItemStatus);
  if (!madeChange) return null;

  const allItems = [...items, ...bonuses];
  let nextStatus = data.status;
  if (allItems.length > 0) {
    const allReady = allItems.every(i => i.status === 'ready');
    const allPending = allItems.every(i => !i.status || i.status === 'pending');
    if (allReady) {
      nextStatus = data.paymentMethod === 'credit' ? 'credit_ready_for_delivery' : 'ready_for_delivery';
    } else if (allPending) {
      // Solo regresar a pending si la preventa estaba en preparing (retroceso válido de bodega).
      const canRegress = data.status === 'preparing' || data.status === 'credit_preparing';
      if (canRegress) nextStatus = data.paymentMethod === 'credit' ? 'credit_pending' : 'pending';
    } else {
      nextStatus = data.paymentMethod === 'credit' ? 'credit_preparing' : 'preparing';
    }
  }
  return { items, bonuses, nextStatus };
};

/**
 * Mueve de etapa uno o VARIOS productos a la vez.
 *
 * `productName` acepta un string o un arreglo de nombres. El caso masivo (mover
 * toda una categoría o toda la etapa) recorre las órdenes UNA sola vez en vez de
 * repetir la consulta por cada producto.
 *
 * `filters.candidateIds`: ids de las órdenes que contienen el producto, según el
 * listener EN VIVO de la pantalla. Evita releer del servidor todas las órdenes
 * activas de la ruta en cada movimiento (más rápido) y elimina el pre-filtrado
 * contra datos posiblemente viejos. La relectura dentro de la transacción sigue
 * siendo la que decide qué se escribe.
 *
 * Las llamadas se serializan en una cola local: dos toques rápidos
 * (PENDIENTE→EN PROCESO e inmediatamente EN PROCESO→LISTO) deben confirmarse en
 * ese orden. En paralelo, el segundo releía el estado anterior al primero, no
 * encontraba nada en `fromStatus` y se descartaba en silencio — el producto
 * "se regresaba" a la etapa previa cuando el listener reconciliaba la UI.
 */
let aggregateWriteQueue = Promise.resolve();

export const updateAggregateProductStatus = (productName, newStatus, fromStatus = null, filters = {}) => {
  const run = () => applyAggregateProductStatus(productName, newStatus, fromStatus, filters);
  const result = aggregateWriteQueue.then(run, run);
  aggregateWriteQueue = result.catch(() => {});
  return result;
};

const applyAggregateProductStatus = async (productName, newStatus, fromStatus, filters) => {
  const user = auth().currentUser;
  const normalize = (value) => String(value || '').trim().toLowerCase();
  const names = Array.isArray(productName) ? productName : [productName];
  const targetNames = new Set(names.map(normalize).filter(Boolean));
  if (targetNames.size === 0) return 0;

  const opts = {
    normalize,
    targetNames,
    targetCategory: normalize(filters?.productCategory),
    fromStatus,
    newStatus,
  };

  let candidates;
  if (Array.isArray(filters?.candidateIds) && filters.candidateIds.length > 0) {
    candidates = [...new Set(filters.candidateIds)].map((id) => ({ ref: presalesCollection.doc(id) }));
  } else {
    // Sin candidatos de la pantalla: consulta clásica + pre-filtrado con la
    // instantánea (posiblemente de caché). La decisión real la toma la relectura
    // fresca dentro de la transacción.
    const activeStatuses = ['pending', 'credit_pending', 'credit_preparing', 'credit_ready_for_delivery', 'preparing', 'ready_for_delivery'];
    let query = presalesCollection.where('status', 'in', activeStatuses);
    if (filters?.routeId) {
      query = query.where('routeId', '==', filters.routeId);
    }
    const snapshot = await query.get();
    candidates = snapshot.docs.filter((doc) => computeProductStatusUpdate(doc.data(), opts) !== null);
  }
  if (candidates.length === 0) return 0;

  // UNA transacción POR documento. Antes, una sola transacción leía TODAS las
  // órdenes de la ruta; en la pantalla de preparación el listener en vivo toca
  // esas órdenes constantemente, así que la transacción se abortaba, se perdía la
  // escritura y la UI optimista revertía sola (EN PROCESO→PENDIENTE, LISTOS→EN
  // PROCESO). Transacciones de un solo documento aíslan la contención: el fallo de
  // una orden no arrastra a las demás, y cada relectura sigue descartando órdenes
  // ya cobradas/devueltas (guarda TERMINAL_PRESALE_STATUSES).
  const results = await Promise.allSettled(
    candidates.map((docSnap) =>
      firestore().runTransaction(async (tx) => {
        const fresh = await tx.get(docSnap.ref);
        if (!fresh.exists()) return false;
        const result = computeProductStatusUpdate(fresh.data(), opts);
        if (!result) return false;
        tx.update(docSnap.ref, {
          items: result.items,
          bonuses: result.bonuses,
          status: result.nextStatus,
          updatedAt: firestore.FieldValue.serverTimestamp(),
          lastWorker: user?.email || 'N/A',
        });
        return true;
      })
    )
  );

  let updateCount = 0;
  results.forEach((r) => {
    if (r.status === 'fulfilled' && r.value) updateCount++;
    else if (r.status === 'rejected') {
      console.error('[updateAggregateProductStatus] fallo aislado:', r.reason?.message || r.reason);
    }
  });
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
    if (!preSaleSnap.exists()) {
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
