import { firestore, auth } from '../../../services/firebaseConfig';
import { CATEGORY_LABELS } from '../utils/expenseLabels';
import { captureError } from '../../../services/errorMonitoring';
import { ensureOpenTurno } from '../../cashClosing/services/cashClosingService';

// Gastos operativos (combustible, viáticos, etc.). Cada usuario registra los
// suyos; no hay aprobación previa obligatoria (STEP 5 de FASE E1) — el gasto
// existe apenas se crea, la revisión del admin es posterior y no bloquea el
// registro. La asociación con un cashClosing (cashClosingId null→id) la
// escribe closeTurno() en una fase futura (E3) — E1 solo deja el campo listo.

const expensesRef = () => firestore().collection('expenses');
const reimbursementsRef = () => firestore().collection('reimbursements');

export const EXPENSE_CATEGORIES = ['FUEL', 'VIATICOS', 'FOOD', 'MAINTENANCE', 'TOLL', 'PARKING', 'OTHER'];
export const PAYMENT_METHODS = ['CASH', 'TRANSFER', 'CARD', 'PERSONAL'];

/** Pura: valida un borrador de gasto antes de escribirlo. Testeable sin Firestore. */
export function validateExpenseDraft({ amount, category, paymentMethod, receipt } = {}) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, message: 'El monto debe ser un número mayor que cero.' };
  }
  if (!EXPENSE_CATEGORIES.includes(category)) {
    return { ok: false, message: 'Categoría de gasto inválida.' };
  }
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    return { ok: false, message: 'Método de pago inválido.' };
  }
  if (!receipt || !receipt.url || !receipt.path) {
    return { ok: false, message: 'El comprobante (foto) es obligatorio para registrar un gasto.' };
  }
  return { ok: true };
}

/**
 * Pura: determina el efecto de un gasto sobre el efectivo. Solo CASH reduce
 * caja; PERSONAL genera una obligación de reembolso; TRANSFER/CARD no tocan
 * ninguno de los dos (quedan solo para reporting, en una fase futura).
 */
export function computeCashImpact({ amount, paymentMethod }) {
  const value = Number(amount) || 0;
  if (paymentMethod === 'CASH') {
    return { affectsCash: true, cashAmount: value, reimbursementAmount: 0 };
  }
  if (paymentMethod === 'PERSONAL') {
    return { affectsCash: false, cashAmount: 0, reimbursementAmount: value };
  }
  return { affectsCash: false, cashAmount: 0, reimbursementAmount: 0 };
}

/** Pura: el creador puede cancelar solo mientras sigue PENDING y sin cierre asignado. */
export function canCancelExpense(expense, uid) {
  return !!expense
    && expense.createdByUid === uid
    && expense.status === 'PENDING'
    && expense.cashClosingId == null;
}

/**
 * Pura: determina si `expense` puede transicionar a `nextStatus`.
 *   PENDING  → APPROVED | REJECTED (revisión inicial).
 *   APPROVED → REJECTED únicamente (rechazo administrativo posterior — FASE
 *     E6.3.1, decisión del propietario: APPROVED ya no es terminal, pero
 *     nunca vuelve a APPROVED ni a CANCELLED).
 *   REJECTED / CANCELLED: terminales, ninguna transición.
 */
export function canReviewExpense(expense, nextStatus) {
  if (!expense || (nextStatus !== 'APPROVED' && nextStatus !== 'REJECTED')) return false;
  if (expense.status === 'PENDING') return true;
  if (expense.status === 'APPROVED') return nextStatus === 'REJECTED';
  return false;
}

/**
 * Crea el gasto. `receipt` debe venir ya subido a Storage (ver
 * expenseReceiptsService.uploadExpenseReceipt) — este servicio no sube fotos,
 * solo persiste su metadato, misma separación que receptionService/
 * invoicePhotosService.
 */
export const createExpense = async ({
  amount,
  category,
  description = null,
  paymentMethod,
  routeId = null,
  receipt,
  createdByUid,
}) => {
  const validation = validateExpenseDraft({ amount, category, paymentMethod, receipt });
  if (!validation.ok) throw new Error(validation.message);
  if (!createdByUid) throw new Error('Usuario inválido.');

  const { affectsCash, reimbursementAmount } = computeCashImpact({ amount, paymentMethod });
  const ref = expensesRef().doc();

  await ref.set({
    amount: Number(amount),
    category,
    description: description || null,
    paymentMethod,
    status: 'PENDING',
    createdByUid,
    createdAt: firestore.FieldValue.serverTimestamp(),
    receipt: { url: receipt.url, path: receipt.path, uploadedAt: receipt.uploadedAt || null },
    cashClosingId: null,
    routeId: routeId || null,
    reviewedByUid: null,
    reviewedAt: null,
    reimbursement: paymentMethod === 'PERSONAL'
      ? { status: 'PENDING', amount: reimbursementAmount, paidAt: null }
      : null,
  });

  // Cierre de Caja: un gasto en efectivo SÍ es salida de dinero, así que abre
  // turno solo si no hay uno. TRANSFER/CARD/PERSONAL no tocan la caja
  // (computeCashImpact) y por eso no llegan aquí. No debe tumbar el gasto ya
  // registrado si esto falla: el gasto queda elegible igual y el próximo
  // cierre lo recoge.
  if (affectsCash) {
    try {
      await ensureOpenTurno({
        uid: createdByUid,
        userName: auth()?.currentUser?.email || createdByUid,
        role: null,
      });
    } catch (turnoError) {
      captureError(turnoError, { scope: 'expenseService.ensureOpenTurno', expenseId: ref.id });
    }
  }

  return ref.id;
};

export const getExpense = async (expenseId) => {
  const snap = await expensesRef().doc(expenseId).get();
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const getMyExpenses = async (uid) => {
  const snap = await expensesRef().where('createdByUid', '==', uid).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/** Admin: todos los gastos a la espera de revisión, de cualquier usuario. */
export const getPendingExpensesForReview = async () => {
  const snap = await expensesRef().where('status', '==', 'PENDING').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * En vivo: gastos CASH del usuario todavía sin liquidar (candidatos para el
 * próximo cierre — FASE E3). Solo equality filters (createdByUid,
 * paymentMethod, cashClosingId) — no necesita índice compuesto, mismo
 * criterio que subscribeMyUnclaimedCollections. El filtro de status
 * (PENDING|APPROVED) se aplica en cliente para no depender de `in` + índice.
 * closeTurno() releé cada candidato por su ref dentro de la transacción —
 * esta lista nunca es la fuente de verdad final.
 */
export const subscribeMyEligibleCashExpenses = (uid, onUpdate, onError) =>
  expensesRef()
    .where('createdByUid', '==', uid)
    .where('paymentMethod', '==', 'CASH')
    .where('cashClosingId', '==', null)
    .onSnapshot(
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((e) => e.status === 'PENDING' || e.status === 'APPROVED');
        onUpdate(list);
      },
      (error) => {
        console.error('[expenseService] subscribeMyEligibleCashExpenses:', error);
        onError?.(error);
        onUpdate([]);
      },
    );

/**
 * En vivo: los gastos CASH sin liquidar de TODOS los usuarios. Es la versión
 * sin `createdByUid` de subscribeMyEligibleCashExpenses, para que el panel del
 * admin muestre el egreso de cada caja abierta con una sola suscripción.
 * `expenses.read` exige isAdmin() para ver los ajenos: en un no-admin esta
 * query se deniega y la lista queda vacía, sin romper la pantalla.
 */
export const subscribeAllEligibleCashExpenses = (onUpdate, onError) =>
  expensesRef()
    .where('paymentMethod', '==', 'CASH')
    .where('cashClosingId', '==', null)
    .onSnapshot(
      (snap) => onUpdate(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((e) => e.status === 'PENDING' || e.status === 'APPROVED'),
      ),
      (error) => {
        console.error('[expenseService] subscribeAllEligibleCashExpenses:', error);
        onError?.(error);
        onUpdate([]);
      },
    );

/** Releé antes de cancelar — mismo patrón que closeTurno/reviewTurno. */
export const cancelExpense = async (expenseId, uid) => {
  const ref = expensesRef().doc(expenseId);
  return firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('El gasto ya no existe.');
    if (!canCancelExpense(snap.data(), uid)) {
      throw new Error('Este gasto ya no se puede cancelar.');
    }
    tx.update(ref, { status: 'CANCELLED' });
  });
};

/**
 * Admin aprueba/rechaza. Transición única e irreversible — releé antes de
 * decidir. Si se rechaza un gasto CASH que YA fue liquidado (cashClosingId
 * != null), el Cash Closing histórico NUNCA se toca (FASE E1.1 §7 / E3.0
 * §6) — en su lugar se crea una compensación en deliveryShortages, con id
 * determinístico para que un reintento de esta misma operación no genere una
 * segunda deuda (FASE E3 §19).
 *
 * Al APROBAR (cualquier método de pago), se crea además un espejo en
 * `financials` con id determinístico `expense-{expenseId}` (FASE E4.0/E4) —
 * representa "este gasto quedó confirmado" para el reporte financiero, nunca
 * "salió efectivo de caja" (eso ya lo resuelve Cash Closing en E3, sin leer
 * financials). Por eso el espejo solo se crea al aprobar y nunca al crear el
 * gasto: si se creara en PENDING y luego se rechazara, quedaría un
 * `financials` incorregible (la colección es inmutable — `update`/`delete`
 * siempre `false`).
 *
 * FASE E6.1: si el gasto es PERSONAL, la revisión también gobierna
 * `reimbursements/{expenseId}` (id determinístico, igual criterio que
 * `financials`):
 *   - APPROVED → nace la obligación en PENDING (nunca antes: E6.0 §7 decidió
 *     que el reembolso solo existe una vez aprobado el gasto).
 *   - REJECTED con reembolso todavía PENDING → se cancela automáticamente
 *     (ya no hay gasto que reembolsar). Si ya estaba CANCELLED, no-op.
 *   - REJECTED con reembolso ya PAID (FASE E6.2, decisión del propietario):
 *     el pago NO se revierte, el `cashOutflow`/`financials` históricos no se
 *     tocan — en su lugar nace una compensación en `deliveryShortages` (mismo
 *     mecanismo ya usado por E3 para CASH liquidado y luego rechazado): el
 *     empleado ahora le debe a la empresa el monto que ya recibió.
 *
 * FASE E6.3.1: `canReviewExpense` ahora también permite APPROVED → REJECTED
 * (rechazo posterior a la aprobación, incluso si ya se pagó el reembolso —
 * decisión del propietario, E6.3.0 había detectado que esa rama de código
 * era inalcanzable). No cambia ningún otro comportamiento: el mismo bloque
 * de compensación de arriba, sin modificar, ahora sí se alcanza de verdad.
 */
export const reviewExpense = async (expenseId, decision, reviewerUid) => {
  if (decision !== 'APPROVED' && decision !== 'REJECTED') {
    throw new Error('Decisión de revisión inválida.');
  }
  const ref = expensesRef().doc(expenseId);
  const compensationRef = firestore().collection('deliveryShortages').doc(`expense-rejected-${expenseId}`);
  const financialRef = firestore().collection('financials').doc(`expense-${expenseId}`);
  const reimbursementRef = reimbursementsRef().doc(expenseId);
  const paidRejectionCompensationRef = firestore().collection('deliveryShortages').doc(`reimbursement-rejected-${expenseId}`);

  const result = await firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('El gasto ya no existe.');
    const data = snap.data();
    if (!canReviewExpense(data, decision)) {
      throw new Error('Este gasto ya fue revisado.');
    }

    const needsCompensation = decision === 'REJECTED'
      && data.paymentMethod === 'CASH'
      && data.cashClosingId != null;
    const needsFinancial = decision === 'APPROVED';
    const isPersonal = data.paymentMethod === 'PERSONAL';
    const needsReimbursement = needsFinancial && isPersonal;
    const needsReimbursementCancel = decision === 'REJECTED' && isPersonal;

    // Todas las lecturas antes de cualquier escritura (requisito de Firestore).
    const compensationSnap = needsCompensation ? await tx.get(compensationRef) : null;
    const financialSnap = needsFinancial ? await tx.get(financialRef) : null;
    const reimbursementSnap = (needsReimbursement || needsReimbursementCancel)
      ? await tx.get(reimbursementRef)
      : null;
    const reimbursementIsPaid = needsReimbursementCancel
      && !!reimbursementSnap?.exists()
      && reimbursementSnap.data().status === 'PAID';
    const paidRejectionSnap = reimbursementIsPaid
      ? await tx.get(paidRejectionCompensationRef)
      : null;
    // Caso C (FASE E6.3.1): un Expense APPROVED con reimbursement ya
    // CANCELLED es una combinación que el propio flujo nunca produce (un
    // reimbursement solo se cancela en la misma transacción que rechaza el
    // Expense) — si aparece, es un dato inconsistente ajeno a esta operación.
    // No se inventa deuda ni se toca nada: solo se reporta, fuera de la
    // transacción (ver abajo), para no arriesgar un reintento espurio.
    const reimbursementInconsistentCancelled = needsReimbursementCancel
      && !!reimbursementSnap?.exists()
      && reimbursementSnap.data().status === 'CANCELLED';

    if (needsCompensation && !compensationSnap.exists()) {
      tx.set(compensationRef, {
        expenseId,
        cashClosingId: data.cashClosingId,
        reason: 'expense_rejected_post_close',
        entregadorId: data.createdByUid,
        totalMissingValue: data.amount,
        status: 'pending',
        recordedAt: firestore.FieldValue.serverTimestamp(),
      });
    }

    if (needsFinancial && !financialSnap.exists()) {
      const label = data.description || CATEGORY_LABELS[data.category] || data.category;
      tx.set(financialRef, {
        type: 'expense',
        amount: data.amount,
        description: label,
        concept: label,
        category: data.category,
        paymentMethod: data.paymentMethod,
        expenseId,
        createdByUid: data.createdByUid,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
    }

    if (needsReimbursement && !reimbursementSnap.exists()) {
      tx.set(reimbursementRef, {
        expenseId,
        createdByUid: data.createdByUid,
        amount: data.amount,
        status: 'PENDING',
        createdAt: firestore.FieldValue.serverTimestamp(),
        paidAt: null,
        paidByUid: null,
        cancelledAt: null,
        cancelledByUid: null,
        paymentMethod: null,
        notes: null,
      });
    }

    if (needsReimbursementCancel && reimbursementSnap.exists() && reimbursementSnap.data().status === 'PENDING') {
      tx.update(reimbursementRef, {
        status: 'CANCELLED',
        cancelledAt: firestore.FieldValue.serverTimestamp(),
        cancelledByUid: reviewerUid,
      });
    }

    if (reimbursementIsPaid && !paidRejectionSnap.exists()) {
      tx.set(paidRejectionCompensationRef, {
        expenseId,
        reason: 'reimbursement_rejected_post_paid',
        entregadorId: data.createdByUid,
        totalMissingValue: reimbursementSnap.data().amount,
        status: 'pending',
        recordedAt: firestore.FieldValue.serverTimestamp(),
      });
    }

    tx.update(ref, {
      status: decision,
      reviewedByUid: reviewerUid,
      reviewedAt: firestore.FieldValue.serverTimestamp(),
    });

    return { reimbursementInconsistentCancelled };
  });

  if (result?.reimbursementInconsistentCancelled) {
    captureError(
      new Error('reviewExpense: reimbursement CANCELLED en un Expense APPROVED al rechazar — dato inconsistente, no se generó deuda.'),
      { expenseId },
    );
  }
};
