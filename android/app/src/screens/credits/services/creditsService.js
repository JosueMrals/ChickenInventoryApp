import { firestore, auth } from '../../../services/firebaseConfig';

const toCents = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
};

const fromCents = (value) => Number((value / 100).toFixed(2));

function sanitizeDocId(rawId) {
  if (typeof rawId !== 'string') return null;
  const trimmed = rawId.trim();
  if (!trimmed) return null;
  if (!trimmed.includes('/')) return trimmed;

  // Compatibilidad: algunos registros legacy guardan path completo "presales/{id}".
  const parts = trimmed.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  return parts[parts.length - 1] || null;
}

const normalizeCustomerName = (raw, fallback = 'Cliente') => {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return value || fallback;
};

const buildCustomerNameFromPreSale = (preSale) => {
  const direct = normalizeCustomerName(preSale?.customerName, '');
  if (direct) return direct;

  const firstName = typeof preSale?.customer?.firstName === 'string' ? preSale.customer.firstName.trim() : '';
  const lastName = typeof preSale?.customer?.lastName === 'string' ? preSale.customer.lastName.trim() : '';
  const joined = [firstName, lastName].filter(Boolean).join(' ').trim();
  return joined || 'Cliente';
};

function toFirestoreTimestamp(value) {
  if (value && typeof value.toDate === 'function') {
    return value;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return firestore.Timestamp.fromDate(value);
  }

  if (typeof value?.seconds === 'number') {
    return firestore.Timestamp.fromDate(new Date(value.seconds * 1000));
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return firestore.Timestamp.fromDate(parsed);
    }
  }

  return firestore.Timestamp.fromDate(new Date());
}

function normalizePaymentEntry(entry, fallbackDate) {
  if (!entry || typeof entry !== 'object') return null;

  const amount = Number(entry.amount);
  const safeAmount = Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0;
  const by = typeof entry.by === 'string' && entry.by.trim() ? entry.by.trim() : 'N/A';

  const previousPending = Number(entry.previousPending);
  const newPending = Number(entry.newPending);

  const normalized = {
    amount: safeAmount,
    date: toFirestoreTimestamp(entry.date || fallbackDate),
    by,
  };

  if (Number.isFinite(previousPending)) normalized.previousPending = Number(previousPending.toFixed(2));
  if (Number.isFinite(newPending)) normalized.newPending = Number(newPending.toFixed(2));

  return normalized;
}

/** 🧾 Obtener lista de créditos en tiempo real */
export const fetchCredits = (onUpdate) => {
  return firestore()
    .collection('credits')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      const data = snapshot.docs.map(doc => {
        const raw = doc.data() || {};
        const customerName = normalizeCustomerName(raw.customerName || raw.clientName || '', 'Cliente');
        return {
          ...raw,
          customerName,
          id: doc.id, // Fuerza siempre el id real del documento
          preSaleId: raw.preSaleId || raw.presaleId || null,
        };
      });
      onUpdate(data);
    });
};

/** 💵 Registrar abono y guardar historial */
export const abonarCredito = async (creditId, amount, userEmail) => {
  const safeCreditId = sanitizeDocId(creditId);
  if (!safeCreditId) {
    throw new Error('Crédito inválido: id no válido.');
  }

  const pagoCents = toCents(amount);
  if (!pagoCents || pagoCents <= 0) throw new Error('Monto inválido');

  const now = new Date();
  const nowTs = firestore.Timestamp.fromDate(now);
  const fallbackUser = auth()?.currentUser?.email || auth()?.currentUser?.displayName || null;
  const paymentActor = (typeof userEmail === 'string' && userEmail.trim()) ? userEmail.trim() : (fallbackUser || 'N/A');
  const creditRef = firestore().collection('credits').doc(safeCreditId);
  let result = null;

  await firestore().runTransaction(async (tx) => {
    const creditSnap = await tx.get(creditRef);
    if (!creditSnap.exists) {
      throw new Error('El crédito no existe o fue eliminado.');
    }

    const creditData = creditSnap.data() || {};
    const totalCents = toCents(creditData.total || 0);
    const paidCents = toCents(creditData.paid || 0);
    const pendingStoredCents = toCents(creditData.pending || 0);
    const pendingCents = totalCents > 0
      ? Math.max(0, totalCents - paidCents)
      : pendingStoredCents;

    if (pendingCents <= 0) {
      throw new Error('Este crédito ya está saldado.');
    }

    if (pagoCents > pendingCents) {
      throw new Error(`El abono no puede ser mayor al saldo pendiente (C$${fromCents(pendingCents).toFixed(2)}).`);
    }

    const remainingCents = pendingCents - pagoCents;
    const nuevoPendienteCents = remainingCents <= 0 ? 0 : remainingCents;
    const nuevoPagadoCents = totalCents > 0 && nuevoPendienteCents === 0
      ? totalCents
      : paidCents + pagoCents;
    const nuevoEstado = nuevoPendienteCents === 0 ? 'paid' : 'pending';

    const abono = {
      amount: fromCents(pagoCents),
      date: nowTs,
      by: paymentActor,
      previousPending: fromCents(pendingCents),
      newPending: fromCents(nuevoPendienteCents),
    };

    const preSaleRawId = creditData?.preSaleId || creditData?.presaleId || null;
    const preSaleId = sanitizeDocId(preSaleRawId);

    tx.update(creditRef, {
      paid: fromCents(nuevoPagadoCents),
      pending: fromCents(nuevoPendienteCents),
      status: nuevoEstado,
      updatedAt: nowTs,
      payments: firestore.FieldValue.arrayUnion(abono),
    });

    // Nota: la actualización de preventa se realiza fuera de la transacción para
    // no bloquear el abono por datos legacy inconsistentes en preSaleId.

    result = {
      nuevoPagado: fromCents(nuevoPagadoCents),
      nuevoPendiente: fromCents(nuevoPendienteCents),
      estado: nuevoEstado,
      appliedAmount: fromCents(pagoCents),
      linkedPreSaleId: preSaleId || null,
    };
  });

  if (result?.estado === 'paid' && result?.linkedPreSaleId) {
    try {
      await firestore().collection('presales').doc(result.linkedPreSaleId).update({
        status: 'paid',
        fechaPago: nowTs,
        updatedAt: nowTs,
      });
      result.linkedPreSaleUpdated = true;
    } catch (linkError) {
      console.warn('No se pudo actualizar la preventa enlazada al saldar crédito:', {
        creditId: safeCreditId,
        preSaleId: result.linkedPreSaleId,
        message: linkError?.message,
        code: linkError?.code,
      });
      result.linkedPreSaleUpdated = false;
    }
  }

  return result;
};

/** 🧾 Crear crédito desde una pre-venta */
export const createCreditFromPreSale = async (preSale, createdBy) => {
  if (!preSale?.id) throw new Error('Pre-venta inválida');

  const creditRef = firestore().collection('credits').doc();
  const preSaleRef = firestore().collection('presales').doc(preSale.id);
  const total = Number(preSale.total) || 0;
  const customerName = buildCustomerNameFromPreSale(preSale);
  const customerId = preSale.customerId || preSale.customer?.id || null;

  const actor = (typeof createdBy === 'string' && createdBy.trim())
    ? createdBy.trim()
    : (auth()?.currentUser?.email || auth()?.currentUser?.displayName || 'N/A');

  const batch = firestore().batch();
  batch.set(creditRef, {
    preSaleId: preSale.id,
    customerId,
    customerName,
    clientName: customerName,
    total,
    paid: 0,
    pending: total,
    status: 'pending',
    createdAt: new Date(),
    createdBy: actor,
  });

  batch.update(preSaleRef, {
    status: 'credit_pending',
    creditId: creditRef.id,
    updatedAt: new Date(),
  });

  await batch.commit();
  return creditRef.id;
};

/** ❌ Eliminar crédito */
export const eliminarCredito = async (creditId) => {
  await firestore().collection('credits').doc(creditId).delete();
};
