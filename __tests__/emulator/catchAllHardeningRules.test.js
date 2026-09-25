/**
 * FASE S1.2 — matriz de regresión del hardening del catch-all (S1-01).
 *
 * El hallazgo de S1.0 no era "se puede leer un documento por id" (eso ya lo
 * probaban los archivos por colección) — era que se podía volcar una
 * COLECCIÓN ENTERA con `.get()` sin filtro, sin conocer ningún id. Este
 * archivo prueba exactamente ese escenario (`list`, no solo `get`) para cada
 * colección sensible, más que los lectores operativos legítimos (products,
 * customers, presales) sigan funcionando tras quitar el fallback global.
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
    projectId: 'chickeninventoryapp-emulator-test-catchall-hardening',
    firestore: {
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

afterEach(async () => {
  if (testEnv) await testEnv.clearFirestore();
});

const asVendedor = (uid = 'vendedor-x') => testEnv.authenticatedContext(uid, { role: 'vendedor' }).firestore();
const asBodeguero = (uid = 'bodeguero-x') => testEnv.authenticatedContext(uid, { role: 'bodeguero' }).firestore();
const asEntregador = (uid = 'entregador-x') => testEnv.authenticatedContext(uid, { role: 'entregador' }).firestore();
const asAdmin = () => testEnv.authenticatedContext('admin-1', { role: 'admin' }).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

const seed = async (col, id, data) => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection(col).doc(id).set(data);
  });
};

describe('S1.2 — deny-by-default: LIST sin restricción ya NO es posible', () => {
  test('un vendedor NO puede listar (volcar) expenses de otros usuarios', async () => {
    await seed('expenses', 'e1', { createdByUid: 'otro-user', amount: 500, status: 'PENDING', paymentMethod: 'CASH' });
    await seed('expenses', 'e2', { createdByUid: 'otro-user-2', amount: 300, status: 'APPROVED', paymentMethod: 'PERSONAL' });
    await assertFails(asVendedor().collection('expenses').get());
  });

  test('un vendedor NO puede listar reimbursements de otros usuarios', async () => {
    await seed('reimbursements', 'r1', { expenseId: 'r1', createdByUid: 'otro-user', amount: 300, status: 'PENDING' });
    await assertFails(asVendedor().collection('reimbursements').get());
  });

  test('un vendedor NO puede listar cashOutflows', async () => {
    await seed('reimbursements', 'r1', { expenseId: 'r1', createdByUid: 'otro-user', amount: 300, status: 'PAID' });
    await seed('cashOutflows', 'r1', { expenseId: 'r1', amount: 300, paymentMethod: 'CASH', paidByUid: 'admin-1' });
    await assertFails(asVendedor().collection('cashOutflows').get());
  });

  test('un vendedor NO puede listar financials (ledger completo)', async () => {
    await seed('financials', 'f1', { type: 'expense', amount: 999 });
    await assertFails(asVendedor().collection('financials').get());
  });

  test('un vendedor NO puede listar payrollAdvances (salarios de otros)', async () => {
    await seed('payrollAdvances', 'a1', { uid: 'entregador-1', amount: 500, settlementId: null });
    await seed('payrollAdvances', 'a2', { uid: 'entregador-2', amount: 700, settlementId: null });
    await assertFails(asVendedor().collection('payrollAdvances').get());
  });

  test('un vendedor NO puede listar staffPurchases de otros', async () => {
    await seed('staffPurchases', 'p1', { uid: 'entregador-1', total: 200, settlementId: null });
    await assertFails(asVendedor().collection('staffPurchases').get());
  });

  test('un vendedor NO puede listar payrollSettlements (pagos de nómina)', async () => {
    await seed('payrollSettlements', 's1', { uid: 'entregador-1', netPay: 4500 });
    await assertFails(asVendedor().collection('payrollSettlements').get());
  });

  test('un usuario NO autenticado no puede leer nada (ni con el catch-all cerrado)', async () => {
    await seed('products', 'p1', { name: 'Pollo', stock: 10 });
    await assertFails(asAnon().collection('products').doc('p1').get());
  });
});

describe('S1.2 — cross-user GET sigue bloqueado (regresión, ya cubierto por archivo propio, se repite aquí como matriz final)', () => {
  test('user-A no puede leer el expense de user-B', async () => {
    await seed('expenses', 'e1', { createdByUid: 'user-B', amount: 500, status: 'PENDING', paymentMethod: 'CASH' });
    await assertFails(asVendedor('user-A').collection('expenses').doc('e1').get());
  });

  test('user-A no puede leer el reimbursement de user-B', async () => {
    await seed('reimbursements', 'e1', { expenseId: 'e1', createdByUid: 'user-B', amount: 300, status: 'PENDING' });
    await assertFails(asVendedor('user-A').collection('reimbursements').doc('e1').get());
  });

  test('user-A no puede leer el cashOutflow de user-B', async () => {
    await seed('reimbursements', 'e1', { expenseId: 'e1', createdByUid: 'user-B', amount: 300, status: 'PAID' });
    await seed('cashOutflows', 'e1', { expenseId: 'e1', amount: 300, paymentMethod: 'CASH', paidByUid: 'admin-1' });
    await assertFails(asVendedor('user-A').collection('cashOutflows').doc('e1').get());
  });
});

describe('S1.2 — admin conserva lectura administrativa completa', () => {
  test('admin puede listar expenses de todos los usuarios', async () => {
    await seed('expenses', 'e1', { createdByUid: 'u1', amount: 500, status: 'PENDING', paymentMethod: 'CASH' });
    await seed('expenses', 'e2', { createdByUid: 'u2', amount: 300, status: 'APPROVED', paymentMethod: 'PERSONAL' });
    const snap = await assertSucceeds(asAdmin().collection('expenses').get());
    expect(snap.size).toBe(2);
  });

  test('admin puede listar reimbursements de todos los usuarios', async () => {
    await seed('reimbursements', 'r1', { expenseId: 'r1', createdByUid: 'u1', amount: 300, status: 'PENDING' });
    const snap = await assertSucceeds(asAdmin().collection('reimbursements').get());
    expect(snap.size).toBe(1);
  });

  test('admin puede listar financials completo', async () => {
    await seed('financials', 'f1', { type: 'expense', amount: 999 });
    const snap = await assertSucceeds(asAdmin().collection('financials').get());
    expect(snap.size).toBe(1);
  });

  test('admin puede listar payrollAdvances de todos los trabajadores', async () => {
    await seed('payrollAdvances', 'a1', { uid: 'entregador-1', amount: 500, settlementId: null });
    const snap = await assertSucceeds(asAdmin().collection('payrollAdvances').get());
    expect(snap.size).toBe(1);
  });
});

describe('S1.2 — lecturas operativas legítimas siguen funcionando (sin depender del catch-all)', () => {
  test('vendedor puede listar products (lectura operativa global)', async () => {
    await seed('products', 'p1', { name: 'Pollo entero', stock: 20 });
    await assertSucceeds(asVendedor().collection('products').get());
  });

  test('vendedor puede listar customers', async () => {
    await seed('customers', 'c1', { firstName: 'Juan', lastName: 'Pérez' });
    await assertSucceeds(asVendedor().collection('customers').get());
  });

  test('vendedor puede listar presales', async () => {
    await seed('presales', 'ps1', { status: 'pending', total: 100 });
    await assertSucceeds(asVendedor().collection('presales').get());
  });

  test('bodeguero puede leer un credit vinculado (handover masivo, ProductHandoverScreen)', async () => {
    await seed('credits', 'cr1', { total: 500, paid: 0, pending: 500, status: 'pending' });
    await assertSucceeds(asBodeguero().collection('credits').doc('cr1').get());
  });

  test('entregador puede listar sus propias presales asignadas', async () => {
    await seed('presales', 'ps2', { status: 'dispatched', entregadorId: 'entregador-x', total: 100 });
    await assertSucceeds(asEntregador().collection('presales').where('entregadorId', '==', 'entregador-x').get());
  });

  test('vendedor puede leer users (directorio de personal, isOperativo())', async () => {
    await seed('users', 'u1', { email: 'a@test.com', role: 'vendedor' });
    await assertSucceeds(asVendedor().collection('users').get());
  });

  test('un usuario sin rol (auto-registrado, FASE S1.1) NO puede leer users', async () => {
    await seed('users', 'u1', { email: 'a@test.com', role: 'vendedor' });
    const noRole = testEnv.authenticatedContext('user-sin-rol').firestore();
    await assertFails(noRole.collection('users').get());
  });
});
