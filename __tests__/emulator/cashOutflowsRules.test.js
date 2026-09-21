/**
 * Regresión de las reglas de `cashOutflows` contra Firestore Emulator real
 * (FASE E6.2). Ledger inmutable del pago de un reembolso — nunca lo crea el
 * cliente a mano fuera del flujo administrativo (payReimbursement()).
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
    projectId: 'chickeninventoryapp-emulator-test-cashoutflows',
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

const asAdmin = () => testEnv.authenticatedContext('admin-1', { role: 'admin' }).firestore();
const asOwner = () => testEnv.authenticatedContext('u1', { role: 'vendedor' }).firestore();
const asOther = () => testEnv.authenticatedContext('u2', { role: 'vendedor' }).firestore();

const reimbursementDoc = (overrides = {}) => ({
  expenseId: 'e1', createdByUid: 'u1', amount: 500, status: 'PENDING',
  createdAt: new Date(), paidAt: null, paidByUid: null, cancelledAt: null,
  cancelledByUid: null, paymentMethod: null, notes: null,
  ...overrides,
});

const outflowDoc = (overrides = {}) => ({
  expenseId: 'e1', amount: 500, paymentMethod: 'CASH',
  paidAt: new Date(), paidByUid: 'admin-1', reference: null, notes: null,
  ...overrides,
});

const seedReimbursement = async (id, data) => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('reimbursements').doc(id).set(data);
  });
};

const seedOutflow = async (id, data) => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('cashOutflows').doc(id).set(data);
  });
};

describe('cashOutflows — Rules (FASE E6.2)', () => {
  test('admin puede crear el cashOutflow cuando el monto coincide con el reimbursement', async () => {
    await seedReimbursement('e1', reimbursementDoc());
    await assertSucceeds(asAdmin().collection('cashOutflows').doc('e1').set(outflowDoc()));
  });

  test('rechaza un monto que no coincide con reimbursements/{expenseId}.amount', async () => {
    await seedReimbursement('e1', reimbursementDoc({ amount: 500 }));
    await assertFails(asAdmin().collection('cashOutflows').doc('e1').set(outflowDoc({ amount: 999 })));
  });

  test('rechaza expenseId que no coincide con el id del documento', async () => {
    await seedReimbursement('e1', reimbursementDoc());
    await assertFails(asAdmin().collection('cashOutflows').doc('e1').set(outflowDoc({ expenseId: 'otro' })));
  });

  test('rechaza paymentMethod CARD (solo CASH/TRANSFER)', async () => {
    await seedReimbursement('e1', reimbursementDoc());
    await assertFails(asAdmin().collection('cashOutflows').doc('e1').set(outflowDoc({ paymentMethod: 'CARD' })));
  });

  test('TRANSFER sin referencia: rechazado', async () => {
    await seedReimbursement('e1', reimbursementDoc());
    await assertFails(
      asAdmin().collection('cashOutflows').doc('e1').set(outflowDoc({ paymentMethod: 'TRANSFER', reference: null }))
    );
  });

  test('TRANSFER con referencia: aceptado', async () => {
    await seedReimbursement('e1', reimbursementDoc());
    await assertSucceeds(
      asAdmin().collection('cashOutflows').doc('e1').set(outflowDoc({ paymentMethod: 'TRANSFER', reference: 'TRX-1' }))
    );
  });

  test('paidByUid debe ser quien firma la escritura', async () => {
    await seedReimbursement('e1', reimbursementDoc());
    await assertFails(asAdmin().collection('cashOutflows').doc('e1').set(outflowDoc({ paidByUid: 'otro-admin' })));
  });

  test('el dueño del reembolso NO puede crear su propio cashOutflow', async () => {
    await seedReimbursement('e1', reimbursementDoc());
    await assertFails(asOwner().collection('cashOutflows').doc('e1').set(outflowDoc({ paidByUid: 'u1' })));
  });

  test('otro usuario operativo no admin NO puede crear un cashOutflow', async () => {
    await seedReimbursement('e1', reimbursementDoc());
    await assertFails(asOther().collection('cashOutflows').doc('e1').set(outflowDoc({ paidByUid: 'u2' })));
  });

  test('admin puede leer cualquier cashOutflow', async () => {
    await seedReimbursement('e1', reimbursementDoc());
    await seedOutflow('e1', outflowDoc());
    await assertSucceeds(asAdmin().collection('cashOutflows').doc('e1').get());
  });

  test('el dueño del reembolso puede leer su propio cashOutflow', async () => {
    await seedReimbursement('e1', reimbursementDoc());
    await seedOutflow('e1', outflowDoc());
    await assertSucceeds(asOwner().collection('cashOutflows').doc('e1').get());
  });

  test('nadie puede actualizar un cashOutflow ya creado', async () => {
    await seedReimbursement('e1', reimbursementDoc());
    await seedOutflow('e1', outflowDoc());
    await assertFails(asAdmin().collection('cashOutflows').doc('e1').update({ amount: 999 }));
  });

  test('nadie puede eliminar un cashOutflow, ni siquiera admin', async () => {
    await seedReimbursement('e1', reimbursementDoc());
    await seedOutflow('e1', outflowDoc());
    await assertFails(asAdmin().collection('cashOutflows').doc('e1').delete());
  });
});
