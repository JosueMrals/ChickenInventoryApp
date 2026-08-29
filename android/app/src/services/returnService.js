import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const returnsCollection = firestore().collection('returnRequests');
const shortagesCollection = firestore().collection('deliveryShortages');

// Línea de devolución normalizada. Se usa igual al crear y al modificar una
// solicitud para que el documento tenga siempre la misma forma.
const normalizeItem = (item) => {
  const quantity = Number(item.quantity ?? item.qty ?? item.bonusQty ?? 0);
  const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
  return {
    productId: item.productId || item.id || null,
    productName: item.productName || item.name || '',
    quantity,
    unitPrice,
    total: Number(item.total != null ? item.total : quantity * unitPrice),
  };
};

// ── Crear solicitud de devolución ─────────────────────────────────────────────
// `items`/`bonuses` son la selección del solicitante (producto + cantidad a
// devolver). Si no se pasan, se devuelve la venta completa (compatibilidad).
export async function createReturnRequest({
  presaleId, sale, reason, requestedByRole, items: selItems, bonuses: selBonuses,
}) {
  const user = auth().currentUser;
  if (!user) throw new Error('No autenticado');
  if (!reason?.trim()) throw new Error('La razón de devolución es obligatoria');

  // Verificar que no exista ya una solicitud pendiente para esta venta
  const existing = await returnsCollection
    .where('presaleId', '==', presaleId)
    .where('status', '==', 'pending_review')
    .get();
  if (!existing.empty) {
    throw new Error('Ya existe una solicitud de devolución pendiente para esta venta');
  }

  const items = (selItems || sale.items || [])
    .map(normalizeItem)
    .filter((i) => i.quantity > 0);

  const bonuses = (selBonuses || sale.bonusesAwarded || sale.bonuses || [])
    .map(normalizeItem)
    .filter((b) => b.quantity > 0);

  if (items.length === 0 && bonuses.length === 0) {
    throw new Error('Selecciona al menos un producto y una cantidad para devolver');
  }

  await returnsCollection.add({
    presaleId,
    routeId: sale.routeId || sale.route?.id || null,
    routeName: sale.route?.name || null,
    entregadorId: sale.entregadorId || null,
    status: 'pending_review',
    reason: reason.trim(),
    requestedBy: user.email || user.uid,
    requestedByUid: user.uid,
    requestedByRole: requestedByRole || 'unknown',
    requestedAt: firestore.FieldValue.serverTimestamp(),
    customerName: sale.customerName || '',
    saleTotal: Number(sale.total || 0),
    items,
    bonuses,
    confirmedBy: null,
    confirmedAt: null,
    rejectedBy: null,
    rejectionNote: null,
  });
}

// Mensaje uniforme para las guardas de estado de una solicitud de devolución.
const describeReturnStatus = (status) => {
  if (status === 'approved') return 'aprobada';
  if (status === 'rejected') return 'rechazada';
  return status || 'desconocido';
};

// ── Modificar una solicitud propia (solo mientras siga pendiente) ─────────────
// Mismo normalizado que en la creación: el entregador corrige razón y cantidades.
// Transacción con relectura: bodega puede resolver la solicitud mientras el
// entregador la está editando (o la edición queda encolada offline); sin
// releer el estado real se pisaría una solicitud ya aprobada o rechazada.
export async function updateReturnRequest({ returnRequestId, reason, items: selItems, bonuses: selBonuses }) {
  const user = auth().currentUser;
  if (!user) throw new Error('No autenticado');
  if (!reason?.trim()) throw new Error('La razón de devolución es obligatoria');

  const items = (selItems || []).map(normalizeItem).filter((i) => i.quantity > 0);
  const bonuses = (selBonuses || []).map(normalizeItem).filter((b) => b.quantity > 0);

  if (items.length === 0 && bonuses.length === 0) {
    throw new Error('Selecciona al menos un producto y una cantidad para devolver');
  }

  const ref = returnsCollection.doc(returnRequestId);
  await firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('La solicitud de devolución ya no existe.');
    const status = snap.data()?.status;
    if (status !== 'pending_review') {
      throw new Error(`Esta solicitud ya está ${describeReturnStatus(status)} y no se puede modificar.`);
    }

    tx.update(ref, {
      reason: reason.trim(),
      items,
      bonuses,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  });
}

// ── Eliminar una solicitud propia (solo mientras siga pendiente) ──────────────
// Misma guarda que updateReturnRequest: no eliminar una solicitud que bodega ya
// resolvió, para no perder el rastro de auditoría (verifiedItems, confirmedBy).
export async function deleteReturnRequest(returnRequestId) {
  const user = auth().currentUser;
  if (!user) throw new Error('No autenticado');

  const ref = returnsCollection.doc(returnRequestId);
  await firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return; // ya no existe: nada que borrar
    const status = snap.data()?.status;
    if (status !== 'pending_review') {
      throw new Error(`Esta solicitud ya está ${describeReturnStatus(status)} y no se puede eliminar.`);
    }
    tx.delete(ref);
  });
}

// ── Pre-venta original: necesaria para editar (da las cantidades máximas) ─────
export async function getPresaleForReturn(presaleId) {
  if (!presaleId) return null;
  const snap = await firestore().collection('presales').doc(presaleId).get();
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ── Aprobar con verificación de cantidades y devolver productos al inventario ─
// verifiedQuantities: mapa opcional { [claveItem]: cantidadRecibida } donde la
// clave es la que produce buildItemKey(). Sin mapa, se asume recibido == esperado.
export function buildItemKey(item, index, type) {
  return `${type}-${index}-${item.productId || item.productName}`;
}

// ── Recálculo de la factura tras una devolución aprobada ─────────────────────
// Pura (sin Firestore) para poder probarla: recibe el doc de pre-venta y las
// líneas verificadas, devuelve los campos a escribir en la pre-venta.
// `expectedQty` es lo que el cliente devolvió (lo que sale de la factura);
// `receivedQty` es lo que llegó a bodega y solo afecta stock/faltantes.
export function applyReturnToPresale(presaleData, verifiedItems) {
  const returnedItems = {};
  const returnedBonuses = {};
  verifiedItems.forEach((i) => {
    const key = i.productId || i.productName;
    const map = i.isBonus ? returnedBonuses : returnedItems;
    map[key] = (map[key] || 0) + (Number(i.expectedQty) || 0);
  });

  const removedLines = [];
  let removedSubtotal = 0;
  let removedTotal = 0;

  const reduce = (list, returnedMap, isBonus) =>
    (list || []).reduce((acc, line) => {
      const key = line.productId || line.id || line.productName;
      const oldQty = Number(line.quantity) || 0;
      const ret = Math.min(oldQty, returnedMap[key] || 0);
      const newQty = oldQty - ret;
      const unitPrice = Number(line.unitPrice || line.price) || 0;
      const oldTotal = Number(line.total != null ? line.total : oldQty * unitPrice);
      // Precio unitario neto: absorbe descuentos, así qty × neto = total siempre.
      const unitNet = oldQty > 0 ? oldTotal / oldQty : 0;

      if (ret > 0) {
        if (!isBonus) {
          removedSubtotal += ret * unitPrice;
          removedTotal += ret * unitNet;
        }
        removedLines.push({
          productId: line.productId || line.id || null,
          productName: line.productName || line.name || '',
          quantity: ret,
          unitPrice: Number(unitNet.toFixed(2)),
          total: isBonus ? 0 : Number((ret * unitNet).toFixed(2)),
          isBonus,
        });
      }

      if (newQty <= 0) return acc; // producto totalmente devuelto: sale de la factura
      acc.push({ ...line, quantity: newQty, total: Number((unitNet * newQty).toFixed(2)) });
      return acc;
    }, []);

  const newItems = reduce(presaleData.items, returnedItems, false);
  const newBonuses = reduce(presaleData.bonuses, returnedBonuses, true);

  // ponytail: recálculo proporcional; no re-evalúa umbrales de descuento por
  // categoría (min. cantidad). Si eso importa, recalcular con useSalePricing.
  const newSubtotal = Math.max(0, Number(presaleData.subtotal || 0) - removedSubtotal);
  const newTotal = Math.max(0, Number(presaleData.total || 0) - removedTotal);
  const newDiscount = Math.max(0, Number(presaleData.totalDiscount || 0) - (removedSubtotal - removedTotal));

  // Resumen compacto acumulado: una línea por producto devuelto, sumando las
  // devoluciones parciales sucesivas sobre la misma factura.
  const returnedSummary = (presaleData.returnedSummary || []).map((l) => ({ ...l }));
  removedLines.forEach((line) => {
    const prev = returnedSummary.find(
      (s) =>
        (s.productId || s.productName) === (line.productId || line.productName) &&
        !!s.isBonus === line.isBonus,
    );
    if (prev) {
      prev.quantity = Number((Number(prev.quantity || 0) + line.quantity).toFixed(2));
      prev.total = Number(((Number(prev.total) || 0) + line.total).toFixed(2));
    } else {
      returnedSummary.push(line);
    }
  });

  // Lo cobrado no puede exceder el nuevo total: la diferencia se devolvió al cliente.
  const oldPaid = Number(presaleData.amountPaid) || 0;
  const fullyReturned = newItems.length === 0 && newBonuses.length === 0;

  return {
    items: newItems,
    bonuses: newBonuses,
    subtotal: Number(newSubtotal.toFixed(2)),
    total: Number(newTotal.toFixed(2)),
    totalDiscount: Number(newDiscount.toFixed(2)),
    returnedSummary,
    returnedTotal: Number((Number(presaleData.returnedTotal || 0) + removedTotal).toFixed(2)),
    ...(oldPaid > 0 ? { amountPaid: Number(Math.min(oldPaid, newTotal).toFixed(2)) } : {}),
    status: fullyReturned ? 'returned' : 'partially_returned',
  };
}

// ── Recálculo del crédito tras una devolución aprobada ───────────────────────
// Pura (sin Firestore), igual que applyReturnToPresale: recibe el doc de crédito
// y el nuevo total de la factura, devuelve los campos a escribir (o null si no
// hay crédito). Antes esto no existía y la devolución solo bajaba el total de la
// pre-venta: al cliente se le seguía cobrando la mercadería que devolvió.
//
// `paid` NO se toca (es inmutable en esta vía por reglas, y borrarlo perdería el
// rastro del dinero ya cobrado). El invariante que exigen las reglas es
// total == paid + pending, así que cuando el cliente ya pagó MÁS de lo que quedó
// facturado, el crédito se cierra en lo cobrado (total = paid, pending = 0) y el
// reembolso queda reflejado en el `amountPaid` que applyReturnToPresale recorta.
export function applyReturnToCredit(creditData, newPresaleTotal) {
  if (!creditData) return null;

  const paid = Number(creditData.paid) || 0;
  const newTotal = Math.max(0, Number(newPresaleTotal) || 0);
  const total = Math.max(newTotal, paid);
  const pending = Number((total - paid).toFixed(2));

  return {
    total: Number(total.toFixed(2)),
    pending,
    // Devolución total sin abonos → total 0 y pending 0: no se debe nada. Es la
    // única forma válida de "sin deuda" que admiten las reglas (status pending
    // exige pending > 0).
    status: pending <= 0 ? 'paid' : 'pending',
  };
}

export async function approveReturnRequest({ returnRequestId, returnRequest, verifiedQuantities = null }) {
  const user = auth().currentUser;
  if (!user) throw new Error('No autenticado');

  const withReceived = (list, type) =>
    (list || []).map((item, index) => {
      const expected = Number(item.quantity) || 0;
      const key = buildItemKey(item, index, type);
      const raw = verifiedQuantities?.[key];
      const received = raw == null ? expected : Math.max(0, Math.min(expected, Number(raw) || 0));
      return {
        ...item,
        isBonus: type === 'bonus',
        expectedQty: expected,
        receivedQty: received,
        missingQty: expected - received,
      };
    });

  const verifiedItems = [
    ...withReceived(returnRequest.items, 'item'),
    ...withReceived(returnRequest.bonuses, 'bonus'),
  ];

  const shortages = verifiedItems.filter((i) => i.missingQty > 0);
  const stockItems = verifiedItems.filter((i) => i.productId && i.receivedQty > 0);

  const returnRef = returnsCollection.doc(returnRequestId);

  await firestore().runTransaction(async (tx) => {
    // Todas las lecturas ANTES de cualquier escritura (requisito de Firestore).
    // Relectura de la solicitud misma: sin esto, una aprobación duplicada (doble
    // tap sin red, o dos bodegueros con la misma solicitud abierta) restauraba el
    // stock DOS veces — la solicitud pasada por parámetro es la copia que trajo
    // el listener en vivo, no necesariamente el estado real del servidor.
    const returnSnap = await tx.get(returnRef);
    if (!returnSnap.exists()) throw new Error('La solicitud de devolución ya no existe.');
    const currentReturnStatus = returnSnap.data()?.status;
    if (currentReturnStatus !== 'pending_review') {
      throw new Error(`Esta solicitud ya fue ${describeReturnStatus(currentReturnStatus)} por otro usuario.`);
    }

    const productRefs = stockItems.map((item) =>
      firestore().collection('products').doc(item.productId)
    );
    const snapshots = await Promise.all(productRefs.map((ref) => tx.get(ref)));

    let presaleRef = null;
    let presaleData = null;
    if (returnRequest.presaleId) {
      presaleRef = firestore().collection('presales').doc(returnRequest.presaleId);
      const presaleSnap = await tx.get(presaleRef);
      if (presaleSnap.exists()) presaleData = presaleSnap.data();
      else presaleRef = null;
    }

    // Crédito enlazado: se lee AQUÍ (con el resto de lecturas) porque una
    // transacción no admite leer después de escribir. Se resuelve solo por
    // `creditId` — la transacción del cliente no puede ejecutar queries, y ese
    // campo lo escriben todas las vías que crean crédito (createPreSale,
    // createCreditFromPreSale y completePreSalePayment).
    let creditRef = null;
    let creditData = null;
    if (presaleData?.creditId) {
      creditRef = firestore().collection('credits').doc(presaleData.creditId);
      const creditSnap = await tx.get(creditRef);
      if (creditSnap.exists()) creditData = creditSnap.data();
      else creditRef = null;
    }

    // Restaurar stock solo por las cantidades verificadas como recibidas
    snapshots.forEach((snap, idx) => {
      if (!snap.exists()) return;
      tx.update(productRefs[idx], {
        stock: firestore.FieldValue.increment(Number(stockItems[idx].receivedQty)),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    });

    tx.update(returnRef, {
      status: 'approved',
      confirmedBy: user.email || user.uid,
      confirmedAt: firestore.FieldValue.serverTimestamp(),
      verifiedItems: verifiedItems.map((i) => ({
        productId: i.productId || null,
        productName: i.productName || '',
        isBonus: !!i.isBonus,
        expectedQty: i.expectedQty,
        receivedQty: i.receivedQty,
        missingQty: i.missingQty,
      })),
      hasShortages: shortages.length > 0,
    });

    // Actualizar la factura (pre-venta): quitar de la lista las cantidades
    // DEVUELTAS por el cliente (expectedQty) y recalcular los totales.
    if (presaleRef && presaleData) {
      const presaleUpdate = applyReturnToPresale(presaleData, verifiedItems);
      tx.update(presaleRef, {
        ...presaleUpdate,
        returnedAt: firestore.FieldValue.serverTimestamp(),
        lastReturnAt: firestore.FieldValue.serverTimestamp(),
        returnApprovedBy: user.email || user.uid,
      });

      // El crédito debe seguir al total de la factura: sin esto, devolver
      // mercadería no bajaba la deuda y se le cobraba al cliente lo devuelto.
      if (creditRef && creditData) {
        tx.update(creditRef, {
          ...applyReturnToCredit(creditData, presaleUpdate.total),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      }
    } else if (presaleRef) {
      tx.update(presaleRef, {
        status: 'returned',
        returnedAt: firestore.FieldValue.serverTimestamp(),
        returnApprovedBy: user.email || user.uid,
      });
    }

    // Registro permanente de faltantes contra el entregador
    if (shortages.length > 0) {
      const entregadorId = returnRequest.entregadorId || presaleData?.entregadorId || null;
      const totalMissingQty = shortages.reduce((sum, i) => sum + i.missingQty, 0);
      const totalMissingValue = shortages.reduce(
        (sum, i) => sum + i.missingQty * (Number(i.unitPrice) || 0), 0
      );
      tx.set(shortagesCollection.doc(), {
        returnRequestId,
        presaleId: returnRequest.presaleId || null,
        routeId: returnRequest.routeId || null,
        routeName: returnRequest.routeName || null,
        customerName: returnRequest.customerName || '',
        entregadorId,
        items: shortages.map((i) => ({
          productId: i.productId || null,
          productName: i.productName || '',
          isBonus: !!i.isBonus,
          expectedQty: i.expectedQty,
          receivedQty: i.receivedQty,
          missingQty: i.missingQty,
          unitPrice: Number(i.unitPrice) || 0,
          missingValue: i.missingQty * (Number(i.unitPrice) || 0),
        })),
        totalMissingQty,
        totalMissingValue,
        status: 'pending',
        recordedBy: user.email || user.uid,
        recordedByUid: user.uid,
        recordedAt: firestore.FieldValue.serverTimestamp(),
      });
    }
  });
}

// ── Entregar faltantes posteriormente (repone el stock de lo faltante) ─────────
export async function fulfillShortage({ shortageId, shortage, note = '' }) {
  const user = auth().currentUser;
  if (!user) throw new Error('No autenticado');

  await firestore().runTransaction(async (tx) => {
    const items = (shortage.items || []).filter((i) => i.productId && (Number(i.missingQty) || 0) > 0);
    const refs = items.map((i) => firestore().collection('products').doc(i.productId));
    const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));

    snaps.forEach((snap, idx) => {
      if (!snap.exists()) return;
      tx.update(refs[idx], {
        stock: firestore.FieldValue.increment(Number(items[idx].missingQty) || 0),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    });

    tx.update(shortagesCollection.doc(shortageId), {
      status: 'fulfilled',
      fulfilledBy: user.email || user.uid,
      fulfilledByUid: user.uid,
      fulfilledAt: firestore.FieldValue.serverTimestamp(),
      fulfillmentNote: note?.trim() || null,
    });
  });
}

// ── Rechazar solicitud ────────────────────────────────────────────────────────
// Misma guarda: dos bodegueros no deben poder aprobar y rechazar (o rechazar dos
// veces) la misma solicitud sin que la segunda escritura vea la primera.
export async function rejectReturnRequest({ returnRequestId, rejectionNote }) {
  const user = auth().currentUser;
  if (!user) throw new Error('No autenticado');

  const ref = returnsCollection.doc(returnRequestId);
  await firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('La solicitud de devolución ya no existe.');
    const status = snap.data()?.status;
    if (status !== 'pending_review') {
      throw new Error(`Esta solicitud ya fue ${describeReturnStatus(status)}.`);
    }

    tx.update(ref, {
      status: 'rejected',
      rejectedBy: user.email || user.uid,
      rejectedAt: firestore.FieldValue.serverTimestamp(),
      rejectionNote: rejectionNote?.trim() || null,
    });
  });
}

// ── Escuchar solicitudes pendientes (bodeguero) ───────────────────────────────
export function subscribePendingReturnRequests(callback, routeId = null) {
  let query = returnsCollection.where('status', '==', 'pending_review');
  if (routeId) {
    query = query.where('routeId', '==', routeId);
  }
  return query.onSnapshot(
      (snap) => {
        const docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const ta = a.requestedAt?.toMillis?.() ?? 0;
            const tb = b.requestedAt?.toMillis?.() ?? 0;
            return tb - ta;
          });
        callback(docs);
      },
      (err) => {
        console.error('[ReturnService] pending snapshot:', err);
        callback([]);
      }
    );
}

// ── Solicitudes pendientes del propio solicitante (entregador) ────────────────
export function subscribeMyPendingReturnRequests(uid, callback) {
  if (!uid) {
    callback([]);
    return () => {};
  }
  return returnsCollection
    .where('requestedByUid', '==', uid)
    .where('status', '==', 'pending_review')
    .onSnapshot(
      (snap) => {
        const docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.requestedAt?.toMillis?.() ?? 0) - (a.requestedAt?.toMillis?.() ?? 0));
        callback(docs);
      },
      (err) => {
        console.error('[ReturnService] my pending snapshot:', err);
        callback([]);
      }
    );
}

// ── Historial de devoluciones resueltas (aprobadas o rechazadas) ──────────────
// `requestedByUid` limita el historial al solicitante (vista del entregador).
// `limit` acota el historial: es una colección que solo crece y la pantalla
// muestra las más recientes. Sin él se transfería cada devolución resuelta jamás.
export function subscribeReturnHistory(callback, routeId = null, requestedByUid = null, limit = 100) {
  // routeId y requestedByUid van en el query, no en un .filter() del cliente:
  // filtrar después de recibir los documentos ya pagó la lectura de todos ellos.
  let query = returnsCollection.where('status', 'in', ['approved', 'rejected']);
  if (routeId) query = query.where('routeId', '==', routeId);
  if (requestedByUid) query = query.where('requestedByUid', '==', requestedByUid);

  // orderBy es obligatorio para que limit() signifique "las más recientes": sin él
  // Firestore corta por orden de ID de documento, o sea 100 arbitrarias.
  // Se ordena por requestedAt (siempre presente) y no por la fecha de resolución,
  // que vive en dos campos distintos según el desenlace (confirmedAt/rejectedAt).
  return query
    .orderBy('requestedAt', 'desc')
    .limit(limit)
    .onSnapshot(
      (snap) => {
        const resolvedAt = (d) =>
          d.confirmedAt?.toMillis?.() ?? d.rejectedAt?.toMillis?.() ?? 0;
        // Dentro de la página ya acotada, se reordena por fecha de resolución.
        const docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => resolvedAt(b) - resolvedAt(a));
        callback(docs);
      },
      (err) => {
        console.error('[ReturnService] history snapshot:', err);
        callback([]);
      }
    );
}

// ── Registro de faltantes por entregador ──────────────────────────────────────
// `entregadorId` limita la lista a los faltantes a cargo de ese entregador.
export function subscribeDeliveryShortages(callback, routeId = null, entregadorId = null, limit = 100) {
  // Igual que en el historial: routeId y entregadorId llegaban como argumentos y se
  // aplicaban con .filter() tras haber leído la colección entera.
  let query = shortagesCollection;
  if (routeId) query = query.where('routeId', '==', routeId);
  if (entregadorId) query = query.where('entregadorId', '==', entregadorId);

  return query
    .orderBy('recordedAt', 'desc')
    .limit(limit)
    .onSnapshot(
    (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(docs);
    },
    (err) => {
      console.error('[ReturnService] shortages snapshot:', err);
      callback([]);
    }
  );
}

// ── Escuchar solicitudes de una venta específica (para saber si ya tiene una activa) ─────
export function subscribeReturnRequestsByPresale(presaleId, callback) {
  return returnsCollection
    .where('presaleId', '==', presaleId)
    .onSnapshot(
      (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        console.error('[ReturnService] presale snapshot:', err);
        callback([]);
      }
    );
}
