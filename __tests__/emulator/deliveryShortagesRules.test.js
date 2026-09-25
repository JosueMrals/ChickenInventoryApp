/**
 * FASE S1.8.1 — regresión permanente de `deliveryShortages` (S1.8-F0, S1.8-F2,
 * S1-06). 4 shapes reales de create, cada uno con su propia validación
 * cruzada — ver `audit-reports/fase-s1-8-0-delivery-shortages-verification-security-audit.md`
 * y `fase-s1-8-1-delivery-shortages-security-rules-implementation.md`.
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
    projectId: 'chickeninventoryapp-emulator-test-delivery-shortages-rules',
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

const seed = (col) => async (id, data) => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection(col).doc(id).set(data);
  });
};
const seedReturnRequest = seed('returnRequests');
const seedPresale = seed('presales');
const seedExpense = seed('expenses');
const seedReimbursement = seed('reimbursements');
const seedUser = seed('users');
const seedShortage = seed('deliveryShortages');

// ── Payloads exactos de cada shape (S1.8.0 sección 3) ───────────────────────
const shape1Payload = (overrides = {}) => ({
  returnRequestId: 'rr1', presaleId: 'ps1', routeId: 'route1', routeName: 'Ruta 1',
  customerName: 'Juan Pérez', entregadorId: 'entregador-y',
  items: [{ productId: 'p1', productName: 'Pollo', isBonus: false, expectedQty: 2, receivedQty: 1, missingQty: 1, unitPrice: 50, missingValue: 50 }],
  totalMissingQty: 1, totalMissingValue: 50, status: 'pending',
  recordedBy: 'bodeguero-x@test.com', recordedByUid: 'bodeguero-x', recordedAt: new Date(),
  ...overrides,
});

const shape2Payload = (overrides = {}) => ({
  entregadorId: 'entregador-y', customerName: 'Cierre de caja · entregador-y',
  totalMissingValue: 30, status: 'pending', recordedAt: new Date(),
  ...overrides,
});

const shape3aPayload = (overrides = {}) => ({
  expenseId: 'exp1', cashClosingId: 'turno1', reason: 'expense_rejected_post_close',
  entregadorId: 'vendedor-a', totalMissingValue: 500, status: 'pending', recordedAt: new Date(),
  ...overrides,
});

const shape3bPayload = (overrides = {}) => ({
  expenseId: 'exp2', reason: 'reimbursement_rejected_post_paid',
  entregadorId: 'vendedor-b', totalMissingValue: 300, status: 'pending', recordedAt: new Date(),
  ...overrides,
});

// ── CREATE — shape 1 (Return) ───────────────────────────────────────────────
describe('S1.8.1 — deliveryShortages.create shape 1 (Return)', () => {
  beforeEach(async () => {
    await seedReturnRequest('rr1', {
      status: 'approved', presaleId: 'ps1', routeId: 'route1', routeName: 'Ruta 1',
      customerName: 'Juan Pérez', entregadorId: 'entregador-y',
    });
    await seedPresale('ps1', { status: 'dispatched', entregadorId: 'entregador-y' });
  });

  test('bodeguero crea shape 1 legítimo → PASS', async () => {
    await assertSucceeds(asBodeguero('bodeguero-x').collection('deliveryShortages').doc('s1').set(shape1Payload()));
  });

  test('admin crea shape 1 legítimo → PASS', async () => {
    await assertSucceeds(asAdmin('admin-1').collection('deliveryShortages').doc('s2').set(shape1Payload({ recordedBy: 'admin-1@test.com', recordedByUid: 'admin-1' })));
  });

  test('fallback: returnRequest.entregadorId es null, se usa presale.entregadorId', async () => {
    await seedReturnRequest('rr-fallback', {
      status: 'approved', presaleId: 'ps-fallback', routeId: 'route1', routeName: 'Ruta 1',
      customerName: 'Juan Pérez', entregadorId: null,
    });
    await seedPresale('ps-fallback', { status: 'dispatched', entregadorId: 'entregador-z' });
    await assertSucceeds(
      asBodeguero('bodeguero-x').collection('deliveryShortages').doc('s3').set(
        shape1Payload({ returnRequestId: 'rr-fallback', presaleId: 'ps-fallback', entregadorId: 'entregador-z' })
      )
    );
  });

  test('vendedor NO puede crear shape 1 (isWarehouseResolution excluye vendedor)', async () => {
    await assertFails(asVendedor('vendedor-x').collection('deliveryShortages').doc('s4').set(shape1Payload()));
  });

  test('entregador NO puede crear shape 1 (excluido desde S1.5.1)', async () => {
    await assertFails(asEntregador('entregador-x').collection('deliveryShortages').doc('s5').set(shape1Payload()));
  });

  test('usuario sin rol NO puede crear', async () => {
    await assertFails(asNoRole().collection('deliveryShortages').doc('s6').set(shape1Payload()));
  });

  test('totalMissingValue negativo → DENIED', async () => {
    await assertFails(asBodeguero('bodeguero-x').collection('deliveryShortages').doc('s7').set(shape1Payload({ totalMissingValue: -50 })));
  });

  test('totalMissingValue cero → DENIED', async () => {
    await assertFails(asBodeguero('bodeguero-x').collection('deliveryShortages').doc('s8').set(shape1Payload({ totalMissingValue: 0 })));
  });

  test('totalMissingValue string → DENIED', async () => {
    await assertFails(asBodeguero('bodeguero-x').collection('deliveryShortages').doc('s9').set(shape1Payload({ totalMissingValue: '50' })));
  });

  test('returnRequestId inexistente → DENIED', async () => {
    await assertFails(asBodeguero('bodeguero-x').collection('deliveryShortages').doc('s10').set(shape1Payload({ returnRequestId: 'rr-no-existe' })));
  });

  test('recordedByUid falsificado (no coincide con el actor autenticado) → DENIED', async () => {
    await assertFails(
      asBodeguero('bodeguero-x').collection('deliveryShortages').doc('s11').set(
        shape1Payload({ recordedByUid: 'otro-uid' })
      )
    );
  });

  test('presaleId ajeno (de otra pre-venta real, no la del returnRequest) → DENIED', async () => {
    await seedPresale('ps-otra', { status: 'dispatched', entregadorId: 'entregador-w' });
    await assertFails(
      asBodeguero('bodeguero-x').collection('deliveryShortages').doc('s12').set(
        shape1Payload({ presaleId: 'ps-otra' })
      )
    );
  });

  test('entregadorId incorrecto respecto al returnRequest real → DENIED', async () => {
    await assertFails(
      asBodeguero('bodeguero-x').collection('deliveryShortages').doc('s13').set(
        shape1Payload({ entregadorId: 'entregador-fabricado' })
      )
    );
  });

  test('campo extra fuera del shape → DENIED', async () => {
    await assertFails(
      asBodeguero('bodeguero-x').collection('deliveryShortages').doc('s14').set({
        ...shape1Payload(), discountCode: 'x',
      })
    );
  });

  test('status distinto de pending → DENIED', async () => {
    await assertFails(
      asBodeguero('bodeguero-x').collection('deliveryShortages').doc('s15').set(
        shape1Payload({ status: 'fulfilled' })
      )
    );
  });
});

// ── CREATE — shape 2 (Cash closing) ─────────────────────────────────────────
describe('S1.8.1 — deliveryShortages.create shape 2 (Cash closing)', () => {
  beforeEach(async () => {
    await seedUser('entregador-y', { role: 'entregador', email: 'entregador-y@test.com' });
  });

  test('admin crea shape 2 legítimo → PASS', async () => {
    await assertSucceeds(asAdmin('admin-1').collection('deliveryShortages').doc('cc1').set(shape2Payload()));
  });

  test('bodeguero NO puede crear shape 2 (reviewTurno es admin-only)', async () => {
    await assertFails(asBodeguero('bodeguero-x').collection('deliveryShortages').doc('cc2').set(shape2Payload()));
  });

  test('vendedor NO puede crear shape 2', async () => {
    await assertFails(asVendedor('vendedor-x').collection('deliveryShortages').doc('cc3').set(shape2Payload()));
  });

  test('entregadorId de un usuario inexistente → DENIED', async () => {
    await assertFails(
      asAdmin('admin-1').collection('deliveryShortages').doc('cc4').set(
        shape2Payload({ entregadorId: 'usuario-fantasma' })
      )
    );
  });

  test('totalMissingValue negativo → DENIED', async () => {
    await assertFails(asAdmin('admin-1').collection('deliveryShortages').doc('cc5').set(shape2Payload({ totalMissingValue: -30 })));
  });

  test('campo extra (mezcla con shape 1, returnRequestId) → DENIED', async () => {
    await assertFails(
      asAdmin('admin-1').collection('deliveryShortages').doc('cc6').set({
        ...shape2Payload(), returnRequestId: 'rr1',
      })
    );
  });
});

// ── CREATE — shape 3a (Expense rejected post-close) ─────────────────────────
describe('S1.8.1 — deliveryShortages.create shape 3a (Expense)', () => {
  beforeEach(async () => {
    await seedExpense('exp1', {
      status: 'REJECTED', createdByUid: 'vendedor-a', amount: 500,
      cashClosingId: 'turno1', paymentMethod: 'CASH',
    });
  });

  test('admin crea shape 3a legítimo → PASS', async () => {
    await assertSucceeds(asAdmin('admin-1').collection('deliveryShortages').doc('e1').set(shape3aPayload()));
  });

  test('bodeguero NO puede crear shape 3a (reviewExpense es admin-only)', async () => {
    await assertFails(asBodeguero('bodeguero-x').collection('deliveryShortages').doc('e2').set(shape3aPayload()));
  });

  test('expenseId ajeno (de otro gasto real) → DENIED', async () => {
    await seedExpense('exp-otro', { status: 'REJECTED', createdByUid: 'vendedor-z', amount: 999, cashClosingId: 'turno9' });
    await assertFails(
      asAdmin('admin-1').collection('deliveryShortages').doc('e3').set(
        shape3aPayload({ expenseId: 'exp-otro' })
      )
    );
  });

  test('cashClosingId ajeno (no coincide con el gasto real) → DENIED', async () => {
    await assertFails(
      asAdmin('admin-1').collection('deliveryShortages').doc('e4').set(
        shape3aPayload({ cashClosingId: 'turno-fabricado' })
      )
    );
  });

  test('entregadorId ajeno (no coincide con createdByUid del gasto) → DENIED', async () => {
    await assertFails(
      asAdmin('admin-1').collection('deliveryShortages').doc('e5').set(
        shape3aPayload({ entregadorId: 'empleado-inocente' })
      )
    );
  });

  test('totalMissingValue no coincide con el amount real del gasto → DENIED', async () => {
    await assertFails(
      asAdmin('admin-1').collection('deliveryShortages').doc('e6').set(
        shape3aPayload({ totalMissingValue: 999999 })
      )
    );
  });

  test('expenseId inexistente → DENIED', async () => {
    await assertFails(
      asAdmin('admin-1').collection('deliveryShortages').doc('e7').set(
        shape3aPayload({ expenseId: 'exp-no-existe' })
      )
    );
  });
});

// ── CREATE — shape 3b (Reimbursement rejected post-paid) ────────────────────
describe('S1.8.1 — deliveryShortages.create shape 3b (Reimbursement)', () => {
  beforeEach(async () => {
    await seedReimbursement('exp2', { status: 'PAID', createdByUid: 'vendedor-b', amount: 300, expenseId: 'exp2' });
  });

  test('admin crea shape 3b legítimo → PASS', async () => {
    await assertSucceeds(asAdmin('admin-1').collection('deliveryShortages').doc('r1').set(shape3bPayload()));
  });

  test('reimbursement NO está PAID → DENIED', async () => {
    await seedReimbursement('exp3', { status: 'PENDING', createdByUid: 'vendedor-c', amount: 200, expenseId: 'exp3' });
    await assertFails(
      asAdmin('admin-1').collection('deliveryShortages').doc('r2').set(
        shape3bPayload({ expenseId: 'exp3', entregadorId: 'vendedor-c', totalMissingValue: 200 })
      )
    );
  });

  test('entregadorId ajeno (no coincide con createdByUid del reembolso) → DENIED', async () => {
    await assertFails(
      asAdmin('admin-1').collection('deliveryShortages').doc('r3').set(
        shape3bPayload({ entregadorId: 'empleado-inocente' })
      )
    );
  });

  test('totalMissingValue no coincide con el amount real del reembolso → DENIED', async () => {
    await assertFails(
      asAdmin('admin-1').collection('deliveryShortages').doc('r4').set(
        shape3bPayload({ totalMissingValue: 1 })
      )
    );
  });

  test('mezcla shape 3a + 3b (incluye cashClosingId, exclusivo de 3a, con reason de 3b) → DENIED', async () => {
    await assertFails(
      asAdmin('admin-1').collection('deliveryShortages').doc('r5').set({
        ...shape3bPayload(), cashClosingId: 'turno1',
      })
    );
  });
});

// ── READ (S1-06) ─────────────────────────────────────────────────────────────
describe('S1.8.1 — deliveryShortages.read (S1-06)', () => {
  test('admin lee cualquier shortage', async () => {
    await seedShortage('rd1', shape2Payload({ entregadorId: 'entregador-y' }));
    await assertSucceeds(asAdmin('admin-1').collection('deliveryShortages').doc('rd1').get());
  });

  test('bodeguero lee cualquier shortage', async () => {
    await seedShortage('rd2', shape2Payload({ entregadorId: 'entregador-y' }));
    await assertSucceeds(asBodeguero('bodeguero-x').collection('deliveryShortages').doc('rd2').get());
  });

  test('entregador lee su propio shortage', async () => {
    await seedShortage('rd3', shape2Payload({ entregadorId: 'entregador-x' }));
    await assertSucceeds(asEntregador('entregador-x').collection('deliveryShortages').doc('rd3').get());
  });

  test('entregador NO puede leer el shortage de otro entregador', async () => {
    await seedShortage('rd4', shape2Payload({ entregadorId: 'entregador-y' }));
    await assertFails(asEntregador('entregador-x').collection('deliveryShortages').doc('rd4').get());
  });

  test('vendedor NO puede leer (sin reader real encontrado en S1.8.0)', async () => {
    await seedShortage('rd5', shape2Payload({ entregadorId: 'entregador-y' }));
    await assertFails(asVendedor('vendedor-x').collection('deliveryShortages').doc('rd5').get());
  });

  test('usuario no autorizado NO puede leer', async () => {
    await seedShortage('rd6', shape2Payload({ entregadorId: 'entregador-y' }));
    await assertFails(asNoRole().collection('deliveryShortages').doc('rd6').get());
  });

  test('bodeguero puede listar (query global, ShortagesList sin filtro)', async () => {
    await seedShortage('rd7', shape2Payload({ entregadorId: 'entregador-y' }));
    await assertSucceeds(asBodeguero('bodeguero-x').collection('deliveryShortages').get());
  });

  test('entregador puede listar SOLO sus propios (con el filtro real de ReturnsScreen.jsx)', async () => {
    await seedShortage('rd8', shape2Payload({ entregadorId: 'entregador-x' }));
    await assertSucceeds(
      asEntregador('entregador-x').collection('deliveryShortages').where('entregadorId', '==', 'entregador-x').get()
    );
  });
});

// ── UPDATE — fulfilled ───────────────────────────────────────────────────────
describe('S1.8.1 — deliveryShortages.update (pending→fulfilled)', () => {
  test('bodeguero marca fulfilled con el payload real → PASS', async () => {
    await seedShortage('f1', shape1Payload());
    await assertSucceeds(
      asBodeguero('bodeguero-x').collection('deliveryShortages').doc('f1').update({
        status: 'fulfilled', fulfilledBy: 'bodeguero-x@test.com', fulfilledByUid: 'bodeguero-x',
        fulfilledAt: new Date(), fulfillmentNote: 'Repuesto en bodega',
      })
    );
  });

  test('cambia totalMissingValue durante el cumplimiento → DENIED', async () => {
    await seedShortage('f2', shape1Payload());
    await assertFails(
      asBodeguero('bodeguero-x').collection('deliveryShortages').doc('f2').update({
        status: 'fulfilled', fulfilledBy: 'bodeguero-x@test.com', fulfilledByUid: 'bodeguero-x',
        fulfilledAt: new Date(), fulfillmentNote: null, totalMissingValue: 1,
      })
    );
  });

  test('cambia entregadorId durante el cumplimiento → DENIED', async () => {
    await seedShortage('f3', shape1Payload());
    await assertFails(
      asBodeguero('bodeguero-x').collection('deliveryShortages').doc('f3').update({
        status: 'fulfilled', fulfilledBy: 'bodeguero-x@test.com', fulfilledByUid: 'bodeguero-x',
        fulfilledAt: new Date(), fulfillmentNote: null, entregadorId: 'otro',
      })
    );
  });

  test('agrega campo extra → DENIED', async () => {
    await seedShortage('f4', shape1Payload());
    await assertFails(
      asBodeguero('bodeguero-x').collection('deliveryShortages').doc('f4').update({
        status: 'fulfilled', fulfilledBy: 'bodeguero-x@test.com', fulfilledByUid: 'bodeguero-x',
        fulfilledAt: new Date(), fulfillmentNote: null, presaleId: 'otra-ps',
      })
    );
  });

  test('fulfilledByUid falsificado (no coincide con el actor) → DENIED', async () => {
    await seedShortage('f5', shape1Payload());
    await assertFails(
      asBodeguero('bodeguero-x').collection('deliveryShortages').doc('f5').update({
        status: 'fulfilled', fulfilledBy: 'bodeguero-x@test.com', fulfilledByUid: 'otro-uid',
        fulfilledAt: new Date(), fulfillmentNote: null,
      })
    );
  });
});

// ── UPDATE — payroll_deducted ────────────────────────────────────────────────
describe('S1.8.1 — deliveryShortages.update (pending→payroll_deducted)', () => {
  test('admin marca payroll_deducted con el payload real → PASS', async () => {
    await seedShortage('p1', shape1Payload());
    await assertSucceeds(
      asAdmin('admin-1').collection('deliveryShortages').doc('p1').update({
        status: 'payroll_deducted', payrollSettlementId: 'settle-1', payrollDeductedAt: new Date(),
      })
    );
  });

  test('cambia totalMissingValue durante la deducción → DENIED', async () => {
    await seedShortage('p2', shape1Payload());
    await assertFails(
      asAdmin('admin-1').collection('deliveryShortages').doc('p2').update({
        status: 'payroll_deducted', payrollSettlementId: 'settle-1', payrollDeductedAt: new Date(),
        totalMissingValue: 1,
      })
    );
  });

  test('cambia entregadorId durante la deducción → DENIED', async () => {
    await seedShortage('p3', shape1Payload());
    await assertFails(
      asAdmin('admin-1').collection('deliveryShortages').doc('p3').update({
        status: 'payroll_deducted', payrollSettlementId: 'settle-1', payrollDeductedAt: new Date(),
        entregadorId: 'otro',
      })
    );
  });

  test('bodeguero NO puede deducir de nómina', async () => {
    await seedShortage('p4', shape1Payload());
    await assertFails(
      asBodeguero('bodeguero-x').collection('deliveryShortages').doc('p4').update({
        status: 'payroll_deducted', payrollSettlementId: 'settle-1', payrollDeductedAt: new Date(),
      })
    );
  });

  test('un shortage ya resuelto (fulfilled) no puede pasar a payroll_deducted', async () => {
    await seedShortage('p5', shape1Payload({ status: 'fulfilled' }));
    await assertFails(
      asAdmin('admin-1').collection('deliveryShortages').doc('p5').update({
        status: 'payroll_deducted', payrollSettlementId: 'settle-1', payrollDeductedAt: new Date(),
      })
    );
  });
});

// ── Regresión de flujos completos (transacciones reales) ────────────────────
describe('S1.8.1 — regresión de flujos completos', () => {
  test('return → deliveryShortage (returnRequests.update + presales.update + deliveryShortages.create, misma transacción)', async () => {
    await seedReturnRequest('rr-flow', {
      status: 'pending_review', presaleId: 'ps-flow', routeId: 'r1', routeName: 'Ruta 1',
      customerName: 'Cliente', entregadorId: 'entregador-y',
    });
    await seedPresale('ps-flow', {
      status: 'dispatched', entregadorId: 'entregador-y',
      items: [{ productId: 'p1', quantity: 2, unitPrice: 50, total: 100 }], bonuses: [],
      subtotal: 100, total: 100, totalDiscount: 0,
    });
    const db = asBodeguero('bodeguero-x');
    await assertSucceeds(
      db.runTransaction(async (tx) => {
        tx.update(db.collection('returnRequests').doc('rr-flow'), {
          status: 'approved', confirmedBy: 'bodeguero-x@test.com', confirmedAt: new Date(),
          verifiedItems: [], hasShortages: true,
        });
        tx.update(db.collection('presales').doc('ps-flow'), {
          items: [], bonuses: [], subtotal: 0, total: 0, totalDiscount: 0,
          returnedSummary: [{ productId: 'p1', quantity: 2, total: 100 }], returnedTotal: 100,
          status: 'returned', returnedAt: new Date(), lastReturnAt: new Date(), returnApprovedBy: 'bodeguero-x@test.com',
        });
        tx.set(db.collection('deliveryShortages').doc(), shape1Payload({
          returnRequestId: 'rr-flow', presaleId: 'ps-flow', routeId: 'r1', routeName: 'Ruta 1',
          customerName: 'Cliente', entregadorId: 'entregador-y',
          recordedBy: 'bodeguero-x@test.com', recordedByUid: 'bodeguero-x',
        }));
      })
    );
  });

  test('cashClosing → deliveryShortage (cashClosings.update + deliveryShortages.create, misma transacción)', async () => {
    await seedUser('entregador-y', { role: 'entregador' });
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('cashClosings').doc('turno-flow').set({
        uid: 'entregador-y', userName: 'entregador-y@test.com', role: 'entregador', status: 'pending_review',
        openedAt: new Date(), closedAt: new Date(), collectionIds: [], expectedAmount: 100,
        cashExpensesTotal: 0, receivedAmount: null, shortageAmount: 0,
        reviewedAt: null, reviewedBy: null, shortageId: null,
      });
    });
    const db = asAdmin('admin-1');
    const shortageRef = db.collection('deliveryShortages').doc();
    await assertSucceeds(
      db.runTransaction(async (tx) => {
        tx.update(db.collection('cashClosings').doc('turno-flow'), {
          status: 'shortage', receivedAmount: 70, shortageAmount: 30,
          reviewedAt: new Date(), reviewedBy: 'admin-1@test.com', shortageId: shortageRef.id,
        });
        tx.set(shortageRef, shape2Payload({ entregadorId: 'entregador-y', totalMissingValue: 30 }));
      })
    );
  });

  test('expense rejected → deliveryShortage (expenses.update + deliveryShortages.create)', async () => {
    await seedExpense('exp-flow', {
      status: 'PENDING', createdByUid: 'vendedor-a', amount: 500, cashClosingId: 'turno-x',
      paymentMethod: 'CASH', category: 'FUEL', reviewedByUid: null, reviewedAt: null,
    });
    const db = asAdmin('admin-1');
    await assertSucceeds(
      db.runTransaction(async (tx) => {
        tx.update(db.collection('expenses').doc('exp-flow'), {
          status: 'REJECTED', reviewedByUid: 'admin-1', reviewedAt: new Date(),
        });
        tx.set(db.collection('deliveryShortages').doc(), shape3aPayload({
          expenseId: 'exp-flow', cashClosingId: 'turno-x', entregadorId: 'vendedor-a', totalMissingValue: 500,
        }));
      })
    );
  });

  test('reimbursement rejected → deliveryShortage (deliveryShortages.create solo, sin update del reimbursement ya PAID)', async () => {
    await seedExpense('exp-flow2', {
      status: 'APPROVED', createdByUid: 'vendedor-b', amount: 300, cashClosingId: null,
      paymentMethod: 'PERSONAL', category: 'FUEL', reviewedByUid: 'admin-1', reviewedAt: new Date(),
    });
    await seedReimbursement('exp-flow2', { status: 'PAID', createdByUid: 'vendedor-b', amount: 300, expenseId: 'exp-flow2' });
    const db = asAdmin('admin-1');
    await assertSucceeds(
      db.runTransaction(async (tx) => {
        tx.update(db.collection('expenses').doc('exp-flow2'), {
          status: 'REJECTED', reviewedByUid: 'admin-1', reviewedAt: new Date(),
        });
        tx.set(db.collection('deliveryShortages').doc(), shape3bPayload({
          expenseId: 'exp-flow2', entregadorId: 'vendedor-b', totalMissingValue: 300,
        }));
      })
    );
  });

  test('deliveryShortage → fulfilled (flujo completo)', async () => {
    await seedShortage('flow-f', shape1Payload());
    await assertSucceeds(
      asBodeguero('bodeguero-x').collection('deliveryShortages').doc('flow-f').update({
        status: 'fulfilled', fulfilledBy: 'bodeguero-x@test.com', fulfilledByUid: 'bodeguero-x',
        fulfilledAt: new Date(), fulfillmentNote: null,
      })
    );
  });

  test('deliveryShortage → payroll_deducted (flujo completo)', async () => {
    await seedShortage('flow-p', shape1Payload());
    await assertSucceeds(
      asAdmin('admin-1').collection('deliveryShortages').doc('flow-p').update({
        status: 'payroll_deducted', payrollSettlementId: 'settle-flow', payrollDeductedAt: new Date(),
      })
    );
  });
});

// ── Cross-document attacks explícitos (Parte 10) ────────────────────────────
describe('S1.8.1 — cross-document attacks', () => {
  test('shortage A (returnRequestId real) + presaleId de B (pre-venta real distinta) → DENIED', async () => {
    await seedReturnRequest('rrA', { status: 'approved', presaleId: 'psA', routeId: 'r1', routeName: 'R1', customerName: 'A', entregadorId: 'entregador-A' });
    await seedPresale('psA', { status: 'dispatched', entregadorId: 'entregador-A' });
    await seedPresale('psB', { status: 'dispatched', entregadorId: 'entregador-B' });
    await assertFails(
      asBodeguero('bodeguero-x').collection('deliveryShortages').doc('x1').set(
        shape1Payload({ returnRequestId: 'rrA', presaleId: 'psB', entregadorId: 'entregador-A' })
      )
    );
  });

  test('shortage A (returnRequestId real) + entregadorId de otro empleado (B) → DENIED', async () => {
    await seedReturnRequest('rrC', { status: 'approved', presaleId: 'psC', routeId: 'r1', routeName: 'R1', customerName: 'C', entregadorId: 'entregador-C' });
    await seedPresale('psC', { status: 'dispatched', entregadorId: 'entregador-C' });
    await assertFails(
      asBodeguero('bodeguero-x').collection('deliveryShortages').doc('x2').set(
        shape1Payload({ returnRequestId: 'rrC', presaleId: 'psC', entregadorId: 'entregador-D' })
      )
    );
  });

  test('shortage (expenseId real) + entregadorId de otro empleado → DENIED', async () => {
    await seedExpense('expD', { status: 'REJECTED', createdByUid: 'vendedor-D', amount: 100, cashClosingId: 'turnoD' });
    await assertFails(
      asAdmin('admin-1').collection('deliveryShortages').doc('x3').set(
        shape3aPayload({ expenseId: 'expD', cashClosingId: 'turnoD', entregadorId: 'vendedor-E', totalMissingValue: 100 })
      )
    );
  });
});
