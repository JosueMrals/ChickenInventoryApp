/**
 * FASE S1.7.1 — regresión permanente de `cashClosings`/`cashCollections`
 * (S1.7-F0, S1.7-F1, S1.7-F3). Ver
 * `audit-reports/fase-s1-7-0-cash-closings-storage-security-audit.md` y
 * `fase-s1-7-1-cash-closings-cash-collections-storage-security-implementation.md`.
 */
const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');

const RULES_PATH = path.resolve(__dirname, '../../firebase/firestore.rules');

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'chickeninventoryapp-emulator-test-cash-closing-rules',
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
const asEntregador = (uid = 'entregador-x') => testEnv.authenticatedContext(uid, { role: 'entregador' }).firestore();
const asBodeguero = (uid = 'bodeguero-x') => testEnv.authenticatedContext(uid, { role: 'bodeguero' }).firestore();
const asNoRole = (uid = 'sin-rol') => testEnv.authenticatedContext(uid).firestore();

const seedCollection = async (id, data) => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('cashCollections').doc(id).set(data);
  });
};
const seedClosing = async (id, data) => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('cashClosings').doc(id).set(data);
  });
};
const seedCredit = async (id, data) => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('credits').doc(id).set(data);
  });
};
// FASE S1.8.1: deliveryShortages.create (shape 2, cierre de caja) ahora exige
// que entregadorId sea un usuario real (exists()) — ver
// audit-reports/fase-s1-8-1-*.md.
const seedUser = async (id, data = {}) => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('users').doc(id).set({ role: 'vendedor', ...data });
  });
};

const collectionPayload = (uid, overrides = {}) => ({
  uid, userName: `${uid}@test.com`, amount: 100, method: null, sourceType: 'creditAbono',
  sourceId: 'cred-1', customerName: 'Juan Pérez', at: new Date(), turnoId: null,
  ...overrides,
});

// ── cashCollections.create (S1.7-F1) ────────────────────────────────────────
describe('S1.7.1 — cashCollections.create', () => {
  test('admin crea cashCollection', async () => {
    await assertSucceeds(asAdmin('admin-1').collection('cashCollections').doc('cc1').set(collectionPayload('admin-1')));
  });

  test('vendedor crea cashCollection', async () => {
    await assertSucceeds(asVendedor('vendedor-x').collection('cashCollections').doc('cc2').set(collectionPayload('vendedor-x')));
  });

  test('entregador crea cashCollection (flujo legítimo de abono, S1.7-F1 cerrado)', async () => {
    await assertSucceeds(asEntregador('entregador-x').collection('cashCollections').doc('cc3').set(collectionPayload('entregador-x')));
  });

  test('bodeguero NO puede crear cashCollection', async () => {
    await assertFails(asBodeguero('bodeguero-x').collection('cashCollections').doc('cc4').set(collectionPayload('bodeguero-x')));
  });

  test('usuario sin rol NO puede crear cashCollection', async () => {
    await assertFails(asNoRole('sin-rol').collection('cashCollections').doc('cc5').set(collectionPayload('sin-rol')));
  });

  test('entregador con payload arbitrario incompatible con el writer real (sourceType distinto) → DENIED', async () => {
    await assertFails(
      asEntregador('entregador-x').collection('cashCollections').doc('cc6').set(
        collectionPayload('entregador-x', { sourceType: 'presale' })
      )
    );
  });

  test('entregador con campo extra fuera del shape real → DENIED', async () => {
    await assertFails(
      asEntregador('entregador-x').collection('cashCollections').doc('cc7').set({
        ...collectionPayload('entregador-x'), discountCode: 'X',
      })
    );
  });

  test('monto negativo → DENIED (sin cambios, regresión)', async () => {
    await assertFails(
      asVendedor('vendedor-x').collection('cashCollections').doc('cc8').set(
        collectionPayload('vendedor-x', { amount: -5 })
      )
    );
  });
});

// ── cashCollections.update (S1.7-F3) ────────────────────────────────────────
describe('S1.7.1 — cashCollections.update (reclamo en turno)', () => {
  test('el dueño reclama su cobro correctamente → PASS', async () => {
    await seedCollection('cl1', collectionPayload('vendedor-x'));
    await assertSucceeds(
      asVendedor('vendedor-x').collection('cashCollections').doc('cl1').update({ turnoId: 'turno-1' })
    );
  });

  test('el dueño intenta cambiar amount junto con turnoId → DENIED', async () => {
    await seedCollection('cl2', collectionPayload('vendedor-x'));
    await assertFails(
      asVendedor('vendedor-x').collection('cashCollections').doc('cl2').update({ turnoId: 'turno-1', amount: 999 })
    );
  });

  test('el dueño intenta cambiar uid → DENIED', async () => {
    await seedCollection('cl3', collectionPayload('vendedor-x'));
    await assertFails(
      asVendedor('vendedor-x').collection('cashCollections').doc('cl3').update({ turnoId: 'turno-1', uid: 'otro' })
    );
  });

  test('el dueño intenta cambiar method → DENIED', async () => {
    await seedCollection('cl4', collectionPayload('vendedor-x'));
    await assertFails(
      asVendedor('vendedor-x').collection('cashCollections').doc('cl4').update({ turnoId: 'turno-1', method: 'transfer' })
    );
  });

  test('el dueño intenta cambiar sourceType → DENIED', async () => {
    await seedCollection('cl5', collectionPayload('vendedor-x'));
    await assertFails(
      asVendedor('vendedor-x').collection('cashCollections').doc('cl5').update({ turnoId: 'turno-1', sourceType: 'presale' })
    );
  });

  test('el dueño intenta cambiar sourceId → DENIED', async () => {
    await seedCollection('cl6', collectionPayload('vendedor-x'));
    await assertFails(
      asVendedor('vendedor-x').collection('cashCollections').doc('cl6').update({ turnoId: 'turno-1', sourceId: 'otro-credito' })
    );
  });

  test('el dueño intenta cambiar customerName → DENIED', async () => {
    await seedCollection('cl7', collectionPayload('vendedor-x'));
    await assertFails(
      asVendedor('vendedor-x').collection('cashCollections').doc('cl7').update({ turnoId: 'turno-1', customerName: 'Otro' })
    );
  });

  test('el dueño intenta cambiar at → DENIED', async () => {
    await seedCollection('cl8', collectionPayload('vendedor-x'));
    await assertFails(
      asVendedor('vendedor-x').collection('cashCollections').doc('cl8').update({ turnoId: 'turno-1', at: new Date('2020-01-01') })
    );
  });

  test('otro usuario intenta reclamar un cobro ajeno → DENIED', async () => {
    await seedCollection('cl9', collectionPayload('vendedor-x'));
    await assertFails(
      asVendedor('otro-vendedor').collection('cashCollections').doc('cl9').update({ turnoId: 'turno-1' })
    );
  });

  test('segunda reclamación (ya tiene turnoId) → DENIED', async () => {
    await seedCollection('cl10', collectionPayload('vendedor-x', { turnoId: 'turno-viejo' }));
    await assertFails(
      asVendedor('vendedor-x').collection('cashCollections').doc('cl10').update({ turnoId: 'turno-nuevo' })
    );
  });
});

// ── cashClosings.update rama 1 — auto-cierre (S1.7-F0 Problema A) ──────────
describe('S1.7.1 — cashClosings.update (auto-cierre, open→pending_review)', () => {
  const openTurno = (uid, overrides = {}) => ({
    uid, userName: `${uid}@test.com`, role: 'vendedor', status: 'open',
    openedAt: new Date(), closedAt: null, collectionIds: [], expectedAmount: 0,
    cashExpensesTotal: 0, receivedAmount: null, shortageAmount: 0,
    reviewedAt: null, reviewedBy: null, shortageId: null,
    ...overrides,
  });

  test('el dueño cierra su turno con el payload real → PASS', async () => {
    await seedClosing('t1', openTurno('vendedor-x'));
    await assertSucceeds(
      asVendedor('vendedor-x').collection('cashClosings').doc('t1').update({
        status: 'pending_review', closedAt: new Date(), collectionIds: ['cc1', 'cc2'],
        expectedAmount: 250, cashExpensesTotal: 0,
      })
    );
  });

  test('campo arbitrario fuera del shape real (S1.7-F0 cerrado) → DENIED', async () => {
    await seedClosing('t2', openTurno('vendedor-x'));
    await assertFails(
      asVendedor('vendedor-x').collection('cashClosings').doc('t2').update({
        status: 'pending_review', closedAt: new Date(), collectionIds: [],
        expectedAmount: 0, cashExpensesTotal: 0, reviewedBy: 'vendedor-x@test.com',
      })
    );
  });

  test('expectedAmount negativo → DENIED', async () => {
    await seedClosing('t3', openTurno('vendedor-x'));
    await assertFails(
      asVendedor('vendedor-x').collection('cashClosings').doc('t3').update({
        status: 'pending_review', closedAt: new Date(), collectionIds: [],
        expectedAmount: -100, cashExpensesTotal: 0,
      })
    );
  });

  test('otro usuario NO puede cerrar un turno ajeno', async () => {
    await seedClosing('t4', openTurno('vendedor-x'));
    await assertFails(
      asVendedor('otro-vendedor').collection('cashClosings').doc('t4').update({
        status: 'pending_review', closedAt: new Date(), collectionIds: [],
        expectedAmount: 0, cashExpensesTotal: 0,
      })
    );
  });

  test('entregador cierra su propio turno → PASS (mismo criterio, cualquier operativo)', async () => {
    await seedClosing('t5', openTurno('entregador-x', { role: 'entregador' }));
    await assertSucceeds(
      asEntregador('entregador-x').collection('cashClosings').doc('t5').update({
        status: 'pending_review', closedAt: new Date(), collectionIds: ['cc9'],
        expectedAmount: 40, cashExpensesTotal: 0,
      })
    );
  });
});

// ── cashClosings.update rama 2 — revisión admin (S1.7-F0) ──────────────────
describe('S1.7.1 — cashClosings.update (revisión admin, pending_review→complete|shortage)', () => {
  const pendingTurno = (uid, expectedAmount, overrides = {}) => ({
    uid, userName: `${uid}@test.com`, role: 'vendedor', status: 'pending_review',
    openedAt: new Date(), closedAt: new Date(), collectionIds: ['cc1'],
    expectedAmount, cashExpensesTotal: 0, receivedAmount: null, shortageAmount: 0,
    reviewedAt: null, reviewedBy: null, shortageId: null,
    ...overrides,
  });

  test('admin marca completo (sin faltante) → PASS', async () => {
    await seedClosing('r1', pendingTurno('vendedor-x', 100));
    await assertSucceeds(
      asAdmin('admin-1').collection('cashClosings').doc('r1').update({
        status: 'complete', receivedAmount: 100, shortageAmount: 0,
        reviewedAt: new Date(), reviewedBy: 'admin-1@test.com', shortageId: null,
      })
    );
  });

  test('admin marca faltante (transacción real con deliveryShortages, getAfter()) → PASS', async () => {
    await seedUser('vendedor-x');
    await seedClosing('r2', pendingTurno('vendedor-x', 100));
    const db = asAdmin('admin-1');
    const shortageRef = db.collection('deliveryShortages').doc();
    await assertSucceeds(
      db.runTransaction(async (tx) => {
        tx.update(db.collection('cashClosings').doc('r2'), {
          status: 'shortage', receivedAmount: 70, shortageAmount: 30,
          reviewedAt: new Date(), reviewedBy: 'admin-1@test.com', shortageId: shortageRef.id,
        });
        tx.set(shortageRef, {
          entregadorId: 'vendedor-x', customerName: 'Cierre de caja · vendedor-x',
          totalMissingValue: 30, status: 'pending', recordedAt: new Date(),
        });
      })
    );
  });

  test('receivedAmount+shortageAmount no coincide con expectedAmount → DENIED', async () => {
    await seedClosing('r3', pendingTurno('vendedor-x', 100));
    await assertFails(
      asAdmin('admin-1').collection('cashClosings').doc('r3').update({
        status: 'complete', receivedAmount: 50, shortageAmount: 0,
        reviewedAt: new Date(), reviewedBy: 'admin-1@test.com', shortageId: null,
      })
    );
  });

  test('shortageId apunta a un deliveryShortages de OTRO entregador → DENIED', async () => {
    await seedClosing('r4', pendingTurno('vendedor-x', 100));
    const db = asAdmin('admin-1');
    const shortageRef = db.collection('deliveryShortages').doc();
    await assertFails(
      db.runTransaction(async (tx) => {
        tx.update(db.collection('cashClosings').doc('r4'), {
          status: 'shortage', receivedAmount: 70, shortageAmount: 30,
          reviewedAt: new Date(), reviewedBy: 'admin-1@test.com', shortageId: shortageRef.id,
        });
        tx.set(shortageRef, {
          entregadorId: 'otro-vendedor-y', customerName: 'x',
          totalMissingValue: 30, status: 'pending', recordedAt: new Date(),
        });
      })
    );
  });

  test('campo arbitrario fuera del shape real → DENIED', async () => {
    await seedClosing('r5', pendingTurno('vendedor-x', 100));
    await assertFails(
      asAdmin('admin-1').collection('cashClosings').doc('r5').update({
        status: 'complete', receivedAmount: 100, shortageAmount: 0,
        reviewedAt: new Date(), reviewedBy: 'admin-1@test.com', shortageId: null,
        expectedAmount: 999,
      })
    );
  });

  test('vendedor (no admin) NO puede revisar un turno', async () => {
    await seedClosing('r6', pendingTurno('vendedor-x', 100));
    await assertFails(
      asVendedor('vendedor-x').collection('cashClosings').doc('r6').update({
        status: 'complete', receivedAmount: 100, shortageAmount: 0,
        reviewedAt: new Date(), reviewedBy: 'vendedor-x@test.com', shortageId: null,
      })
    );
  });

  test('un cierre ya revisado no puede volver a modificarse', async () => {
    await seedClosing('r7', pendingTurno('vendedor-x', 100, { status: 'complete', receivedAmount: 100 }));
    await assertFails(
      asAdmin('admin-1').collection('cashClosings').doc('r7').update({
        status: 'shortage', receivedAmount: 50, shortageAmount: 50,
        reviewedAt: new Date(), reviewedBy: 'admin-1@test.com', shortageId: 'x',
      })
    );
  });
});

// ── Regresión de flujos completos (Parte 8 del prompt) ──────────────────────
describe('S1.7.1 — regresión de flujos completos', () => {
  test('flujo completo: open → pending_review → complete', async () => {
    await seedClosing('flow1', {
      uid: 'vendedor-x', userName: 'vendedor-x@test.com', role: 'vendedor', status: 'open',
      openedAt: new Date(), closedAt: null, collectionIds: [], expectedAmount: 0,
      cashExpensesTotal: 0, receivedAmount: null, shortageAmount: 0,
      reviewedAt: null, reviewedBy: null, shortageId: null,
    });
    await assertSucceeds(
      asVendedor('vendedor-x').collection('cashClosings').doc('flow1').update({
        status: 'pending_review', closedAt: new Date(), collectionIds: [],
        expectedAmount: 200, cashExpensesTotal: 0,
      })
    );
    await assertSucceeds(
      asAdmin('admin-1').collection('cashClosings').doc('flow1').update({
        status: 'complete', receivedAmount: 200, shortageAmount: 0,
        reviewedAt: new Date(), reviewedBy: 'admin-1@test.com', shortageId: null,
      })
    );
  });

  test('flujo completo: open → pending_review → shortage', async () => {
    await seedUser('entregador-x', { role: 'entregador' });
    await seedClosing('flow2', {
      uid: 'entregador-x', userName: 'entregador-x@test.com', role: 'entregador', status: 'open',
      openedAt: new Date(), closedAt: null, collectionIds: [], expectedAmount: 0,
      cashExpensesTotal: 0, receivedAmount: null, shortageAmount: 0,
      reviewedAt: null, reviewedBy: null, shortageId: null,
    });
    await assertSucceeds(
      asEntregador('entregador-x').collection('cashClosings').doc('flow2').update({
        status: 'pending_review', closedAt: new Date(), collectionIds: ['cc-a'],
        expectedAmount: 150, cashExpensesTotal: 0,
      })
    );
    const db = asAdmin('admin-1');
    const shortageRef = db.collection('deliveryShortages').doc();
    await assertSucceeds(
      db.runTransaction(async (tx) => {
        tx.update(db.collection('cashClosings').doc('flow2'), {
          status: 'shortage', receivedAmount: 100, shortageAmount: 50,
          reviewedAt: new Date(), reviewedBy: 'admin-1@test.com', shortageId: shortageRef.id,
        });
        tx.set(shortageRef, {
          entregadorId: 'entregador-x', customerName: 'x', totalMissingValue: 50,
          status: 'pending', recordedAt: new Date(),
        });
      })
    );
  });

  test('flujo completo: cashCollection creado → reclamado al cerrar turno (misma transacción)', async () => {
    await seedCollection('claim1', collectionPayload('vendedor-x'));
    await seedClosing('flow3', {
      uid: 'vendedor-x', userName: 'vendedor-x@test.com', role: 'vendedor', status: 'open',
      openedAt: new Date(), closedAt: null, collectionIds: [], expectedAmount: 0,
      cashExpensesTotal: 0, receivedAmount: null, shortageAmount: 0,
      reviewedAt: null, reviewedBy: null, shortageId: null,
    });
    const db = asVendedor('vendedor-x');
    await assertSucceeds(
      db.runTransaction(async (tx) => {
        tx.update(db.collection('cashClosings').doc('flow3'), {
          status: 'pending_review', closedAt: new Date(), collectionIds: ['claim1'],
          expectedAmount: 100, cashExpensesTotal: 0,
        });
        tx.update(db.collection('cashCollections').doc('claim1'), { turnoId: 'flow3' });
      })
    );
  });

  test('abono real completo (credits.update + cashCollections.create, misma transacción): vendedor PASS', async () => {
    await seedCredit('cred-v', { total: 100, paid: 0, pending: 100, status: 'pending', payments: [] });
    const db = asVendedor('vendedor-x');
    await assertSucceeds(
      db.runTransaction(async (tx) => {
        tx.update(db.collection('credits').doc('cred-v'), {
          paid: 40, pending: 60, status: 'pending', updatedAt: new Date(),
          payments: [{ amount: 40, date: new Date(), by: 'vendedor-x@test.com' }],
        });
        tx.set(db.collection('cashCollections').doc(), collectionPayload('vendedor-x', { sourceId: 'cred-v' }));
      })
    );
  });

  test('abono real completo (credits.update + cashCollections.create, misma transacción): entregador PASS (S1.7-F1 cerrado)', async () => {
    await seedCredit('cred-e', { total: 100, paid: 0, pending: 100, status: 'pending', payments: [] });
    const db = asEntregador('entregador-x');
    await assertSucceeds(
      db.runTransaction(async (tx) => {
        tx.update(db.collection('credits').doc('cred-e'), {
          paid: 40, pending: 60, status: 'pending', updatedAt: new Date(),
          payments: [{ amount: 40, date: new Date(), by: 'entregador-x@test.com' }],
        });
        tx.set(db.collection('cashCollections').doc(), collectionPayload('entregador-x', { sourceId: 'cred-e' }));
      })
    );
  });

  test('abono real completo: bodeguero sigue sin poder (credits.update ya lo excluye, control)', async () => {
    await seedCredit('cred-b', { total: 100, paid: 0, pending: 100, status: 'pending', payments: [] });
    const db = asBodeguero('bodeguero-x');
    await assertFails(
      db.runTransaction(async (tx) => {
        tx.update(db.collection('credits').doc('cred-b'), {
          paid: 40, pending: 60, status: 'pending', updatedAt: new Date(),
          payments: [{ amount: 40, date: new Date(), by: 'bodeguero-x@test.com' }],
        });
        tx.set(db.collection('cashCollections').doc(), collectionPayload('bodeguero-x', { sourceId: 'cred-b' }));
      })
    );
  });
});
