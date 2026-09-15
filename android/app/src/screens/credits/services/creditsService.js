import { firestore, auth } from '../../../services/firebaseConfig';
import { computeAbono } from '../../../utils/creditUtils';
import { NON_PAYABLE_PRESALE_STATUSES } from '../../../services/preSaleService';
import {
  sanitizeDocId,
  assertCreditIdValid,
  assertPreSaleCreditable,
  assertCreditDeletable,
  resolvePreSaleRevertStatus,
  buildCustomerNameFromPreSale,
  toFirestoreTimestamp,
} from './creditsValidation';

// Lecturas: ver creditsRepository.js (queries, agregados, listener en tiempo
// real). Este archivo solo orquesta las operaciones que cambian datos.
export { fetchCredits, getCreditTotals, getCustomerOutstandingCredit } from './creditsRepository';

/** Actor a registrar en el crédito/abono: el email explícito o el usuario logueado. */
const resolveActor = (explicit) => {
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim();
  return auth()?.currentUser?.email || auth()?.currentUser?.displayName || 'N/A';
};

const buildAbonoRecord = (abonoCalc, nowTs, paymentActor) => {
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
  return abono;
};

async function applyAbonoTransaction(creditRef, amount, paymentActor, nowTs) {
  let result = null;
  await firestore().runTransaction(async (tx) => {
    const creditSnap = await tx.get(creditRef);
    if (!creditSnap.exists()) throw new Error('El crédito no existe o fue eliminado.');

    const creditData = creditSnap.data() || {};
    const abonoCalc = computeAbono(creditData, amount);
    const preSaleId = sanitizeDocId(creditData?.preSaleId || creditData?.presaleId || null);

    tx.update(creditRef, {
      paid: abonoCalc.newPaid,
      pending: abonoCalc.newPending,
      status: abonoCalc.status,
      updatedAt: nowTs,
      payments: firestore.FieldValue.arrayUnion(buildAbonoRecord(abonoCalc, nowTs, paymentActor)),
    });

    result = {
      nuevoPagado: abonoCalc.newPaid,
      nuevoPendiente: abonoCalc.newPending,
      estado: abonoCalc.status,
      appliedAmount: abonoCalc.applied,
      change: abonoCalc.change,
      linkedPreSaleId: preSaleId || null,
    };
  });
  return result;
}

/**
 * Fuera de la transacción del abono a propósito: no debe bloquearse por datos
 * legacy inconsistentes en preSaleId. Relee el estado real antes de marcar
 * 'paid' para no reescribir una preventa que mientras tanto fue cancelada o
 * devuelta — el mismo bug que regresaba facturas cobradas a "pendiente".
 */
async function syncLinkedPreSaleAfterPayment(result, safeCreditId, nowTs) {
  try {
    const preSaleRef = firestore().collection('presales').doc(result.linkedPreSaleId);
    await firestore().runTransaction(async (tx) => {
      const snap = await tx.get(preSaleRef);
      if (!snap.exists()) return;
      const currentStatus = snap.data()?.status;
      if (currentStatus === 'paid') return; // ya reflejaba el saldo: reintento idempotente
      // El crédito por cobrar vive en 'dispatched'/'credit_dispatched': esos SÍ
      // deben poder pasar a 'paid'. Solo se bloquean los estados donde ya no hay
      // deuda que saldar o donde el estado codifica una devolución.
      if (NON_PAYABLE_PRESALE_STATUSES.has(currentStatus)) {
        throw new Error(`La pre-venta está en un estado que no admite cobro: ${currentStatus}`);
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

/** Registrar abono y guardar historial.
 *  Acepta pagos mayores al saldo: aplica solo el pendiente y devuelve el cambio. */
export const abonarCredito = async (creditId, amount, userEmail) => {
  const safeCreditId = assertCreditIdValid(creditId);
  const nowTs = firestore.Timestamp.fromDate(new Date());
  const paymentActor = resolveActor(userEmail);
  const creditRef = firestore().collection('credits').doc(safeCreditId);

  const result = await applyAbonoTransaction(creditRef, amount, paymentActor, nowTs);

  if (result?.estado === 'paid' && result?.linkedPreSaleId) {
    await syncLinkedPreSaleAfterPayment(result, safeCreditId, nowTs);
  }

  return result;
};

const buildCreditPayload = ({ preSale, customerId, customerName, dueDate, total, actor }) => ({
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
  // null si aún no se despachó; dispatchPreSale lo completa al asignar entregador.
  entregadorId: preSale.entregadorId || null,
});

/** Crear crédito desde una pre-venta.
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
  const actor = resolveActor(createdBy);

  // Transacción: valida el estado actual antes de sobreescribir.
  await firestore().runTransaction(async (tx) => {
    const preSaleSnap = await tx.get(preSaleRef);
    if (!preSaleSnap.exists()) throw new Error('La pre-venta no existe o ya fue eliminada.');
    assertPreSaleCreditable(preSaleSnap.data()?.status);

    tx.set(creditRef, buildCreditPayload({ preSale, customerId, customerName, dueDate, total, actor }));
    tx.update(preSaleRef, {
      status: 'credit_pending',
      creditId: creditRef.id,
      creditDueDate: dueDate,
      updatedAt: new Date(),
    });
  });

  return creditRef.id;
};

async function readLinkedPreSale(tx, creditData) {
  const preSaleId = sanitizeDocId(creditData.preSaleId || creditData.presaleId);
  if (!preSaleId) return null;
  const ref = firestore().collection('presales').doc(preSaleId);
  const snap = await tx.get(ref);
  return snap.exists() ? { ref, status: snap.data()?.status } : null;
}

/**
 * Eliminar crédito y devolver su pre-venta a contado.
 *
 * Antes era un `.delete()` suelto: el crédito desaparecía y la pre-venta se
 * quedaba en 'credit_pending' apuntando a un `creditId` que ya no existía.
 * Peor: en ese estado createCreditFromPreSale la rechaza ("ya tiene un crédito
 * asignado"), así que la orden quedaba trabada para siempre, sin cuenta por
 * cobrar y sin posibilidad de volver a generarla.
 */
export const eliminarCredito = async (creditId) => {
  const safeCreditId = assertCreditIdValid(creditId);
  const creditRef = firestore().collection('credits').doc(safeCreditId);

  await firestore().runTransaction(async (tx) => {
    const creditSnap = await tx.get(creditRef);
    if (!creditSnap.exists()) return; // ya no existe: reintento idempotente

    const creditData = creditSnap.data() || {};
    assertCreditDeletable(Number(creditData.paid) || 0);

    // Los créditos de venta rápida guardan `saleId` y no tienen pre-venta que
    // revertir: en ese caso solo se borra el documento.
    const linkedPreSale = await readLinkedPreSale(tx, creditData);
    if (linkedPreSale) {
      tx.update(linkedPreSale.ref, {
        status: resolvePreSaleRevertStatus(linkedPreSale.status),
        paymentMethod: 'cash',
        creditId: firestore.FieldValue.delete(),
        creditDueDate: null,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    }

    tx.delete(creditRef);
  });
};
