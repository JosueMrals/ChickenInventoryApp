import { firestore, auth } from '../../../services/firebaseConfig';

// Cierre de Caja: cada cobro (entrega o abono de crédito) cae en
// `cashCollections` con `turnoId: null`. El vendedor/entregador/admin abre un
// turno, cobra durante el día y al cerrarlo reclama esos cobros dentro de un
// `cashClosings`. El faltante, si lo hay, se registra en `deliveryShortages`
// (la misma colección que ya usa Nómina) para que se descuente en su próximo
// pago — ver android/app/src/screens/payroll/types.ts.

const collectionsRef = () => firestore().collection('cashCollections');
const closingsRef = () => firestore().collection('cashClosings');
const expensesRef = () => firestore().collection('expenses');

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const money = (value) => Number(value.toFixed(2));

/** Suma pura de los cobros de un turno. Testeable sin Firestore. */
export const sumCollections = (collections) =>
  money((collections || []).reduce((sum, c) => sum + toNumber(c.amount), 0));

/**
 * Cuánto queda pendiente al revisar un turno. Pura: separada de reviewTurno
 * para poder probarla sin mockear Firestore.
 */
export const computeReviewOutcome = (expectedAmount, shortageAmountInput) => {
  const expected = toNumber(expectedAmount);
  const shortageAmount = money(Math.min(Math.max(toNumber(shortageAmountInput), 0), expected));
  const receivedAmount = money(expected - shortageAmount);
  return { receivedAmount, shortageAmount, isComplete: shortageAmount <= 0 };
};

export const subscribeMyOpenTurno = (uid, onUpdate, onError) =>
  closingsRef()
    .where('uid', '==', uid)
    .where('status', '==', 'open')
    .limit(1)
    .onSnapshot(
      (snap) => onUpdate(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }),
      (error) => {
        console.error('[cashClosingService] subscribeMyOpenTurno:', error);
        onError?.(error);
        onUpdate(null);
      },
    );

export const subscribeMyUnclaimedCollections = (uid, onUpdate, onError) =>
  collectionsRef()
    .where('uid', '==', uid)
    .where('turnoId', '==', null)
    .onSnapshot(
      (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (error) => {
        console.error('[cashClosingService] subscribeMyUnclaimedCollections:', error);
        onError?.(error);
        onUpdate([]);
      },
    );

const findOpenTurnoId = async (uid) => {
  const existing = await closingsRef().where('uid', '==', uid).where('status', '==', 'open').limit(1).get();
  return existing.empty ? null : existing.docs[0].id;
};

const createTurno = async ({ uid, userName, role }) => {
  const ref = closingsRef().doc();
  await ref.set({
    uid,
    userName,
    role: role || null,
    status: 'open',
    openedAt: firestore.FieldValue.serverTimestamp(),
    closedAt: null,
    collectionIds: [],
    expectedAmount: 0,
    cashExpensesTotal: 0,
    receivedAmount: null,
    shortageAmount: 0,
    reviewedAt: null,
    reviewedBy: null,
    shortageId: null,
  });
  return ref.id;
};

/** Abrir turno a mano: falla si ya hay uno abierto para ese usuario. */
export const openTurno = async ({ uid, userName, role }) => {
  if (!uid) throw new Error('Usuario inválido.');
  if (await findOpenTurnoId(uid)) throw new Error('Ya tienes un turno abierto.');
  return createTurno({ uid, userName, role });
};

/**
 * Usa el turno abierto si existe, o abre uno nuevo. Se llama en cada cobro
 * (entrega/abono) para que el vendedor/entregador no tenga que acordarse de
 * abrir turno a mano — el primer cobro del día lo abre solo.
 *
 * ponytail: no es transaccional — dos cobros casi simultáneos sin turno
 * previo podrían abrir dos turnos (misma ventana que ya acepta openTurno).
 * Si se vuelve un problema real, mover a una transacción con un id
 * determinístico por uid.
 */
export const ensureOpenTurno = async ({ uid, userName, role }) => {
  if (!uid) return null;
  const existingId = await findOpenTurnoId(uid);
  return existingId || createTurno({ uid, userName, role });
};

// Un gasto CASH sigue elegible si, al releerlo dentro de la transacción,
// todavía no fue liquidado ni decidido en contra, y sigue siendo del dueño
// del turno (nunca se confía en lo que traía la UI — FASE E3 §7).
const isEligibleCashExpense = (snap, uid) => {
  if (!snap.exists()) return false;
  const d = snap.data();
  return d.paymentMethod === 'CASH'
    && d.cashClosingId == null
    && (d.status === 'PENDING' || d.status === 'APPROVED')
    && d.createdByUid === uid;
};

/**
 * Cierra el turno: relee los cobros aún sin reclamar (por si alguno llegó o
 * se reclamó entre lo que mostraba la pantalla y el toque de "Cerrar turno")
 * y los marca con el id de este cierre. El total esperado sale de lo
 * releído, nunca de lo que traía la UI — mismo patrón que settleStaffPeriod.
 *
 * FASE E3: además relee los gastos CASH candidatos (`expenseIds`, reunidos
 * fuera de la transacción por subscribeMyEligibleCashExpenses) y resta su
 * suma de expectedAmount. PENDING participa igual que APPROVED (Modelo A,
 * FASE E1.1) — entrar al cierre no equivale a aprobar el gasto. PERSONAL,
 * CARD y TRANSFER nunca se leen aquí (no son candidatos posibles).
 */
export const closeTurno = async (turno, collectionIds, expenseIds = []) => {
  if (!turno?.id) throw new Error('Turno inválido.');
  const turnoRef = closingsRef().doc(turno.id);
  const collectionRefs = (collectionIds || []).map((id) => collectionsRef().doc(id));
  const expenseRefs = (expenseIds || []).map((id) => expensesRef().doc(id));

  return firestore().runTransaction(async (tx) => {
    const turnoSnap = await tx.get(turnoRef);
    if (!turnoSnap.exists()) throw new Error('El turno ya no existe.');
    if (turnoSnap.data()?.status !== 'open') throw new Error('Este turno ya fue cerrado.');

    // Todas las lecturas antes de cualquier escritura (requisito de Firestore).
    const collectionSnaps = await Promise.all(collectionRefs.map((ref) => tx.get(ref)));
    const expenseSnaps = await Promise.all(expenseRefs.map((ref) => tx.get(ref)));

    const live = collectionSnaps.filter((s) => s.exists() && s.data()?.turnoId == null);
    const collectionsTotal = sumCollections(live.map((s) => s.data()));

    const liveExpenses = expenseSnaps.filter((s) => isEligibleCashExpense(s, turno.uid));
    const cashExpensesTotal = sumCollections(liveExpenses.map((s) => s.data()));

    const total = money(collectionsTotal - cashExpensesTotal);

    tx.update(turnoRef, {
      status: 'pending_review',
      closedAt: firestore.FieldValue.serverTimestamp(),
      collectionIds: live.map((s) => s.id),
      expectedAmount: total,
      cashExpensesTotal,
    });
    live.forEach((snap) => tx.update(snap.ref, { turnoId: turnoRef.id }));
    liveExpenses.forEach((snap) => tx.update(snap.ref, { cashClosingId: turnoRef.id }));

    return { id: turnoRef.id, expectedAmount: total, cashExpensesTotal };
  });
};

export const subscribePendingReview = (onUpdate, onError) =>
  closingsRef()
    .where('status', '==', 'pending_review')
    .onSnapshot(
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.closedAt?.toMillis?.() ?? 0) - (b.closedAt?.toMillis?.() ?? 0));
        onUpdate(list);
      },
      (error) => {
        console.error('[cashClosingService] subscribePendingReview:', error);
        onError?.(error);
        onUpdate([]);
      },
    );

/**
 * El admin revisa un turno cerrado: "dinero completo" (shortageAmountInput=0)
 * lo marca `complete`; un monto mayor a cero registra el faltante como
 * `deliveryShortages` para que Nómina lo descuente del próximo pago de ese
 * trabajador.
 */
export const reviewTurno = async (turno, shortageAmountInput) => {
  if (!turno?.id) throw new Error('Turno inválido.');
  const turnoRef = closingsRef().doc(turno.id);
  const shortageRef = firestore().collection('deliveryShortages').doc();
  const reviewer = auth()?.currentUser?.email || 'N/A';

  return firestore().runTransaction(async (tx) => {
    const snap = await tx.get(turnoRef);
    if (!snap.exists()) throw new Error('El turno ya no existe.');
    const data = snap.data() || {};
    if (data.status !== 'pending_review') throw new Error('Este turno ya fue revisado.');

    const { receivedAmount, shortageAmount, isComplete } = computeReviewOutcome(
      data.expectedAmount,
      shortageAmountInput,
    );

    tx.update(turnoRef, {
      status: isComplete ? 'complete' : 'shortage',
      receivedAmount,
      shortageAmount,
      reviewedAt: firestore.FieldValue.serverTimestamp(),
      reviewedBy: reviewer,
      shortageId: isComplete ? null : shortageRef.id,
    });

    if (!isComplete) {
      // ponytail: `entregadorId` es el nombre heredado del campo que ya usa
      // Nómina (payroll/types.ts) — aquí puede ser un vendedor o un admin, no
      // solo un entregador. Si un admin queda con faltante en su propio turno
      // el registro se guarda igual, pero no se paga: Nómina no tiene cuenta
      // para admin (STAFF_ROLES no lo incluye). Ampliar el día que haga falta.
      tx.set(shortageRef, {
        entregadorId: data.uid,
        customerName: `Cierre de caja · ${data.userName || data.uid}`,
        totalMissingValue: shortageAmount,
        status: 'pending',
        recordedAt: firestore.FieldValue.serverTimestamp(),
      });
    }

    return { id: turnoRef.id, status: isComplete ? 'complete' : 'shortage', shortageAmount };
  });
};

export const subscribeCashClosingHistory = (uid, onUpdate, onError, limit = 100) => {
  let query = closingsRef().where('status', 'in', ['complete', 'shortage']);
  if (uid) query = query.where('uid', '==', uid);

  return query.onSnapshot(
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.reviewedAt?.toMillis?.() ?? 0) - (a.reviewedAt?.toMillis?.() ?? 0));
      onUpdate(list.slice(0, limit));
    },
    (error) => {
      console.error('[cashClosingService] subscribeCashClosingHistory:', error);
      onError?.(error);
      onUpdate([]);
    },
  );
};
