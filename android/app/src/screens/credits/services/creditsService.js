import { firestore, auth } from '../../../services/firebaseConfig';
import { getAggregateFromServer, sum } from '@react-native-firebase/firestore';
import { computeAbono } from '../../../utils/creditUtils';
import { TERMINAL_PRESALE_STATUSES } from '../../../services/preSaleService';

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

/** 🧾 Obtener lista de créditos en tiempo real.
 *  `status` va al query en vez de filtrarse en JS, y `limit` acota la lista:
 *  `credits` solo crece y antes se transfería entera para mostrar una pantalla.
 *  Los totales NO salen de aquí (serían parciales): ver getCreditTotals(). */
export const fetchCredits = (onUpdate, { status = null, limit = 100 } = {}, onError = null) => {
  let query = firestore().collection('credits');
  if (status) query = query.where('status', '==', status);

  return query
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .onSnapshot(
      snapshot => {
        const data = (snapshot?.docs || []).map(doc => {
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
      },
      // Sin este callback, un fallo del query (índice en construcción, permisos)
      // no llamaba a onUpdate NUNCA: la pantalla se quedaba en "Cargando créditos..."
      // para siempre, sin lista y sin mensaje. Ahora el error se propaga a la UI.
      error => {
        console.error('[creditsService] fetchCredits:', error);
        onError?.(error);
      },
    );
};

/** 💰 Totales de créditos, sumados EN EL SERVIDOR.
 *
 *  Antes se calculaban en JS sobre la colección completa ya descargada. Al acotar
 *  la lista eso daría totales silenciosamente incorrectos — y son montos de dinero.
 *  Un agregado no descarga los documentos: cuesta una fracción de lectura y el
 *  resultado es exacto sobre toda la colección, no sobre la página visible.
 */
export const getCreditTotals = async () => {
  const credits = firestore().collection('credits');

  try {
    const [paidSnap, pendingSnap] = await Promise.all([
      getAggregateFromServer(credits.where('status', '==', 'paid'), { value: sum('total') }),
      getAggregateFromServer(credits.where('status', '==', 'pending'), { value: sum('pending') }),
    ]);

    return {
      paid: paidSnap.data().value || 0,
      pending: pendingSnap.data().value || 0,
    };
  } catch (error) {
    console.error('[creditsService] getCreditTotals:', error);
    // `null`, no 0: son montos de dinero. Un C$0.00 inventado hace creer que no
    // hay saldo pendiente; la UI muestra "—" cuando el dato no está disponible.
    return { paid: null, pending: null, error };
  }
};

/** 💵 Registrar abono y guardar historial.
 *  Acepta pagos mayores al saldo: aplica solo el pendiente y devuelve el cambio. */
export const abonarCredito = async (creditId, amount, userEmail) => {
  const safeCreditId = sanitizeDocId(creditId);
  if (!safeCreditId) {
    throw new Error('Crédito inválido: id no válido.');
  }

  const now = new Date();
  const nowTs = firestore.Timestamp.fromDate(now);
  const fallbackUser = auth()?.currentUser?.email || auth()?.currentUser?.displayName || null;
  const paymentActor = (typeof userEmail === 'string' && userEmail.trim()) ? userEmail.trim() : (fallbackUser || 'N/A');
  const creditRef = firestore().collection('credits').doc(safeCreditId);
  let result = null;

  await firestore().runTransaction(async (tx) => {
    const creditSnap = await tx.get(creditRef);
    if (!creditSnap.exists()) {
      throw new Error('El crédito no existe o fue eliminado.');
    }

    const creditData = creditSnap.data() || {};
    const abonoCalc = computeAbono(creditData, amount);

    const abono = {
      amount: abonoCalc.applied,
      date: nowTs,
      by: paymentActor,
      previousPending: abonoCalc.previousPending,
      newPending: abonoCalc.newPending,
    };
    if (abonoCalc.change > 0) {
      abono.received = abonoCalc.received;
      abono.change = abonoCalc.change;
    }

    const preSaleRawId = creditData?.preSaleId || creditData?.presaleId || null;
    const preSaleId = sanitizeDocId(preSaleRawId);

    tx.update(creditRef, {
      paid: abonoCalc.newPaid,
      pending: abonoCalc.newPending,
      status: abonoCalc.status,
      updatedAt: nowTs,
      payments: firestore.FieldValue.arrayUnion(abono),
    });

    // Nota: la actualización de preventa se realiza fuera de la transacción para
    // no bloquear el abono por datos legacy inconsistentes en preSaleId.

    result = {
      nuevoPagado: abonoCalc.newPaid,
      nuevoPendiente: abonoCalc.newPending,
      estado: abonoCalc.status,
      appliedAmount: abonoCalc.applied,
      change: abonoCalc.change,
      linkedPreSaleId: preSaleId || null,
    };
  });

  if (result?.estado === 'paid' && result?.linkedPreSaleId) {
    try {
      // Transacción propia (fuera del abono, que no debe bloquearse por datos
      // legacy de preSaleId): relee el estado real antes de marcar 'paid'. Sin
      // esto, un abono reproducido desde la cola offline podía reescribir una
      // preventa que mientras tanto fue cancelada o devuelta — el mismo patrón
      // que regresaba facturas cobradas a "pendiente".
      const preSaleRef = firestore().collection('presales').doc(result.linkedPreSaleId);
      await firestore().runTransaction(async (tx) => {
        const snap = await tx.get(preSaleRef);
        if (!snap.exists()) return;
        const currentStatus = snap.data()?.status;
        if (currentStatus === 'paid') return; // ya reflejaba el saldo: reintento idempotente
        if (TERMINAL_PRESALE_STATUSES.has(currentStatus)) {
          throw new Error(`La pre-venta está en estado terminal incompatible: ${currentStatus}`);
        }
        tx.update(preSaleRef, { status: 'paid', fechaPago: nowTs, updatedAt: nowTs });
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

/** 🧾 Crear crédito desde una pre-venta.
 *  options.dueDate: fecha de pago acordada con el cliente (Date|Timestamp). */
export const createCreditFromPreSale = async (preSale, createdBy, options = {}) => {
  if (!preSale?.id) throw new Error('Pre-venta inválida');

  const creditRef = firestore().collection('credits').doc();
  const preSaleRef = firestore().collection('presales').doc(preSale.id);
  const total = Number(preSale.total) || 0;
  const customerName = buildCustomerNameFromPreSale(preSale);
  const customerId = preSale.customerId || preSale.customer?.id || null;
  const rawDueDate = options.dueDate || preSale.creditDueDate || null;
  const dueDate = rawDueDate ? toFirestoreTimestamp(rawDueDate) : null;

  const actor = (typeof createdBy === 'string' && createdBy.trim())
    ? createdBy.trim()
    : (auth()?.currentUser?.email || auth()?.currentUser?.displayName || 'N/A');

  // Usar transacción para validar el estado actual antes de sobreescribir
  await firestore().runTransaction(async (tx) => {
    const preSaleSnap = await tx.get(preSaleRef);

    if (!preSaleSnap.exists()) {
      throw new Error('La pre-venta no existe o ya fue eliminada.');
    }

    const currentStatus = preSaleSnap.data()?.status;

    if (currentStatus === 'paid') {
      throw new Error('Esta pre-venta ya fue pagada. No se puede crear un crédito.');
    }
    if (currentStatus === 'cancelled') {
      throw new Error('No se puede crear un crédito para una pre-venta cancelada.');
    }
    if (currentStatus === 'credit_pending' || currentStatus?.startsWith('credit_')) {
      throw new Error('Esta pre-venta ya tiene un crédito asignado.');
    }
    if (!['pending', 'dispatched'].includes(currentStatus)) {
      throw new Error(`Estado inválido para crear crédito: ${currentStatus}.`);
    }

    tx.set(creditRef, {
      preSaleId: preSale.id,
      customerId,
      customerName,
      clientName: customerName,
      dueDate,
      total,
      paid: 0,
      pending: total,
      status: 'pending',
      createdAt: new Date(),
      createdBy: actor,
    });

    tx.update(preSaleRef, {
      status: 'credit_pending',
      creditId: creditRef.id,
      creditDueDate: dueDate,
      updatedAt: new Date(),
    });
  });

  return creditRef.id;
};

/** ❌ Eliminar crédito */
export const eliminarCredito = async (creditId) => {
  await firestore().collection('credits').doc(creditId).delete();
};
