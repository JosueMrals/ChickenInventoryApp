import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const returnsCollection = firestore().collection('returnRequests');

// ── Crear solicitud de devolución ─────────────────────────────────────────────
export async function createReturnRequest({ presaleId, sale, reason, requestedByRole }) {
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

  const items = (sale.items || []).map((item) => ({
    productId: item.productId || item.id || null,
    productName: item.productName || item.name || '',
    quantity: Number(item.quantity || item.qty || 0),
    unitPrice: Number(item.unitPrice || item.price || 0),
    total: Number(item.total || 0),
  }));

  const bonuses = (sale.bonusesAwarded || sale.bonuses || []).map((b) => ({
    productId: b.productId || b.id || null,
    productName: b.productName || b.name || '',
    quantity: Number(b.quantity || b.qty || b.bonusQty || 0),
  }));

  await returnsCollection.add({
    presaleId,
    routeId: sale.routeId || sale.route?.id || null,
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

// ── Aprobar y devolver productos al inventario ────────────────────────────────
export async function approveReturnRequest({ returnRequestId, returnRequest }) {
  const user = auth().currentUser;
  if (!user) throw new Error('No autenticado');

  // Restaurar stock de cada producto en una transacción atómica
  const allItems = [
    ...(returnRequest.items || []),
    ...(returnRequest.bonuses || []),
  ].filter((i) => i.productId && Number(i.quantity) > 0);

  await firestore().runTransaction(async (tx) => {
    // Leer todas las referencias primero (requisito de Firestore transactions)
    const productRefs = allItems.map((item) =>
      firestore().collection('products').doc(item.productId)
    );
    const snapshots = await Promise.all(productRefs.map((ref) => tx.get(ref)));

    // Validar que los documentos existen y luego actualizar
    snapshots.forEach((snap, idx) => {
      if (!snap.exists) return;
      tx.update(productRefs[idx], {
        stock: firestore.FieldValue.increment(Number(allItems[idx].quantity)),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    });

    // Actualizar estado de la solicitud
    tx.update(returnsCollection.doc(returnRequestId), {
      status: 'approved',
      confirmedBy: user.email || user.uid,
      confirmedAt: firestore.FieldValue.serverTimestamp(),
    });

    // Actualizar estado de la pre-venta a 'returned'
    if (returnRequest.presaleId) {
      const presaleRef = firestore().collection('presales').doc(returnRequest.presaleId);
      const presaleSnap = await tx.get(presaleRef);
      if (presaleSnap.exists) {
        tx.update(presaleRef, {
          status: 'returned',
          returnedAt: firestore.FieldValue.serverTimestamp(),
          returnApprovedBy: user.email || user.uid,
        });
      }
    }
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

