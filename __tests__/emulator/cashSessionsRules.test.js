/**
 * FASE CC1 — `cashSessions/{uid}`: el puntero de id determinístico que hace
 * ATÓMICA la apertura automática de turno, y la ampliación de
 * `cashCollections.create` a `sourceType: 'presale'` (cobro en mostrador).
 *
 * La concurrencia se ejercita contra el Emulator real, no simulada: el mismo
 * algoritmo de `openTurnoAtomic` (cashClosingService.js) reimplementado con
 * el SDK web, que sí corre en Node — misma limitación y mismo criterio que
 * quickSaleConcurrency.test.js (@react-native-firebase necesita el puente
 * nativo). Prueba que el PATRÓN es seguro bajo contención real de Firestore.
 */
const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const {
  doc, collection, getDocs, getDoc, setDoc, query, where, runTransaction, serverTimestamp,
} = require('firebase/firestore');

const RULES_PATH = path.resolve(__dirname, '../../firebase/firestore.rules');

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'chickeninventoryapp-emulator-test-cash-sessions',
    firestore: {
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => { if (testEnv) await testEnv.cleanup(); });
afterEach(async () => { if (testEnv) await testEnv.clearFirestore(); });

const asAdmin = (uid = 'admin-1') => testEnv.authenticatedContext(uid, { role: 'admin' }).firestore();
const asVendedor = (uid = 'vendedor-x') => testEnv.authenticatedContext(uid, { role: 'vendedor' }).firestore();
const asBodeguero = (uid = 'bodeguero-x') => testEnv.authenticatedContext(uid, { role: 'bodeguero' }).firestore();

// ── cashSessions: reglas ────────────────────────────────────────────────────
describe('CC1 — cashSessions/{uid}', () => {
  test('el dueño crea su propio puntero', async () => {
    await assertSucceeds(setDoc(doc(asVendedor(), 'cashSessions', 'vendedor-x'), { openTurnoId: 't1' }));
  });

  test('el dueño lo libera poniéndolo en null (lo hace closeTurno)', async () => {
    await assertSucceeds(setDoc(doc(asVendedor(), 'cashSessions', 'vendedor-x'), { openTurnoId: null }));
  });

  test('ningún operativo escribe el puntero de otro usuario', async () => {
    await assertFails(setDoc(doc(asVendedor('vendedor-x'), 'cashSessions', 'vendedor-y'), { openTurnoId: 't1' }));
    await assertFails(setDoc(doc(asBodeguero(), 'cashSessions', 'vendedor-x'), { openTurnoId: 't1' }));
  });

  // FASE CC2: el admin sí, porque closeTurno() libera el puntero del dueño y
  // ahora el admin puede cerrar turnos ajenos.
  test('el admin libera el puntero de otro al cerrarle el turno', async () => {
    await assertSucceeds(setDoc(doc(asAdmin(), 'cashSessions', 'vendedor-x'), { openTurnoId: null }));
  });

  test('nadie lee el puntero de otro usuario, ni el admin', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'cashSessions', 'vendedor-x'), { openTurnoId: 't1' });
    });
    await assertSucceeds(getDoc(doc(asVendedor('vendedor-x'), 'cashSessions', 'vendedor-x')));
    await assertFails(getDoc(doc(asAdmin(), 'cashSessions', 'vendedor-x')));
  });

  test('no admite campos fuera del contrato: el puntero no guarda dinero', async () => {
    await assertFails(setDoc(doc(asVendedor(), 'cashSessions', 'vendedor-x'), {
      openTurnoId: 't1', expectedAmount: 9999,
    }));
  });

  test('openTurnoId tiene que ser id o null, nunca un número', async () => {
    await assertFails(setDoc(doc(asVendedor(), 'cashSessions', 'vendedor-x'), { openTurnoId: 7 }));
  });

  test('el puntero no se borra (solo se libera)', async () => {
    await assertSucceeds(setDoc(doc(asVendedor(), 'cashSessions', 'vendedor-x'), { openTurnoId: 't1' }));
    const { deleteDoc } = require('firebase/firestore');
    await assertFails(deleteDoc(doc(asVendedor(), 'cashSessions', 'vendedor-x')));
  });
});

// ── cashCollections.create con sourceType 'presale' (cobro en mostrador) ────
const presalePayload = (uid) => ({
  uid, userName: `${uid}@test.com`, amount: 500, method: null, sourceType: 'presale',
  sourceId: 'ps-1', customerName: 'Juan Pérez', at: new Date(), turnoId: null,
});

describe('CC1 — cashCollections.create sourceType presale', () => {
  test('admin registra el cobro en mostrador (era el C$0.00 del admin)', async () => {
    await assertSucceeds(setDoc(doc(asAdmin('admin-1'), 'cashCollections', 'presale-ps-1'), presalePayload('admin-1')));
  });

  test('vendedor registra el cobro en mostrador', async () => {
    await assertSucceeds(setDoc(doc(asVendedor('vendedor-x'), 'cashCollections', 'presale-ps-1'), presalePayload('vendedor-x')));
  });

  test('entregador NO etiqueta un cobro propio como presale: su cobro lo escribe el Admin SDK', async () => {
    const asEntregador = testEnv.authenticatedContext('entregador-x', { role: 'entregador' }).firestore();
    await assertFails(setDoc(doc(asEntregador, 'cashCollections', 'presale-ps-1'), presalePayload('entregador-x')));
    // Su rama legítima (abono de crédito) sigue abierta.
    await assertSucceeds(setDoc(doc(asEntregador, 'cashCollections', 'cc-ab'), {
      ...presalePayload('entregador-x'), sourceType: 'creditAbono',
    }));
  });

  test('bodeguero no cobra: no crea cashCollections', async () => {
    await assertFails(setDoc(doc(asBodeguero(), 'cashCollections', 'presale-ps-1'), presalePayload('bodeguero-x')));
  });

  test('sigue sin poder inventar un sourceType fuera del contrato', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'cashCollections', 'x1'), {
      ...presalePayload('admin-1'), sourceType: 'loQueSea',
    }));
  });

  test('sigue sin poder registrar el cobro a nombre de otro', async () => {
    await assertFails(setDoc(doc(asAdmin('admin-1'), 'cashCollections', 'x1'), presalePayload('vendedor-x')));
  });

  test('sigue sin poder nacer ya reclamado por un turno', async () => {
    await assertFails(setDoc(doc(asAdmin('admin-1'), 'cashCollections', 'x1'), {
      ...presalePayload('admin-1'), turnoId: 'turno-1',
    }));
  });
});

// ── Apertura automática atómica (algoritmo real contra el Emulator) ─────────
const buildTurnoPayload = (uid) => ({
  uid, userName: `${uid}@test.com`, role: null, status: 'open',
  openedAt: serverTimestamp(), closedAt: null, collectionIds: [],
  expectedAmount: 0, cashExpensesTotal: 0, receivedAmount: null,
  shortageAmount: 0, reviewedAt: null, reviewedBy: null, shortageId: null,
});

/** Mismo algoritmo que openTurnoAtomic (cashClosingService.js). */
const ensureOpenTurno = async (db, uid) => {
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

    tx.set(newTurnoRef, buildTurnoPayload(uid));
    tx.set(sessionRef, { openTurnoId: newTurnoRef.id });
    return newTurnoRef.id;
  });
};

const openTurnos = async (uid) => {
  let found = [];
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const snap = await getDocs(query(
      collection(ctx.firestore(), 'cashClosings'),
      where('uid', '==', uid), where('status', '==', 'open'),
    ));
    found = snap.docs.map((d) => d.id);
  });
  return found;
};

describe('CC1 — apertura automática', () => {
  test('sin caja abierta, un cobro la crea con monto inicial 0', async () => {
    const db = asVendedor('vendedor-x');
    const id = await ensureOpenTurno(db, 'vendedor-x');

    let data;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      data = (await getDoc(doc(ctx.firestore(), 'cashClosings', id))).data();
    });
    expect(data.status).toBe('open');
    expect(data.expectedAmount).toBe(0);
    expect(data.collectionIds).toEqual([]);
  });

  test('un segundo cobro reutiliza la caja: no crea una segunda', async () => {
    const db = asVendedor('vendedor-x');
    const first = await ensureOpenTurno(db, 'vendedor-x');
    const second = await ensureOpenTurno(db, 'vendedor-x');

    expect(second).toBe(first);
    expect(await openTurnos('vendedor-x')).toHaveLength(1);
  });

  test('dos cobros SIMULTÁNEOS abren UNA sola caja (contención real)', async () => {
    const db = asVendedor('vendedor-x');
    const [a, b] = await Promise.all([
      ensureOpenTurno(db, 'vendedor-x'),
      ensureOpenTurno(db, 'vendedor-x'),
    ]);

    expect(a).toBe(b);
    expect(await openTurnos('vendedor-x')).toHaveLength(1);
  });

  test('cuatro cobros simultáneos siguen abriendo UNA sola caja', async () => {
    const db = asVendedor('vendedor-x');
    const ids = await Promise.all(
      [0, 1, 2, 3].map(() => ensureOpenTurno(db, 'vendedor-x')),
    );

    expect(new Set(ids).size).toBe(1);
    expect(await openTurnos('vendedor-x')).toHaveLength(1);
  });

  test('cada usuario abre la suya: no se mezclan cajas', async () => {
    const [a, b] = await Promise.all([
      ensureOpenTurno(asVendedor('vendedor-x'), 'vendedor-x'),
      ensureOpenTurno(asAdmin('admin-1'), 'admin-1'),
    ]);

    expect(a).not.toBe(b);
    expect(await openTurnos('vendedor-x')).toEqual([a]);
    expect(await openTurnos('admin-1')).toEqual([b]);
  });

  test('un turno abierto ANTES del puntero (dato legado) se reutiliza, no se duplica', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'cashClosings', 'turno-legado'), buildTurnoPayload('vendedor-x'));
    });

    const id = await ensureOpenTurno(asVendedor('vendedor-x'), 'vendedor-x');

    expect(id).toBe('turno-legado');
    expect(await openTurnos('vendedor-x')).toEqual(['turno-legado']);
  });
});
