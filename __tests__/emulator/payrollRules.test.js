/**
 * FASE S1.10.1 + S1.10 FINAL — regresión permanente de `payrollAdvances`/
 * `staffPurchases`/`payrollSettlements`/`staffSalaries` (S1.10-F0, F_exists,
 * F_netPay, F_spoof, F_settlementRef, F1, F6). Payloads exactos según el
 * único writer real (`payrollService.ts`) — ver
 * `audit-reports/fase-s1-10-0-payroll-security-audit.md`,
 * `fase-s1-10-1-payroll-security-integrity-implementation.md` y
 * `fase-s1-10-final-payroll-closure.md`.
 *
 * S1.10 FINAL: `payrollSettlements` ya no usa ids aleatorios — el id real es
 * `${uid}_${hash(...)}` (ver `settleStaffPeriod`). Aquí se usan ids
 * `worker-1_setN` (prefijo correcto, sufijo arbitrario) porque lo que las
 * Rules verifican es el PREFIJO (`settlementId.split('_')[0] == uid`), no el
 * hash exacto — eso lo garantiza el código, no Rules (ver el comentario en
 * `firestore.rules`).
 */
const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const firebaseCompat = require('firebase/compat/app');
require('firebase/compat/firestore');
const serverTimestamp = () => firebaseCompat.firestore.FieldValue.serverTimestamp();

const RULES_PATH = path.resolve(__dirname, '../../firebase/firestore.rules');

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'chickeninventoryapp-emulator-test-payroll-rules',
    firestore: {
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => { if (testEnv) await testEnv.cleanup(); });
afterEach(async () => { if (testEnv) await testEnv.clearFirestore(); });

const asAdmin = (uid = 'admin-1', email = 'admin-1@test.com') =>
  testEnv.authenticatedContext(uid, { role: 'admin', email }).firestore();
const asVendedor = (uid = 'vendedor-x', email = 'vendedor-x@test.com') =>
  testEnv.authenticatedContext(uid, { role: 'vendedor', email }).firestore();
const asBodeguero = (uid = 'bodeguero-x', email = 'bodeguero-x@test.com') =>
  testEnv.authenticatedContext(uid, { role: 'bodeguero', email }).firestore();
const asEntregador = (uid = 'entregador-x', email = 'entregador-x@test.com') =>
  testEnv.authenticatedContext(uid, { role: 'entregador', email }).firestore();

const seed = (col) => async (id, data) => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection(col).doc(id).set(data);
  });
};
const seedUser = seed('users');
const seedSalary = seed('staffSalaries');
const seedAdvance = seed('payrollAdvances');
const seedPurchase = seed('staffPurchases');
const seedSettlement = seed('payrollSettlements');

// Settlement de `worker-1` con totales coherentes — usado como base para las
// pruebas de `payrollAdvances.update`/`staffPurchases.update`/
// `payrollSettlements.create`.
const settlementPayload = (overrides = {}) => ({
  uid: 'worker-1', userName: 'Ana Ruiz', role: 'entregador', salary: 5000,
  advancesTotal: 500, purchasesTotal: 300, shortagesTotal: 200, deductionsTotal: 1000,
  netPay: 4000, advanceIds: ['adv1'], purchaseIds: ['pur1'], shortageIds: [],
  paidAt: serverTimestamp(), paidBy: 'admin-1@test.com',
  ...overrides,
});

beforeEach(async () => {
  await seedUser('worker-1', { nombre: 'Ana', apellido: 'Ruiz', role: 'entregador' });
  await seedSalary('worker-1', { salary: 5000, updatedAt: new Date(), updatedBy: 'admin-1@test.com' });
});

// ── payrollAdvances.create ──────────────────────────────────────────────────
describe('payrollAdvances.create', () => {
  const payload = (overrides = {}) => ({
    uid: 'worker-1', userName: 'Ana Ruiz', amount: 500, note: null,
    createdAt: serverTimestamp(), createdBy: 'admin-1@test.com', settlementId: null,
    ...overrides,
  });

  test('admin con payload válido → PASS', async () => {
    await assertSucceeds(asAdmin().collection('payrollAdvances').doc('a1').set(payload()));
  });

  test('bodeguero → DENIED', async () => {
    await assertFails(asBodeguero().collection('payrollAdvances').doc('a2').set(payload()));
  });

  test('vendedor → DENIED', async () => {
    await assertFails(asVendedor().collection('payrollAdvances').doc('a3').set(payload()));
  });

  test('monto negativo → DENIED', async () => {
    await assertFails(asAdmin().collection('payrollAdvances').doc('a4').set(payload({ amount: -100 })));
  });

  test('uid inexistente → DENIED', async () => {
    await assertFails(asAdmin().collection('payrollAdvances').doc('a5').set(payload({ uid: 'no-existe' })));
  });

  test('campo arbitrario fuera del shape real → DENIED', async () => {
    await assertFails(
      asAdmin().collection('payrollAdvances').doc('a6').set({ ...payload(), extra: 'x' }),
    );
  });

  test('createdBy spoof (no coincide con el actor autenticado) → DENIED', async () => {
    await assertFails(
      asAdmin().collection('payrollAdvances').doc('a7').set(payload({ createdBy: 'otro@test.com' })),
    );
  });

  test('createdAt spoof (no es request.time) → DENIED', async () => {
    await assertFails(
      asAdmin().collection('payrollAdvances').doc('a8').set(payload({ createdAt: new Date('2020-01-01') })),
    );
  });
});

// ── payrollAdvances.update (saldar) ─────────────────────────────────────────
describe('payrollAdvances.update', () => {
  beforeEach(async () => {
    await seedAdvance('adv1', { uid: 'worker-1', userName: 'Ana Ruiz', amount: 500, note: null, settlementId: null });
  });

  test('settlement real del mismo trabajador, en la misma transacción (getAfter) → PASS', async () => {
    const db = asAdmin();
    await assertSucceeds(
      db.runTransaction(async (tx) => {
        tx.set(db.collection('payrollSettlements').doc('worker-1_set1'), settlementPayload());
        tx.update(db.collection('payrollAdvances').doc('adv1'), { settlementId: 'worker-1_set1' });
      }),
    );
  });

  test('settlement de OTRO trabajador → DENIED (getAfter compara uid)', async () => {
    await seedUser('worker-2', { nombre: 'Beto', apellido: 'Solano', role: 'vendedor' });
    await seedSalary('worker-2', { salary: 3000, updatedAt: new Date(), updatedBy: 'admin-1@test.com' });
    const db = asAdmin();
    await assertFails(
      db.runTransaction(async (tx) => {
        tx.set(db.collection('payrollSettlements').doc('worker-2_set2'), settlementPayload({
          uid: 'worker-2', userName: 'Beto Solano', role: 'vendedor', salary: 3000,
          advancesTotal: 0, purchasesTotal: 0, shortagesTotal: 0, deductionsTotal: 0,
          netPay: 3000, advanceIds: [], purchaseIds: [], shortageIds: [],
        }));
        tx.update(db.collection('payrollAdvances').doc('adv1'), { settlementId: 'worker-2_set2' });
      }),
    );
  });

  test('settlement inexistente → DENIED', async () => {
    await assertFails(
      asAdmin().collection('payrollAdvances').doc('adv1').update({ settlementId: 'worker-1_no-existe' }),
    );
  });

  test('campo extra en la misma escritura → DENIED', async () => {
    await assertFails(
      asAdmin().collection('payrollAdvances').doc('adv1').update({ settlementId: null, amount: 999 }),
    );
  });

  test('amount modificado al saldar → DENIED', async () => {
    const db = asAdmin();
    await assertFails(
      db.runTransaction(async (tx) => {
        tx.set(db.collection('payrollSettlements').doc('worker-1_set3'), settlementPayload());
        tx.update(db.collection('payrollAdvances').doc('adv1'), { settlementId: 'worker-1_set3', amount: 1 });
      }),
    );
  });

  test('settlementId null→valor (sin cambiar de null) → DENIED', async () => {
    await assertFails(
      asAdmin().collection('payrollAdvances').doc('adv1').update({ settlementId: null }),
    );
  });

  test('adelanto ya saldado → DENIED', async () => {
    await seedAdvance('adv-paid', { uid: 'worker-1', userName: 'Ana Ruiz', amount: 200, note: null, settlementId: 'worker-1_set-old' });
    const db = asAdmin();
    await assertFails(
      db.runTransaction(async (tx) => {
        tx.set(db.collection('payrollSettlements').doc('worker-1_set4'), settlementPayload({
          advancesTotal: 200, purchasesTotal: 0, shortagesTotal: 0, deductionsTotal: 200,
          netPay: 4800, advanceIds: ['adv-paid'], purchaseIds: [], shortageIds: [],
        }));
        tx.update(db.collection('payrollAdvances').doc('adv-paid'), { settlementId: 'worker-1_set4' });
      }),
    );
  });

  test('settlementId con prefijo de OTRO uid (spoof del propio id) → DENIED', async () => {
    await seedUser('worker-2', { nombre: 'Beto', apellido: 'Solano', role: 'vendedor' });
    await seedSalary('worker-2', { salary: 3000, updatedAt: new Date(), updatedBy: 'admin-1@test.com' });
    const db = asAdmin();
    // El propio settlement declara uid=worker-1 (para pasar el getAfter de
    // arriba) pero su ID empieza con worker-2 — la Rule de creación del
    // settlement debe rechazarlo por el prefijo, así que ni siquiera llega a
    // completarse el escenario de ataque.
    await assertFails(
      db.runTransaction(async (tx) => {
        tx.set(db.collection('payrollSettlements').doc('worker-2_set5'), settlementPayload());
        tx.update(db.collection('payrollAdvances').doc('adv1'), { settlementId: 'worker-2_set5' });
      }),
    );
  });
});

// ── staffPurchases.create ───────────────────────────────────────────────────
describe('staffPurchases.create', () => {
  const items = [{ productId: 'p1', productName: 'Pollo', quantity: 2, unitPrice: 100, total: 200 }];
  const payload = (overrides = {}) => ({
    uid: 'worker-1', userName: 'Ana Ruiz', items, total: 200,
    createdAt: serverTimestamp(), createdBy: 'bodeguero-x@test.com', createdByUid: 'bodeguero-x',
    settlementId: null,
    ...overrides,
  });

  test('admin con payload válido → PASS', async () => {
    await assertSucceeds(
      asAdmin('admin-1', 'admin-1@test.com').collection('staffPurchases').doc('sp1').set(
        payload({ createdBy: 'admin-1@test.com', createdByUid: 'admin-1' }),
      ),
    );
  });

  test('bodeguero con payload válido → PASS', async () => {
    await assertSucceeds(asBodeguero().collection('staffPurchases').doc('sp2').set(payload()));
  });

  test('vendedor → DENIED', async () => {
    await assertFails(asVendedor().collection('staffPurchases').doc('sp3').set(payload()));
  });

  test('campo extra fuera del shape real → DENIED', async () => {
    await assertFails(
      asBodeguero().collection('staffPurchases').doc('sp4').set({ ...payload(), extra: 'x' }),
    );
  });

  test('createdBy spoof → DENIED', async () => {
    await assertFails(
      asBodeguero().collection('staffPurchases').doc('sp5').set(payload({ createdBy: 'otro@test.com' })),
    );
  });

  test('createdByUid spoof → DENIED', async () => {
    await assertFails(
      asBodeguero().collection('staffPurchases').doc('sp6').set(payload({ createdByUid: 'otro-uid' })),
    );
  });

  test('createdAt spoof → DENIED', async () => {
    await assertFails(
      asBodeguero().collection('staffPurchases').doc('sp7').set(payload({ createdAt: new Date('2020-01-01') })),
    );
  });

  test('settlementId inicial distinto de null → DENIED', async () => {
    await assertFails(
      asBodeguero().collection('staffPurchases').doc('sp8').set(payload({ settlementId: 'x' })),
    );
  });

  test('uid inexistente → DENIED', async () => {
    await assertFails(
      asBodeguero().collection('staffPurchases').doc('sp9').set(payload({ uid: 'no-existe' })),
    );
  });
});

// ── staffPurchases.update (saldar) ──────────────────────────────────────────
describe('staffPurchases.update', () => {
  beforeEach(async () => {
    await seedPurchase('pur1', {
      uid: 'worker-1', userName: 'Ana Ruiz',
      items: [{ productId: 'p1', productName: 'Pollo', quantity: 2, unitPrice: 100, total: 200 }],
      total: 200, createdBy: 'bodeguero-x@test.com', createdByUid: 'bodeguero-x', settlementId: null,
    });
  });

  test('settlement real del mismo trabajador → PASS', async () => {
    const db = asAdmin();
    await assertSucceeds(
      db.runTransaction(async (tx) => {
        tx.set(db.collection('payrollSettlements').doc('worker-1_set1'), settlementPayload());
        tx.update(db.collection('staffPurchases').doc('pur1'), { settlementId: 'worker-1_set1' });
      }),
    );
  });

  test('campo extra en la misma escritura → DENIED', async () => {
    await assertFails(
      asAdmin().collection('staffPurchases').doc('pur1').update({ settlementId: null, total: 1 }),
    );
  });

  test('total modificado al saldar → DENIED', async () => {
    const db = asAdmin();
    await assertFails(
      db.runTransaction(async (tx) => {
        tx.set(db.collection('payrollSettlements').doc('worker-1_set2'), settlementPayload());
        tx.update(db.collection('staffPurchases').doc('pur1'), { settlementId: 'worker-1_set2', total: 1 });
      }),
    );
  });

  test('uid modificado (reasignar a otro trabajador) al saldar → DENIED', async () => {
    const db = asAdmin();
    await assertFails(
      db.runTransaction(async (tx) => {
        tx.set(db.collection('payrollSettlements').doc('worker-1_set3'), settlementPayload());
        tx.update(db.collection('staffPurchases').doc('pur1'), { settlementId: 'worker-1_set3', uid: 'otro' });
      }),
    );
  });

  test('items modificados al saldar → DENIED', async () => {
    const db = asAdmin();
    await assertFails(
      db.runTransaction(async (tx) => {
        tx.set(db.collection('payrollSettlements').doc('worker-1_set4'), settlementPayload());
        tx.update(db.collection('staffPurchases').doc('pur1'), {
          settlementId: 'worker-1_set4',
          items: [{ productId: 'p1', productName: 'Pollo', quantity: 999, unitPrice: 1, total: 1 }],
        });
      }),
    );
  });

  test('entrega ya saldada → DENIED', async () => {
    await seedPurchase('pur-paid', {
      uid: 'worker-1', userName: 'Ana Ruiz', items: [], total: 50,
      createdBy: 'bodeguero-x@test.com', createdByUid: 'bodeguero-x', settlementId: 'worker-1_set-old',
    });
    const db = asAdmin();
    await assertFails(
      db.runTransaction(async (tx) => {
        tx.set(db.collection('payrollSettlements').doc('worker-1_set5'), settlementPayload({
          advancesTotal: 0, purchasesTotal: 50, shortagesTotal: 0, deductionsTotal: 50,
          netPay: 4950, advanceIds: [], purchaseIds: ['pur-paid'], shortageIds: [],
        }));
        tx.update(db.collection('staffPurchases').doc('pur-paid'), { settlementId: 'worker-1_set5' });
      }),
    );
  });
});

// ── payrollSettlements.create ───────────────────────────────────────────────
describe('payrollSettlements.create', () => {
  test('admin con totales y salario coherentes, id con prefijo correcto → PASS', async () => {
    await assertSucceeds(
      asAdmin().collection('payrollSettlements').doc('worker-1_set1').set(settlementPayload()),
    );
  });

  test('bodeguero → DENIED', async () => {
    await assertFails(
      asBodeguero().collection('payrollSettlements').doc('worker-1_set2').set(settlementPayload()),
    );
  });

  test('entregador → DENIED', async () => {
    await assertFails(
      asEntregador().collection('payrollSettlements').doc('worker-1_set3').set(settlementPayload()),
    );
  });

  test('uid inexistente → DENIED', async () => {
    await assertFails(
      asAdmin().collection('payrollSettlements').doc('no-existe_set4').set(settlementPayload({ uid: 'no-existe' })),
    );
  });

  test('campo extra fuera del shape real → DENIED', async () => {
    await assertFails(
      asAdmin().collection('payrollSettlements').doc('worker-1_set5').set({ ...settlementPayload(), extra: 'x' }),
    );
  });

  test('paidBy spoof → DENIED', async () => {
    await assertFails(
      asAdmin().collection('payrollSettlements').doc('worker-1_set6').set(settlementPayload({ paidBy: 'otro@test.com' })),
    );
  });

  test('paidAt spoof → DENIED', async () => {
    await assertFails(
      asAdmin().collection('payrollSettlements').doc('worker-1_set7').set(settlementPayload({ paidAt: new Date('2020-01-01') })),
    );
  });

  test('netPay incorrecto (no coincide con salary - deductionsTotal) → DENIED', async () => {
    await assertFails(
      asAdmin().collection('payrollSettlements').doc('worker-1_set8').set(settlementPayload({ netPay: 9999 })),
    );
  });

  test('deductionsTotal incorrecto (no coincide con la suma de los tres parciales) → DENIED', async () => {
    await assertFails(
      asAdmin().collection('payrollSettlements').doc('worker-1_set9').set(settlementPayload({ deductionsTotal: 1 })),
    );
  });

  test('sin deducciones (periodo limpio) → PASS', async () => {
    await assertSucceeds(
      asAdmin().collection('payrollSettlements').doc('worker-1_set10').set(settlementPayload({
        advancesTotal: 0, purchasesTotal: 0, shortagesTotal: 0, deductionsTotal: 0,
        netPay: 5000, advanceIds: [], purchaseIds: [], shortageIds: [],
      })),
    );
  });

  test('update/delete de un settlement ya creado → DENIED (registro contable inmutable)', async () => {
    await seedSettlement('worker-1_set-immutable', settlementPayload());
    await assertFails(
      asAdmin().collection('payrollSettlements').doc('worker-1_set-immutable').update({ netPay: 1 }),
    );
    await assertFails(
      asAdmin().collection('payrollSettlements').doc('worker-1_set-immutable').delete(),
    );
  });

  // ── S1.10-F1: salary validado contra la fuente real ───────────────────────
  test('salary NO coincide con staffSalaries/{uid}.salary real → DENIED', async () => {
    await assertFails(
      asAdmin().collection('payrollSettlements').doc('worker-1_set11').set(settlementPayload({ salary: 9999 })),
    );
  });

  // ── S1.10-F6: el id debe empezar con el uid del propio settlement ────────
  test('id NO empieza con el uid del settlement → DENIED', async () => {
    await assertFails(
      asAdmin().collection('payrollSettlements').doc('otro-prefijo_set12').set(settlementPayload()),
    );
  });
});

// ── staffSalaries — S1.10-F1 ────────────────────────────────────────────────
describe('staffSalaries', () => {
  beforeEach(async () => {
    await seedSalary('worker-1', { salary: 5000, updatedAt: new Date(), updatedBy: 'admin-1@test.com' });
  });

  describe('read', () => {
    test('admin lee el salario de cualquier trabajador → PASS', async () => {
      await assertSucceeds(asAdmin().collection('staffSalaries').doc('worker-1').get());
    });

    test('el propio trabajador lee su salario → PASS', async () => {
      await assertSucceeds(
        testEnv.authenticatedContext('worker-1', { role: 'entregador', email: 'worker-1@test.com' })
          .firestore().collection('staffSalaries').doc('worker-1').get(),
      );
    });

    test('vendedor NO puede leer el salario de otro trabajador → DENIED', async () => {
      await assertFails(asVendedor().collection('staffSalaries').doc('worker-1').get());
    });

    test('entregador NO puede leer el salario de otro trabajador → DENIED', async () => {
      await assertFails(asEntregador().collection('staffSalaries').doc('worker-1').get());
    });

    test('bodeguero NO puede leer el salario de otro trabajador → DENIED', async () => {
      await assertFails(asBodeguero().collection('staffSalaries').doc('worker-1').get());
    });
  });

  describe('write', () => {
    const payload = (overrides = {}) => ({
      salary: 6000, updatedAt: serverTimestamp(), updatedBy: 'admin-1@test.com', ...overrides,
    });

    test('admin puede configurar el salario (primera vez, create implícito) → PASS', async () => {
      await seedUser('worker-2', { nombre: 'Beto', apellido: 'Solano', role: 'vendedor' });
      await assertSucceeds(asAdmin().collection('staffSalaries').doc('worker-2').set(payload()));
    });

    test('admin puede actualizar un salario existente → PASS', async () => {
      await assertSucceeds(asAdmin().collection('staffSalaries').doc('worker-1').set(payload()));
    });

    test('vendedor NO puede modificar salario → DENIED', async () => {
      await assertFails(asVendedor().collection('staffSalaries').doc('worker-1').set(payload()));
    });

    test('entregador NO puede modificar SU PROPIO salario → DENIED', async () => {
      await assertFails(
        testEnv.authenticatedContext('worker-1', { role: 'entregador', email: 'worker-1@test.com' })
          .firestore().collection('staffSalaries').doc('worker-1').set(payload()),
      );
    });

    test('campo arbitrario fuera del shape real → DENIED', async () => {
      await assertFails(
        asAdmin().collection('staffSalaries').doc('worker-1').set({ ...payload(), extra: 'x' }),
      );
    });

    test('salario negativo → DENIED', async () => {
      await assertFails(asAdmin().collection('staffSalaries').doc('worker-1').set(payload({ salary: -1 })));
    });

    test('actor spoof (updatedBy no coincide) → DENIED', async () => {
      await assertFails(
        asAdmin().collection('staffSalaries').doc('worker-1').set(payload({ updatedBy: 'otro@test.com' })),
      );
    });

    test('timestamp spoof (updatedAt no es request.time) → DENIED', async () => {
      await assertFails(
        asAdmin().collection('staffSalaries').doc('worker-1').set(payload({ updatedAt: new Date('2020-01-01') })),
      );
    });

    test('uid inexistente (no hay users/{uid}) → DENIED', async () => {
      await assertFails(asAdmin().collection('staffSalaries').doc('no-existe').set(payload()));
    });

    test('delete siempre rechazado', async () => {
      await assertFails(asAdmin().collection('staffSalaries').doc('worker-1').delete());
    });
  });
});

// ── users — S1.10-F1: salary ya no puede escribirse ahí ────────────────────
describe('users — salary ya no vive aquí', () => {
  beforeEach(async () => {
    await seedUser('worker-3', { nombre: 'Carla', apellido: 'Pérez', role: 'bodeguero' });
  });

  test('admin NO puede escribir salary en users.update → DENIED', async () => {
    await assertFails(
      asAdmin().collection('users').doc('worker-3').update({ salary: 1000 }),
    );
  });

  test('admin SÍ puede actualizar otros campos de users sin tocar salary → PASS', async () => {
    await assertSucceeds(
      asAdmin().collection('users').doc('worker-3').update({ nombre: 'Carla M.' }),
    );
  });

  test('migración: eliminar un salary legado con FieldValue.delete() → PASS', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('users').doc('worker-3').set(
        { nombre: 'Carla', apellido: 'Pérez', role: 'bodeguero', salary: 1500 },
        { merge: true },
      );
    });
    await assertSucceeds(
      asAdmin().collection('users').doc('worker-3').update({
        salary: firebaseCompat.firestore.FieldValue.delete(),
        salaryUpdatedAt: firebaseCompat.firestore.FieldValue.delete(),
        salaryUpdatedBy: firebaseCompat.firestore.FieldValue.delete(),
      }),
    );
  });
});

// ── S1.10-F6: concurrencia real contra el Emulator ──────────────────────────
// A diferencia del mock de Jest (lineal, sin aislamiento optimista), el
// Emulator SÍ aplica el mecanismo real de transacciones de Firestore: dos
// transacciones que compiten por el MISMO documento resuelven con exactamente
// una ganadora.
describe('S1.10-F6 — concurrencia real (Firestore Emulator)', () => {
  beforeEach(async () => {
    await seedAdvance('adv-race', { uid: 'worker-1', userName: 'Ana Ruiz', amount: 500, note: null, settlementId: null });
  });

  test('dos transacciones creando el MISMO settlement determinístico: solo una gana', async () => {
    const db = asAdmin();
    const settlementRef = db.collection('payrollSettlements').doc('worker-1_race');
    const advanceRef = db.collection('payrollAdvances').doc('adv-race');

    const attempt = () => db.runTransaction(async (tx) => {
      const existing = await tx.get(settlementRef);
      if (existing.exists) {
        throw new Error('ya existe');
      }
      tx.set(settlementRef, settlementPayload({
        advancesTotal: 500, purchasesTotal: 0, shortagesTotal: 0, deductionsTotal: 500,
        netPay: 4500, advanceIds: ['adv-race'], purchaseIds: [], shortageIds: [],
      }));
      tx.update(advanceRef, { settlementId: 'worker-1_race' });
    });

    const results = await Promise.allSettled([attempt(), attempt()]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);

    const finalAdvance = await db.collection('payrollAdvances').doc('adv-race').get();
    expect(finalAdvance.data().settlementId).toBe('worker-1_race');
  });
});
