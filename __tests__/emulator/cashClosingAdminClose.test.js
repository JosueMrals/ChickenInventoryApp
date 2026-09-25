/**
 * FASE CC2 — el admin ve las cajas abiertas y puede cerrar la de otro.
 *
 * Lo que se verifica contra el Emulator y las reglas reales:
 *   1. el admin lista los turnos abiertos (lectura);
 *   2. el admin ejecuta el MISMO conjunto de escrituras que closeTurno()
 *      (turno → pending_review, cobros reclamados, gastos vinculados, puntero
 *      liberado) sobre un turno ajeno;
 *   3. el candado nuevo: ni el admin ni el dueño pueden meter un cobro/gasto
 *      en el turno de OTRO usuario (get() al turno destino).
 *
 * Limitación declarada, igual que el resto de esta carpeta: @react-native-firebase
 * no carga bajo Jest, así que las escrituras replican las de closeTurno con el
 * SDK web, pero contra Firestore y las reglas reales.
 */
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, collection, getDoc, getDocs, setDoc, updateDoc, query, where, writeBatch } = require('firebase/firestore');

const RULES_PATH = path.resolve(__dirname, '../../firebase/firestore.rules');
const VENDEDOR = 'vendedor-x';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'chickeninventoryapp-emulator-test-admin-close',
    firestore: { rules: fs.readFileSync(RULES_PATH, 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => { if (testEnv) await testEnv.cleanup(); });
afterEach(async () => { if (testEnv) await testEnv.clearFirestore(); });

const asAdmin = (uid = 'admin-1') => testEnv.authenticatedContext(uid, { role: 'admin' }).firestore();
const asVendedor = (uid = VENDEDOR) => testEnv.authenticatedContext(uid, { role: 'vendedor' }).firestore();

const turnoAbierto = (uid) => ({
  uid, userName: `${uid}@test.com`, role: 'vendedor', status: 'open',
  openedAt: new Date(), closedAt: null, collectionIds: [], expectedAmount: 0,
  cashExpensesTotal: 0, receivedAmount: null, shortageAmount: 0,
  reviewedAt: null, reviewedBy: null, shortageId: null,
});

const cobro = (uid, amount) => ({
  uid, userName: `${uid}@test.com`, amount, method: null, sourceType: 'creditAbono',
  sourceId: 'cred-1', customerName: 'Juan Pérez', at: new Date(), turnoId: null,
});

const gastoCash = (uid, amount) => ({
  amount, category: 'FUEL', description: null, paymentMethod: 'CASH', status: 'PENDING',
  createdByUid: uid, createdAt: new Date(),
  receipt: { url: 'https://x/r.jpg', path: 'expenseReceipts/r.jpg', uploadedAt: new Date() },
  cashClosingId: null, routeId: null, reviewedByUid: null, reviewedAt: null, reimbursement: null,
});

const sembrar = async (entradas) => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [ruta, id, data] of entradas) await setDoc(doc(db, ruta, id), data);
  });
};

const leerSinReglas = async (ruta, id) => {
  let data;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), ruta, id))).data();
  });
  return data;
};

/** Las escrituras exactas de closeTurno(), en un solo lote. */
const cerrarTurno = (db, { turnoId, ownerUid, collectionIds = [], expenseIds = [], expectedAmount = 0, cashExpensesTotal = 0 }) => {
  const batch = writeBatch(db);
  batch.update(doc(db, 'cashClosings', turnoId), {
    status: 'pending_review', closedAt: new Date(), collectionIds, expectedAmount, cashExpensesTotal,
  });
  collectionIds.forEach((id) => batch.update(doc(db, 'cashCollections', id), { turnoId }));
  expenseIds.forEach((id) => batch.update(doc(db, 'expenses', id), { cashClosingId: turnoId }));
  batch.set(doc(db, 'cashSessions', ownerUid), { openTurnoId: null });
  return batch.commit();
};

describe('CC2 — el admin ve las cajas abiertas', () => {
  test('lista todos los turnos abiertos, no sólo el suyo', async () => {
    await sembrar([
      ['cashClosings', 't-vend', turnoAbierto(VENDEDOR)],
      ['cashClosings', 't-entr', turnoAbierto('entregador-x')],
      ['cashClosings', 't-cerrado', { ...turnoAbierto('otro'), status: 'pending_review' }],
    ]);

    const snap = await assertSucceeds(getDocs(query(
      collection(asAdmin(), 'cashClosings'), where('status', '==', 'open'),
    )));

    expect(snap.docs.map((d) => d.id).sort()).toEqual(['t-entr', 't-vend']);
  });
});

describe('CC2 — el admin cierra el turno de otro', () => {
  beforeEach(() => sembrar([
    ['cashClosings', 't-vend', turnoAbierto(VENDEDOR)],
    ['cashCollections', 'cc-1', cobro(VENDEDOR, 500)],
    ['expenses', 'g-1', gastoCash(VENDEDOR, 100)],
    ['cashSessions', VENDEDOR, { openTurnoId: 't-vend' }],
  ]));

  test('cierra, reclama el cobro, vincula el gasto y libera el puntero', async () => {
    await assertSucceeds(cerrarTurno(asAdmin(), {
      turnoId: 't-vend', ownerUid: VENDEDOR, collectionIds: ['cc-1'], expenseIds: ['g-1'],
      expectedAmount: 400, cashExpensesTotal: 100,
    }));

    expect((await leerSinReglas('cashClosings', 't-vend')).status).toBe('pending_review');
    expect((await leerSinReglas('cashCollections', 'cc-1')).turnoId).toBe('t-vend');
    expect((await leerSinReglas('expenses', 'g-1')).cashClosingId).toBe('t-vend');
    expect((await leerSinReglas('cashSessions', VENDEDOR)).openTurnoId).toBeNull();
  });

  test('el dueño sigue pudiendo cerrar el suyo', async () => {
    await assertSucceeds(cerrarTurno(asVendedor(), {
      turnoId: 't-vend', ownerUid: VENDEDOR, collectionIds: ['cc-1'], expenseIds: ['g-1'],
      expectedAmount: 400, cashExpensesTotal: 100,
    }));
  });

  test('un vendedor NO puede cerrar el turno de otro vendedor', async () => {
    await assertFails(cerrarTurno(asVendedor('vendedor-y'), {
      turnoId: 't-vend', ownerUid: VENDEDOR, collectionIds: [], expenseIds: [],
    }));
  });

  test('el admin sigue sin poder saltarse la revisión: open no va directo a complete', async () => {
    await assertFails(updateDoc(doc(asAdmin(), 'cashClosings', 't-vend'), {
      status: 'complete', receivedAmount: 400, shortageAmount: 0,
      reviewedAt: new Date(), reviewedBy: 'admin@test.com', shortageId: null,
    }));
  });
});

describe('CC2 — candado de dueño: un cobro no entra en el turno de otro', () => {
  beforeEach(() => sembrar([
    ['cashClosings', 't-vend', turnoAbierto(VENDEDOR)],
    ['cashClosings', 't-otro', turnoAbierto('vendedor-y')],
    ['cashCollections', 'cc-vend', cobro(VENDEDOR, 500)],
    ['expenses', 'g-vend', gastoCash(VENDEDOR, 100)],
  ]));

  test('el admin NO puede reclamar el cobro de A dentro del turno de B', async () => {
    await assertFails(updateDoc(doc(asAdmin(), 'cashCollections', 'cc-vend'), { turnoId: 't-otro' }));
  });

  test('el admin NO puede vincular el gasto de A al cierre de B', async () => {
    await assertFails(updateDoc(doc(asAdmin(), 'expenses', 'g-vend'), { cashClosingId: 't-otro' }));
  });

  test('el propio dueño tampoco puede desviar su cobro al turno de otro', async () => {
    await assertFails(updateDoc(doc(asVendedor(), 'cashCollections', 'cc-vend'), { turnoId: 't-otro' }));
  });

  test('hacia el turno propio sí entra (admin y dueño)', async () => {
    await assertSucceeds(updateDoc(doc(asAdmin(), 'cashCollections', 'cc-vend'), { turnoId: 't-vend' }));
    await assertSucceeds(updateDoc(doc(asVendedor(), 'expenses', 'g-vend'), { cashClosingId: 't-vend' }));
  });

  test('un turnoId inexistente no cuela', async () => {
    await assertFails(updateDoc(doc(asAdmin(), 'cashCollections', 'cc-vend'), { turnoId: 'no-existe' }));
  });
});

// ── CC3: el monto en vivo de cada caja abierta ──────────────────────────────
describe('CC3 — el admin lee el monto de la caja de cada usuario', () => {
  beforeEach(() => sembrar([
    ['cashClosings', 't-vend', turnoAbierto(VENDEDOR)],
    ['cashClosings', 't-entr', turnoAbierto('entregador-x')],
    ['cashCollections', 'cc-v1', cobro(VENDEDOR, 500)],
    ['cashCollections', 'cc-v2', cobro(VENDEDOR, 300)],
    ['cashCollections', 'cc-e1', cobro('entregador-x', 120)],
    ['cashCollections', 'cc-reclamado', { ...cobro(VENDEDOR, 999), turnoId: 'turno-viejo' }],
    ['expenses', 'g-v1', gastoCash(VENDEDOR, 100)],
    ['expenses', 'g-liquidado', { ...gastoCash(VENDEDOR, 999), cashClosingId: 'turno-viejo' }],
    ['expenses', 'g-rechazado', { ...gastoCash(VENDEDOR, 999), status: 'REJECTED' }],
  ]));

  /** Las dos queries globales reales de useOpenTurnos. */
  const cobrosSinReclamar = (db) => getDocs(query(
    collection(db, 'cashCollections'), where('turnoId', '==', null),
  ));
  const gastosSinLiquidar = (db) => getDocs(query(
    collection(db, 'expenses'),
    where('paymentMethod', '==', 'CASH'), where('cashClosingId', '==', null),
  ));

  const porUid = (docs, campo) => docs.reduce((acc, d) => {
    const uid = d.data()[campo];
    acc[uid] = Number(((acc[uid] || 0) + Number(d.data().amount || 0)).toFixed(2));
    return acc;
  }, {});

  test('lee de una sola vez los cobros sin reclamar de TODOS los usuarios', async () => {
    const snap = await assertSucceeds(cobrosSinReclamar(asAdmin()));

    // El ya reclamado por un turno anterior queda fuera.
    expect(snap.docs.map((d) => d.id).sort()).toEqual(['cc-e1', 'cc-v1', 'cc-v2']);
    expect(porUid(snap.docs, 'uid')).toEqual({ [VENDEDOR]: 800, 'entregador-x': 120 });
  });

  test('lee de una sola vez los gastos CASH sin liquidar de TODOS los usuarios', async () => {
    const snap = await assertSucceeds(gastosSinLiquidar(asAdmin()));
    const vigentes = snap.docs.filter((d) => ['PENDING', 'APPROVED'].includes(d.data().status));

    // El liquidado lo excluye la query; el rechazado, el filtro en cliente.
    expect(snap.docs.map((d) => d.id).sort()).toEqual(['g-rechazado', 'g-v1']);
    expect(porUid(vigentes, 'createdByUid')).toEqual({ [VENDEDOR]: 100 });
  });

  test('el neto que muestra cada card sale de esas dos lecturas', async () => {
    const [cobros, gastos] = await Promise.all([
      cobrosSinReclamar(asAdmin()),
      gastosSinLiquidar(asAdmin()),
    ]);
    const ingresos = porUid(cobros.docs, 'uid');
    const egresos = porUid(
      gastos.docs.filter((d) => ['PENDING', 'APPROVED'].includes(d.data().status)),
      'createdByUid',
    );

    expect(ingresos[VENDEDOR] - (egresos[VENDEDOR] || 0)).toBe(700);
    expect(ingresos['entregador-x'] - (egresos['entregador-x'] || 0)).toBe(120);
  });

  test('un vendedor NO puede listar los gastos de todos (la query ajena se deniega)', async () => {
    await assertFails(gastosSinLiquidar(asVendedor()));
  });
});
