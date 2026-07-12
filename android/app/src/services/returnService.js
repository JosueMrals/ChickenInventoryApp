import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const returnsCollection = firestore().collection('returnRequests');
const shortagesCollection = firestore().collection('deliveryShortages');

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

  const normItem = (item) => {
    const quantity = Number(item.quantity || item.qty || 0);
    const unitPrice = Number(item.unitPrice || item.price || 0);
    return {
      productId: item.productId || item.id || null,
      productName: item.productName || item.name || '',
      quantity,
      unitPrice,
      total: Number(item.total != null ? item.total : quantity * unitPrice),
    };
  };

  const items = (selItems || sale.items || [])
    .map(normItem)
    .filter((i) => i.quantity > 0);

  const bonuses = (selBonuses || sale.bonusesAwarded || sale.bonuses || [])
    .map((b) => ({
      productId: b.productId || b.id || null,
      productName: b.productName || b.name || '',
      quantity: Number(b.quantity || b.qty || b.bonusQty || 0),
      unitPrice: Number(b.unitPrice || b.price || 0),
    }))
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

// ── Aprobar con verificación de cantidades y devolver productos al inventario ─
// verifiedQuantities: mapa opcional { [claveItem]: cantidadRecibida } donde la
// clave es la que produce buildItemKey(). Sin mapa, se asume recibido == esperado.
export function buildItemKey(item, index, type) {
  return `${type}-${index}-${item.productId || item.productName}`;
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

  await firestore().runTransaction(async (tx) => {
    // Todas las lecturas ANTES de cualquier escritura (requisito de Firestore)
    const productRefs = stockItems.map((item) =>
      firestore().collection('products').doc(item.productId)
    );
    const snapshots = await Promise.all(productRefs.map((ref) => tx.get(ref)));

    let presaleRef = null;
    let presaleData = null;
    if (returnRequest.presaleId) {
      presaleRef = firestore().collection('presales').doc(returnRequest.presaleId);
      const presaleSnap = await tx.get(presaleRef);
      if (presaleSnap.exists) presaleData = presaleSnap.data();
      else presaleRef = null;
    }

    // Restaurar stock solo por las cantidades verificadas como recibidas
    snapshots.forEach((snap, idx) => {
      if (!snap.exists) return;
      tx.update(productRefs[idx], {
        stock: firestore.FieldValue.increment(Number(stockItems[idx].receivedQty)),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    });

    tx.update(returnsCollection.doc(returnRequestId), {
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
      // Cantidad devuelta por producto (separando productos y regalías)
      const returnedItems = {};
      const returnedBonuses = {};
      verifiedItems.forEach((i) => {
        const key = i.productId || i.productName;
        const map = i.isBonus ? returnedBonuses : returnedItems;
        map[key] = (map[key] || 0) + (Number(i.expectedQty) || 0);
      });

      let removedSubtotal = 0;
      let removedTotal = 0;
      const reduce = (list, returnedMap, isBonus) =>
        (list || []).reduce((acc, line) => {
          const key = line.productId || line.id || line.productName;
          const oldQty = Number(line.quantity) || 0;
          const ret = Math.min(oldQty, returnedMap[key] || 0);
          const newQty = oldQty - ret;
          if (!isBonus && ret > 0) {
            const unitPrice = Number(line.unitPrice || line.price) || 0;
            const oldTotal = Number(line.total != null ? line.total : oldQty * unitPrice);
            const unitNet = oldQty > 0 ? oldTotal / oldQty : 0;
            removedSubtotal += ret * unitPrice;
            removedTotal += ret * unitNet;
          }
          if (newQty <= 0) return acc; // producto totalmente devuelto: sale de la factura
          const unitPrice = Number(line.unitPrice || line.price) || 0;
          const oldTotal = Number(line.total != null ? line.total : oldQty * unitPrice);
          const unitNet = oldQty > 0 ? oldTotal / oldQty : 0;
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
      const fullyReturned = newItems.length === 0 && newBonuses.length === 0;

      tx.update(presaleRef, {
        items: newItems,
        bonuses: newBonuses,
        subtotal: Number(newSubtotal.toFixed(2)),
        total: Number(newTotal.toFixed(2)),
        totalDiscount: Number(newDiscount.toFixed(2)),
        status: fullyReturned ? 'returned' : 'partially_returned',
        returnedAt: firestore.FieldValue.serverTimestamp(),
        lastReturnAt: firestore.FieldValue.serverTimestamp(),
        returnApprovedBy: user.email || user.uid,
      });
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
      if (!snap.exists) return;
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
export async function rejectReturnRequest({ returnRequestId, rejectionNote }) {
  const user = auth().currentUser;
  if (!user) throw new Error('No autenticado');

  await returnsCollection.doc(returnRequestId).update({
    status: 'rejected',
    rejectedBy: user.email || user.uid,
    rejectedAt: firestore.FieldValue.serverTimestamp(),
    rejectionNote: rejectionNote?.trim() || null,
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

// ── Historial de devoluciones resueltas (aprobadas o rechazadas) ──────────────
export function subscribeReturnHistory(callback, routeId = null) {
  return returnsCollection
    .where('status', 'in', ['approved', 'rejected'])
    .onSnapshot(
      (snap) => {
        const resolvedAt = (d) =>
          d.confirmedAt?.toMillis?.() ?? d.rejectedAt?.toMillis?.() ?? 0;
        const docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((d) => !routeId || d.routeId === routeId)
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
export function subscribeDeliveryShortages(callback, routeId = null) {
  return shortagesCollection.onSnapshot(
    (snap) => {
      const docs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((d) => !routeId || d.routeId === routeId)
        .sort((a, b) => (b.recordedAt?.toMillis?.() ?? 0) - (a.recordedAt?.toMillis?.() ?? 0));
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
