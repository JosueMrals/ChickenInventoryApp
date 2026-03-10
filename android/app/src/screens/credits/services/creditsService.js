import { firestore } from '../../../services/firebaseConfig';

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

function normalizePaymentEntry(entry, fallbackDate) {
  if (!entry || typeof entry !== 'object') return null;

  const amount = Number(entry.amount);
  const safeAmount = Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0;
  const by = typeof entry.by === 'string' && entry.by.trim() ? entry.by.trim() : 'N/A';

  const rawDate = entry.date;
  let safeDate = fallbackDate;
  if (rawDate && typeof rawDate.toDate === 'function') {
    safeDate = rawDate;
  } else if (rawDate instanceof Date && !Number.isNaN(rawDate.getTime())) {
    safeDate = rawDate;
  } else if (typeof rawDate?.seconds === 'number') {
    safeDate = new Date(rawDate.seconds * 1000);
  } else if (typeof rawDate === 'string' || typeof rawDate === 'number') {
    const parsed = new Date(rawDate);
    if (!Number.isNaN(parsed.getTime())) safeDate = parsed;
  }

  const previousPending = Number(entry.previousPending);
  const newPending = Number(entry.newPending);

  const normalized = {
    amount: safeAmount,
    date: safeDate,
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
        return {
          ...raw,
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
      date: now,
      by: userEmail || 'N/A',
      previousPending: fromCents(pendingCents),
      newPending: fromCents(nuevoPendienteCents),
    };

    // Compatibilidad con documentos legacy donde payments puede no ser lista.
    const currentPaymentsRaw = Array.isArray(creditData?.payments) ? creditData.payments : [];
    const currentPayments = currentPaymentsRaw
      .map((entry) => normalizePaymentEntry(entry, now))
      .filter(Boolean);
    const nextPayments = [...currentPayments, abono];

    const preSaleRawId = creditData?.preSaleId || creditData?.presaleId || null;
    const preSaleId = sanitizeDocId(preSaleRawId);
    let linkedPreSaleUpdated = false;
    let preSaleRef = null;

    // Importante: en transacciones Firestore todas las lecturas van antes de escrituras.
    if (preSaleId && nuevoEstado === 'paid') {
      preSaleRef = firestore().collection('presales').doc(preSaleId);
      const preSaleSnap = await tx.get(preSaleRef);
      linkedPreSaleUpdated = preSaleSnap.exists;
    }

    tx.update(creditRef, {
      paid: fromCents(nuevoPagadoCents),
      pending: fromCents(nuevoPendienteCents),
      status: nuevoEstado,
      updatedAt: now,
      payments: nextPayments,
    });

    if (linkedPreSaleUpdated && preSaleRef) {
      tx.update(preSaleRef, {
        status: 'paid',
        fechaPago: now,
        updatedAt: now,
      });
    }

    result = {
      nuevoPagado: fromCents(nuevoPagadoCents),
      nuevoPendiente: fromCents(nuevoPendienteCents),
      estado: nuevoEstado,
      appliedAmount: fromCents(pagoCents),
      linkedPreSaleUpdated,
    };
  });

  return result;
};

/** 🧾 Crear crédito desde una pre-venta */
export const createCreditFromPreSale = async (preSale, createdBy) => {
  if (!preSale?.id) throw new Error('Pre-venta inválida');

  const creditRef = firestore().collection('credits').doc();
  const preSaleRef = firestore().collection('presales').doc(preSale.id);
  const total = Number(preSale.total) || 0;
  const customerName = preSale.customerName || preSale.customer?.firstName || 'Cliente';
  const customerId = preSale.customerId || preSale.customer?.id || null;

  const batch = firestore().batch();
  batch.set(creditRef, {
    preSaleId: preSale.id,
    customerId,
    customerName,
    total,
    paid: 0,
    pending: total,
    status: 'pending',
    createdAt: new Date(),
    createdBy: createdBy || 'N/A',
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
