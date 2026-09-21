/**
 * Regresión de las reglas de `reimbursements` contra Firestore Emulator real
 * (FASE E6.1). Solo admin crea/cancela; cada usuario lee lo suyo; un
 * reembolso PAID (o cualquier estado fuera de PENDING) queda inmutable
 * porque ninguna regla de update matchea un `resource.data.status` distinto
 * de 'PENDING'.
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
    projectId: 'chickeninventoryapp-emulator-test-reimbursements',
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
  expenseId: 'e1',
  createdByUid: 'u1',
  amount: 500,
  status: 'PENDING',
  createdAt: new Date(),
  paidAt: null,
  paidByUid: null,
  cancelledAt: null,
  cancelledByUid: null,
  paymentMethod: null,
  notes: null,
  ...overrides,
});

const seed = async (id, data) => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('reimbursements').doc(id).set(data);
  });
};

describe('reimbursements — Rules (FASE E6.1)', () => {
  test('admin puede crear el reimbursement (mismo actor que reviewExpense)', async () => {
    await assertSucceeds(
      asAdmin().collection('reimbursements').doc('e1').set(reimbursementDoc())
    );
  });

  test('el dueño del gasto NO puede crear su propio reimbursement', async () => {
    await assertFails(
      asOwner().collection('reimbursements').doc('e1').set(reimbursementDoc())
    );
  });

  test('otro usuario operativo no admin NO puede crear un reimbursement', async () => {
    await assertFails(
      asOther().collection('reimbursements').doc('e1').set(reimbursementDoc())
    );
  });

  test('create rechaza un status distinto de PENDING', async () => {
    await assertFails(
      asAdmin().collection('reimbursements').doc('e1').set(reimbursementDoc({ status: 'PAID' }))
    );
  });

  test('create rechaza expenseId que no coincide con el id del documento', async () => {
    await assertFails(
      asAdmin().collection('reimbursements').doc('e1').set(reimbursementDoc({ expenseId: 'otro' }))
    );
  });

  test('el dueño (createdByUid) puede leer su propio reimbursement', async () => {
    await seed('e1', reimbursementDoc());
    await assertSucceeds(asOwner().collection('reimbursements').doc('e1').get());
  });

  // FASE S1.2: la regla global (S1-01) que dejaba inefectiva la condición de
  // dueño/admin de aquí fue cerrada — ahora sí decide la regla específica.
  test('otro usuario NO puede leer el reimbursement ajeno (S1-01 corregido en FASE S1.2)', async () => {
    await seed('e1', reimbursementDoc());
    await assertFails(asOther().collection('reimbursements').doc('e1').get());
  });

  test('admin puede leer cualquier reimbursement', async () => {
    await seed('e1', reimbursementDoc());
    await assertSucceeds(asAdmin().collection('reimbursements').doc('e1').get());
  });

  test('admin puede cancelar un reimbursement PENDING (PENDING → CANCELLED)', async () => {
    await seed('e1', reimbursementDoc());
    await assertSucceeds(
      asAdmin().collection('reimbursements').doc('e1').update({
        status: 'CANCELLED', cancelledAt: new Date(), cancelledByUid: 'admin-1',
      })
    );
  });

  test('el dueño NO puede cancelar su propio reimbursement', async () => {
    await seed('e1', reimbursementDoc());
    await assertFails(
      asOwner().collection('reimbursements').doc('e1').update({
        status: 'CANCELLED', cancelledAt: new Date(), cancelledByUid: 'u1',
      })
    );
  });

  test('la cancelación no puede alterar el monto', async () => {
    await seed('e1', reimbursementDoc());
    await assertFails(
      asAdmin().collection('reimbursements').doc('e1').update({
        status: 'CANCELLED', cancelledAt: new Date(), cancelledByUid: 'admin-1', amount: 999,
      })
    );
  });

  test('nadie puede modificar un reimbursement ya PAID (ninguna regla de update matchea status != PENDING)', async () => {
    await seed('e1', reimbursementDoc({ status: 'PAID', paidAt: new Date(), paidByUid: 'admin-1' }));
    await assertFails(
      asAdmin().collection('reimbursements').doc('e1').update({ status: 'CANCELLED' })
    );
  });

  test('nadie puede modificar un reimbursement ya CANCELLED', async () => {
    await seed('e1', reimbursementDoc({ status: 'CANCELLED', cancelledAt: new Date(), cancelledByUid: 'admin-1' }));
    await assertFails(
      asAdmin().collection('reimbursements').doc('e1').update({ status: 'PAID' })
    );
  });

  test('nadie puede eliminar un reimbursement, ni siquiera admin', async () => {
    await seed('e1', reimbursementDoc());
    await assertFails(asAdmin().collection('reimbursements').doc('e1').delete());
  });
});

// FASE E6.2 — transición PENDING → PAID.
describe('reimbursements — pago (FASE E6.2)', () => {
  test('admin puede marcar PAID con CASH (sin referencia)', async () => {
    await seed('e1', reimbursementDoc());
    await assertSucceeds(
      asAdmin().collection('reimbursements').doc('e1').update({
        status: 'PAID', paidAt: new Date(), paidByUid: 'admin-1', paymentMethod: 'CASH', reference: null, notes: null,
      })
    );
  });

  test('admin puede marcar PAID con TRANSFER + referencia', async () => {
    await seed('e1', reimbursementDoc());
    await assertSucceeds(
      asAdmin().collection('reimbursements').doc('e1').update({
        status: 'PAID', paidAt: new Date(), paidByUid: 'admin-1', paymentMethod: 'TRANSFER', reference: 'TRX-001', notes: null,
      })
    );
  });

  test('TRANSFER sin referencia: rechazado', async () => {
    await seed('e1', reimbursementDoc());
    await assertFails(
      asAdmin().collection('reimbursements').doc('e1').update({
        status: 'PAID', paidAt: new Date(), paidByUid: 'admin-1', paymentMethod: 'TRANSFER', reference: null, notes: null,
      })
    );
  });

  test('paymentMethod CARD: rechazado (solo CASH/TRANSFER)', async () => {
    await seed('e1', reimbursementDoc());
    await assertFails(
      asAdmin().collection('reimbursements').doc('e1').update({
        status: 'PAID', paidAt: new Date(), paidByUid: 'admin-1', paymentMethod: 'CARD', reference: null, notes: null,
      })
    );
  });

  test('el dueño NO puede marcar su propio reimbursement como pagado', async () => {
    await seed('e1', reimbursementDoc());
    await assertFails(
      asOwner().collection('reimbursements').doc('e1').update({
        status: 'PAID', paidAt: new Date(), paidByUid: 'u1', paymentMethod: 'CASH', reference: null, notes: null,
      })
    );
  });

  test('paidByUid debe ser quien firma la escritura (no se puede pagar "a nombre de" otro admin)', async () => {
    await seed('e1', reimbursementDoc());
    await assertFails(
      asAdmin().collection('reimbursements').doc('e1').update({
        status: 'PAID', paidAt: new Date(), paidByUid: 'otro-admin', paymentMethod: 'CASH', reference: null, notes: null,
      })
    );
  });

  test('el pago no puede alterar el monto', async () => {
    await seed('e1', reimbursementDoc());
    await assertFails(
      asAdmin().collection('reimbursements').doc('e1').update({
        status: 'PAID', paidAt: new Date(), paidByUid: 'admin-1', paymentMethod: 'CASH', reference: null, notes: null, amount: 999,
      })
    );
  });

  test('el pago no puede tocar expenseId ni createdByUid', async () => {
    await seed('e1', reimbursementDoc());
    await assertFails(
      asAdmin().collection('reimbursements').doc('e1').update({
        status: 'PAID', paidAt: new Date(), paidByUid: 'admin-1', paymentMethod: 'CASH', reference: null, notes: null, createdByUid: 'otro',
      })
    );
  });

  // FASE E6.3.1 — protección contra auto-pago: si el propio admin registró
  // el gasto (createdByUid == su uid), no puede pagarse a sí mismo.
  test('un admin NO puede pagar un reembolso cuyo createdByUid sea su propio uid', async () => {
    await seed('e1', reimbursementDoc({ createdByUid: 'admin-1' }));
    await assertFails(
      asAdmin().collection('reimbursements').doc('e1').update({
        status: 'PAID', paidAt: new Date(), paidByUid: 'admin-1', paymentMethod: 'CASH', reference: null, notes: null,
      })
    );
  });

  test('un admin SÍ puede pagar el reembolso de otro usuario', async () => {
    await seed('e1', reimbursementDoc({ createdByUid: 'u1' }));
    await assertSucceeds(
      asAdmin().collection('reimbursements').doc('e1').update({
        status: 'PAID', paidAt: new Date(), paidByUid: 'admin-1', paymentMethod: 'CASH', reference: null, notes: null,
      })
    );
  });
});
