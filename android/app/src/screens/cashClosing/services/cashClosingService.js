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
// Puntero por usuario al turno abierto: `cashSessions/{uid}` → { openTurnoId }.
// Existe solo para poder abrir turno de forma ATÓMICA. El SDK cliente no
// admite queries dentro de una transacción, así que sin un documento de id
// determinístico no hay nada sobre lo que dos cobros simultáneos puedan
// competir — y ambos abrían un turno cada uno.
const sessionsRef = () => firestore().collection('cashSessions');

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

const buildTurnoPayload = ({ uid, userName, role }) => ({
  uid,
  userName,
  role: role || null,
  status: 'open',
  // Monto inicial: un turno nace en cero. Lo que se cobre después llega por
  // `cashCollections` — el dinero de la operación NUNCA es el monto inicial.
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

/**
 * Abre el turno dentro de una transacción sobre `cashSessions/{uid}`, que es
 * el único punto de contención: dos operaciones monetarias simultáneas del
 * mismo usuario leen el mismo documento, así que una de las dos se reintenta
 * y ve el turno que acaba de crear la otra. Nunca quedan dos turnos abiertos.
 *
 * El id del turno se genera FUERA de la transacción a propósito: si Firestore
 * la reintenta por contención, un id nuevo en cada intento dejaría turnos
 * huérfanos.
 */
const openTurnoAtomic = ({ uid, userName, role, failIfOpen = false }) => {
  const sessionRef = sessionsRef().doc(uid);
  const newTurnoRef = closingsRef().doc();

  return firestore().runTransaction(async (tx) => {
    // Todas las lecturas antes de cualquier escritura (requisito de Firestore).
    const sessionSnap = await tx.get(sessionRef);
    const currentId = sessionSnap.exists() ? sessionSnap.data()?.openTurnoId : null;
    const currentSnap = currentId ? await tx.get(closingsRef().doc(currentId)) : null;

    // El puntero puede haber quedado apuntando a un turno ya cerrado (cierres
    // previos al puntero, o un cierre que no llegó a limpiarlo): solo cuenta
    // si el turno releído sigue realmente abierto.
    if (currentSnap?.exists() && currentSnap.data()?.status === 'open') {
      if (failIfOpen) throw new Error('Ya tienes un turno abierto.');
      return currentId;
    }

    tx.set(newTurnoRef, buildTurnoPayload({ uid, userName, role }));
    tx.set(sessionRef, { openTurnoId: newTurnoRef.id });
    return newTurnoRef.id;
  });
};

/** Abrir turno a mano: falla si ya hay uno abierto para ese usuario. */
export const openTurno = async ({ uid, userName, role }) => {
  if (!uid) throw new Error('Usuario inválido.');
  if (await findOpenTurnoId(uid)) throw new Error('Ya tienes un turno abierto.');
  return openTurnoAtomic({ uid, userName, role, failIfOpen: true });
};

/**
 * Usa el turno abierto si existe, o abre uno nuevo con monto inicial 0. Se
 * llama en cada operación que mueve dinero de verdad (abono de crédito, cobro
 * de entrega, cobro de preventa, gasto en efectivo) para que el trabajador no
 * tenga que acordarse de abrir turno a mano. Crear/preparar/cambiar de estado
 * una preventa NO llega aquí: no mueven dinero.
 *
 * ponytail: la consulta previa (`findOpenTurnoId`) solo cubre los turnos
 * abiertos ANTES de que existiera `cashSessions` — sin ella, un turno legado
 * abierto a mano quedaría duplicado en el primer cobro. Retirable cuando no
 * queden turnos abiertos sin puntero.
 */
export const ensureOpenTurno = async ({ uid, userName, role }) => {
  if (!uid) return null;
  const legacyId = await findOpenTurnoId(uid);
  if (legacyId) return legacyId;
  return openTurnoAtomic({ uid, userName, role });
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
    const ownerUid = turnoSnap.data()?.uid;

    // Todas las lecturas antes de cualquier escritura (requisito de Firestore).
    const collectionSnaps = await Promise.all(collectionRefs.map((ref) => tx.get(ref)));
    const expenseSnaps = await Promise.all(expenseRefs.map((ref) => tx.get(ref)));

    // El `uid` se vuelve a exigir aquí, no solo en las reglas: un turno nunca
    // suma el cobro de otro usuario aunque la pantalla mande ese id.
    const live = collectionSnaps.filter(
      (s) => s.exists() && s.data()?.turnoId == null && s.data()?.uid === ownerUid,
    );
    const collectionsTotal = sumCollections(live.map((s) => s.data()));

    const liveExpenses = expenseSnaps.filter((s) => isEligibleCashExpense(s, ownerUid));
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
    // El puntero queda libre en la MISMA transacción que cierra el turno: si
    // el cierre se revierte, el puntero sigue apuntando al turno abierto.
    // `set` y no `update`: el puntero puede no existir (turnos abiertos antes
    // de que `cashSessions` existiera).
    tx.set(sessionsRef().doc(ownerUid), { openTurnoId: null });

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
 * Todos los turnos abiertos, en vivo. Es la vista del admin: quién tiene caja
 * abierta ahora mismo. Cualquier operativo puede leer `cashClosings`, pero
 * sólo la pantalla del admin monta esta suscripción.
 */
export const subscribeOpenTurnos = (onUpdate, onError) =>
  closingsRef()
    .where('status', '==', 'open')
    .onSnapshot(
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.openedAt?.toMillis?.() ?? 0) - (b.openedAt?.toMillis?.() ?? 0));
        onUpdate(list);
      },
      (error) => {
        console.error('[cashClosingService] subscribeOpenTurnos:', error);
        onError?.(error);
        onUpdate([]);
      },
    );

/**
 * TODOS los cobros sin reclamar, de cualquier usuario. Una sola suscripción
 * para el panel del admin: agrupar por dueño en cliente cuesta dos listeners
 * en total, mientras que seguir la caja de cada trabajador por separado
 * costaría dos por trabajador. Sólo el admin la monta (`cashCollections.read`
 * es isOperativo(), pero la pantalla la activa por rol).
 */
export const subscribeAllUnclaimedCollections = (onUpdate, onError) =>
  collectionsRef()
    .where('turnoId', '==', null)
    .onSnapshot(
      (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (error) => {
        console.error('[cashClosingService] subscribeAllUnclaimedCollections:', error);
        onError?.(error);
        onUpdate([]);
      },
    );

/**
 * Pura: reparte movimientos por dueño y devuelve `{ ids, total }` de cada uno.
 * Sirve igual para cobros (`uid`) que para gastos (`createdByUid`), que es la
 * única diferencia entre las dos colecciones.
 */
export const groupAmountsByUid = (items, uidKey) => {
  const grupos = {};
  (items || []).forEach((item) => {
    const uid = item?.[uidKey];
    if (!uid) return;
    if (!grupos[uid]) grupos[uid] = { ids: [], total: 0 };
    grupos[uid].ids.push(item.id);
    grupos[uid].total += toNumber(item.amount);
  });
  Object.values(grupos).forEach((g) => { g.total = money(g.total); });
  return grupos;
};

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
