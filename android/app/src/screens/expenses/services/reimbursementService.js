import { firestore } from '../../../services/firebaseConfig';

// Lectura y pago del reembolso de un Expense PERSONAL. La CREACIÓN de la
// obligación vive en expenseService.reviewExpense() (nace al aprobar, mismo
// patrón que el espejo en `financials`, FASE E4/E6.1). El PAGO (FASE E6.2) es
// un evento independiente, disparado por una acción administrativa distinta
// (no la revisión del gasto), por eso vive en su propio servicio.

const expensesRef = () => firestore().collection('expenses');
const reimbursementsRef = () => firestore().collection('reimbursements');
const cashOutflowsRef = () => firestore().collection('cashOutflows');

export const REIMBURSEMENT_STATUSES = ['PENDING', 'PAID', 'CANCELLED'];
export const REIMBURSEMENT_PAYMENT_METHODS = ['CASH', 'TRANSFER'];

export const getReimbursement = async (expenseId) => {
  const snap = await reimbursementsRef().doc(expenseId).get();
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

/**
 * Pura: valida los datos de pago antes de escribir. TRANSFER exige
 * `reference`; CASH no exige ninguna evidencia adicional (decisión del
 * propietario, FASE E6.2 — la confirmación del admin basta).
 */
export function validatePaymentData({ paymentMethod, reference } = {}) {
  if (!REIMBURSEMENT_PAYMENT_METHODS.includes(paymentMethod)) {
    return { ok: false, message: 'Método de pago inválido.' };
  }
  if (paymentMethod === 'TRANSFER' && !reference?.trim()) {
    return { ok: false, message: 'La referencia de la transferencia es obligatoria.' };
  }
  return { ok: true };
}

/**
 * Marca un reembolso PENDING como PAID y crea su registro de salida de
 * efectivo (`cashOutflows/{expenseId}`, id determinístico — mismo criterio
 * que `financials`/`reimbursements`). Transaccional: releé Expense (debe
 * seguir PERSONAL+APPROVED) y Reimbursement (debe seguir PENDING) antes de
 * escribir — un reintento o un segundo admin pagando en simultáneo encuentra
 * `status !== 'PENDING'` y aborta, sin duplicar el pago (FASE E6.2.0 §17/§18).
 *
 * `amount` nunca lo aporta el llamador: siempre se toma del `reimbursement`
 * ya releído dentro de la transacción, así que un "amount mismatch" queda
 * estructuralmente imposible a este nivel — la verificación de Rules es
 * la capa de defensa adicional, no la única.
 *
 * No crea ningún `financials` (FASE E6.2.0 §10): el gasto económico ya está
 * contado desde la aprobación del Expense; esto es solo el movimiento de caja.
 */
export const payReimbursement = async (expenseId, { paymentMethod, reference = null, notes = null, paidByUid } = {}) => {
  const validation = validatePaymentData({ paymentMethod, reference });
  if (!validation.ok) throw new Error(validation.message);
  if (!paidByUid) throw new Error('Usuario inválido.');

  const expenseRef = expensesRef().doc(expenseId);
  const reimbursementRef = reimbursementsRef().doc(expenseId);
  const cashOutflowRef = cashOutflowsRef().doc(expenseId);

  return firestore().runTransaction(async (tx) => {
    // Todas las lecturas antes de cualquier escritura (requisito de Firestore).
    const [expenseSnap, reimbursementSnap, outflowSnap] = await Promise.all([
      tx.get(expenseRef),
      tx.get(reimbursementRef),
      tx.get(cashOutflowRef),
    ]);

    if (!expenseSnap.exists()) throw new Error('El gasto ya no existe.');
    const expense = expenseSnap.data();
    if (expense.paymentMethod !== 'PERSONAL') {
      throw new Error('Este gasto no genera obligación de reembolso.');
    }
    if (expense.status !== 'APPROVED') {
      throw new Error('El gasto debe estar aprobado para pagar su reembolso.');
    }

    if (!reimbursementSnap.exists()) throw new Error('El reembolso no existe.');
    const reimbursement = reimbursementSnap.data();
    if (reimbursement.status !== 'PENDING') {
      throw new Error('Este reembolso ya no está pendiente de pago.');
    }

    // FASE E6.3.1: un admin no puede pagarse su propio reembolso (protección
    // contra auto-pago) — validado también en Rules, no solo aquí.
    if (reimbursement.createdByUid === paidByUid) {
      throw new Error('Un administrador no puede pagar su propio reembolso.');
    }

    if (outflowSnap.exists()) throw new Error('Este reembolso ya fue pagado.');

    const payload = {
      paidAt: firestore.FieldValue.serverTimestamp(),
      paidByUid,
      paymentMethod,
      reference: reference?.trim() || null,
      notes: notes?.trim() || null,
    };

    tx.set(cashOutflowRef, {
      expenseId,
      amount: reimbursement.amount,
      ...payload,
    });
    tx.update(reimbursementRef, { status: 'PAID', ...payload });
  });
};

export const getCashOutflow = async (expenseId) => {
  const snap = await cashOutflowsRef().doc(expenseId).get();
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};
