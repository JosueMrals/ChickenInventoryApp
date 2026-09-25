/**
 * FASE CC1 — verificación por ROL: al ejecutar un cobro real, el turno se
 * abre solo. Se comprueba el encadenado completo contra el Emulator y las
 * reglas reales, en el orden en que ocurre en la app:
 *
 *     cobro (cashCollections)  →  ensureOpenTurno  →  turno abierto con 0
 *
 * Cada rol se prueba por la vía de cobro que realmente usa:
 *   vendedor    → abono de crédito  y  cobro de preventa en mostrador
 *   entregador  → abono de crédito  (su cobro de entrega lo escribe el Admin
 *                 SDK en completePreSalePayment, que no pasa por reglas; se
 *                 cubre aparte, más abajo, con el mismo algoritmo).
 *
 * Limitación declarada (igual que quickSaleConcurrency.test.js): no se puede
 * invocar @react-native-firebase bajo Jest, así que se ejecuta el MISMO
 * algoritmo de ensureOpenTurno/openTurnoAtomic (cashClosingService.js) con el
 * SDK web, pero contra Firestore y las reglas reales.
 */
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds } = require('@firebase/rules-unit-testing');
const {
  doc, collection, getDoc, getDocs, setDoc, query, where, runTransaction, serverTimestamp,
} = require('firebase/firestore');

const RULES_PATH = path.resolve(__dirname, '../../firebase/firestore.rules');

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'chickeninventoryapp-emulator-test-autoopen-roles',
    firestore: {
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => { if (testEnv) await testEnv.cleanup(); });
afterEach(async () => { if (testEnv) await testEnv.clearFirestore(); });

const dbAs = (uid, role) => testEnv.authenticatedContext(uid, { role }).firestore();

// ── Algoritmo real de cashClosingService.ensureOpenTurno ────────────────────
const buildTurnoPayload = (uid, role) => ({
  uid, userName: `${uid}@test.com`, role: role || null, status: 'open',
  openedAt: serverTimestamp(), closedAt: null, collectionIds: [],
  expectedAmount: 0, cashExpensesTotal: 0, receivedAmount: null,
  shortageAmount: 0, reviewedAt: null, reviewedBy: null, shortageId: null,
});

const ensureOpenTurno = async (db, uid, role) => {
  const legacy = await getDocs(query(
    collection(db, 'cashClosings'), where('uid', '==', uid), where('status', '==', 'open'),
  ));
  if (!legacy.empty) return legacy.docs[0].id;

  const sessionRef = doc(db, 'cashSessions', uid);
  const newTurnoRef = doc(collection(db, 'cashClosings'));

  return runTransaction(db, async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    const currentId = sessionSnap.exists() ? sessionSnap.data().openTurnoId : null;
    const currentSnap = currentId ? await tx.get(doc(db, 'cashClosings', currentId)) : null;
    if (currentSnap?.exists() && currentSnap.data().status === 'open') return currentId;

    tx.set(newTurnoRef, buildTurnoPayload(uid, role));
    tx.set(sessionRef, { openTurnoId: newTurnoRef.id });
    return newTurnoRef.id;
  });
};

// ── Cobros reales, tal como los escribe cada writer ─────────────────────────
const abonoCredito = (db, uid, id, amount) => setDoc(doc(db, 'cashCollections', id), {
  uid, userName: `${uid}@test.com`, amount, method: null, sourceType: 'creditAbono',
  sourceId: 'cred-1', customerName: 'Juan Pérez', at: new Date(), turnoId: null,
});

const cobroMostrador = (db, uid, preSaleId, amount) =>
  setDoc(doc(db, 'cashCollections', `presale-${preSaleId}`), {
    uid, userName: `${uid}@test.com`, amount, method: null, sourceType: 'presale',
    sourceId: preSaleId, customerName: 'Juan Pérez', at: new Date(), turnoId: null,
  });

// ── Aserciones ──────────────────────────────────────────────────────────────
const turnosAbiertos = async (uid) => {
  let docs = [];
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const snap = await getDocs(query(
      collection(ctx.firestore(), 'cashClosings'),
      where('uid', '==', uid), where('status', '==', 'open'),
    ));
    docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  });
  return docs;
};

const ingresosSinReclamar = async (db, uid) => {
  const snap = await getDocs(query(
    collection(db, 'cashCollections'), where('uid', '==', uid), where('turnoId', '==', null),
  ));
  return Number(snap.docs.reduce((t, d) => t + Number(d.data().amount || 0), 0).toFixed(2));
};

/** El contrato completo: hay UN turno abierto, con monto inicial 0, del dueño. */
const esperarTurnoRecienAbierto = async (uid, role, turnoId) => {
  const abiertos = await turnosAbiertos(uid);
  expect(abiertos).toHaveLength(1);
  expect(abiertos[0].id).toBe(turnoId);
  expect(abiertos[0]).toMatchObject({
    uid, role, status: 'open', expectedAmount: 0, cashExpensesTotal: 0, collectionIds: [],
  });
};

describe.each([
  ['vendedor', 'vendedor-x'],
  ['entregador', 'entregador-x'],
])('CC1 — apertura automática al cobrar · rol %s', (role, uid) => {
  test('sin turno abierto, un abono de crédito abre el turno en C$0.00 y deja el cobro visible', async () => {
    const db = dbAs(uid, role);
    expect(await turnosAbiertos(uid)).toHaveLength(0);

    await assertSucceeds(abonoCredito(db, uid, 'cc-1', 500));
    const turnoId = await ensureOpenTurno(db, uid, role);

    await esperarTurnoRecienAbierto(uid, role, turnoId);
    // El cobro nace sin reclamar: el turno lo reclama al cerrarse.
    expect(await ingresosSinReclamar(db, uid)).toBe(500);
  });

  test('un segundo cobro reutiliza el mismo turno: no abre otro', async () => {
    const db = dbAs(uid, role);
    await assertSucceeds(abonoCredito(db, uid, 'cc-1', 500));
    const primero = await ensureOpenTurno(db, uid, role);

    await assertSucceeds(abonoCredito(db, uid, 'cc-2', 300));
    const segundo = await ensureOpenTurno(db, uid, role);

    expect(segundo).toBe(primero);
    expect(await turnosAbiertos(uid)).toHaveLength(1);
    expect(await ingresosSinReclamar(db, uid)).toBe(800);
  });

  test('dos cobros simultáneos abren UN solo turno', async () => {
    const db = dbAs(uid, role);
    await assertSucceeds(abonoCredito(db, uid, 'cc-1', 500));
    await assertSucceeds(abonoCredito(db, uid, 'cc-2', 300));

    const [a, b] = await Promise.all([
      ensureOpenTurno(db, uid, role),
      ensureOpenTurno(db, uid, role),
    ]);

    expect(a).toBe(b);
    expect(await turnosAbiertos(uid)).toHaveLength(1);
  });

  test('reutiliza el turno que el propio usuario ya había abierto a mano', async () => {
    const db = dbAs(uid, role);
    const aMano = await ensureOpenTurno(db, uid, role);

    await assertSucceeds(abonoCredito(db, uid, 'cc-1', 500));
    const trasCobrar = await ensureOpenTurno(db, uid, role);

    expect(trasCobrar).toBe(aMano);
    expect(await turnosAbiertos(uid)).toHaveLength(1);
  });

  test('el turno de este rol no absorbe el cobro de otro usuario', async () => {
    const db = dbAs(uid, role);
    await assertSucceeds(abonoCredito(db, uid, 'cc-mio', 500));
    await ensureOpenTurno(db, uid, role);

    await assertSucceeds(abonoCredito(dbAs('otro-vendedor', 'vendedor'), 'otro-vendedor', 'cc-ajeno', 999));

    expect(await ingresosSinReclamar(db, uid)).toBe(500);
    expect(await turnosAbiertos('otro-vendedor')).toHaveLength(0);
  });
});

describe('CC1 — vías de cobro propias de cada rol', () => {
  test('vendedor: el cobro de preventa en mostrador también abre turno', async () => {
    const db = dbAs('vendedor-x', 'vendedor');

    await assertSucceeds(cobroMostrador(db, 'vendedor-x', 'ps-1', 450));
    const turnoId = await ensureOpenTurno(db, 'vendedor-x', 'vendedor');

    await esperarTurnoRecienAbierto('vendedor-x', 'vendedor', turnoId);
    expect(await ingresosSinReclamar(db, 'vendedor-x')).toBe(450);
  });

  test('entregador: su cobro de entrega lo escribe el Admin SDK y abre turno igual', async () => {
    // completePreSalePayment (functions/index.js) corre con Admin SDK: escribe
    // el cobro sin pasar por reglas y después llama ensureOpenTurno con el
    // mismo puntero `cashSessions/{uid}`.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'cashCollections', 'presale-ps-7'), {
        uid: 'entregador-x', userName: 'entregador-x@test.com', amount: 600, method: null,
        sourceType: 'presale', sourceId: 'ps-7', customerName: 'Ana', at: new Date(), turnoId: null,
      });
    });

    const db = dbAs('entregador-x', 'entregador');
    const turnoId = await ensureOpenTurno(db, 'entregador-x', 'entregador');

    await esperarTurnoRecienAbierto('entregador-x', 'entregador', turnoId);
    expect(await ingresosSinReclamar(db, 'entregador-x')).toBe(600);
  });
});
