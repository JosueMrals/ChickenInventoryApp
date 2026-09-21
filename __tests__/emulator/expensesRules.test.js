/**
 * Regresión de las reglas de `expenses` (FASE E1) contra Firestore Emulator
 * real. Requiere el Emulator corriendo — usar `npm run test:emulator`.
 * NO corre como parte de `npm test` (ver jest.config.js).
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
    // projectId propio: evita cross-contamination con los otros archivos de
    // __tests__/emulator/ si Jest los corre en paralelo (lección de FASE 22).
    projectId: 'chickeninventoryapp-emulator-test-expenses',
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

const asVendedor = (uid = 'vendedor-1') => testEnv.authenticatedContext(uid, { role: 'vendedor' }).firestore();
const asEntregador = (uid = 'entregador-1') => testEnv.authenticatedContext(uid, { role: 'entregador' }).firestore();
const asAdmin = () => testEnv.authenticatedContext('admin-1', { role: 'admin' }).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

const validExpense = (overrides = {}) => ({
  amount: 500,
  category: 'FUEL',
  description: null,
  paymentMethod: 'CASH',
  status: 'PENDING',
  createdByUid: 'vendedor-1',
  createdAt: new Date(),
  receipt: { url: 'https://mock/r.jpg', path: 'expenseReceipts/vendedor-1_1.jpg' },
  cashClosingId: null,
  routeId: null,
  reviewedByUid: null,
  reviewedAt: null,
  reimbursement: null,
  ...overrides,
});

const seedExpense = async (id, data) => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('expenses').doc(id).set(data);
  });
};

describe('expenses — Security Rules (Firestore Emulator real)', () => {
  test('create: un vendedor puede crear su propio gasto CASH', async () => {
    await assertSucceeds(
      asVendedor().collection('expenses').doc('e1').set(validExpense())
    );
  });

  test('create: PERSONAL exige reimbursement coherente con amount', async () => {
    await assertSucceeds(
      asVendedor().collection('expenses').doc('e2').set(validExpense({
        paymentMethod: 'PERSONAL',
        reimbursement: { status: 'PENDING', amount: 500, paidAt: null },
      }))
    );
  });

  test('create: rechaza PERSONAL sin reimbursement', async () => {
    await assertFails(
      asVendedor().collection('expenses').doc('e3').set(validExpense({ paymentMethod: 'PERSONAL' }))
    );
  });

  test('create: rechaza CASH con reimbursement (debe ser null)', async () => {
    await assertFails(
      asVendedor().collection('expenses').doc('e4').set(validExpense({
        reimbursement: { status: 'PENDING', amount: 500, paidAt: null },
      }))
    );
  });

  test('create: identity spoofing — createdByUid distinto al del token', async () => {
    await assertFails(
      asVendedor('vendedor-1').collection('expenses').doc('e5').set(
        validExpense({ createdByUid: 'otro-usuario' })
      )
    );
  });

  test('create: no se puede crear ya vinculado a un cierre', async () => {
    await assertFails(
      asVendedor().collection('expenses').doc('e6').set(validExpense({ cashClosingId: 'c1' }))
    );
  });

  test('create: sin comprobante (receipt) se rechaza', async () => {
    const bad = validExpense();
    delete bad.receipt;
    await assertFails(asVendedor().collection('expenses').doc('e7').set(bad));
  });

  test('create: categoría fuera del catálogo cerrado se rechaza', async () => {
    await assertFails(
      asVendedor().collection('expenses').doc('e8').set(validExpense({ category: 'CRYPTO' }))
    );
  });

  test('create: no hay aprobación previa obligatoria — nace PENDING y ya es válido', async () => {
    await assertSucceeds(
      asVendedor().collection('expenses').doc('e9').set(validExpense({ status: 'PENDING' }))
    );
  });

  test('read: el creador puede leer su propio gasto', async () => {
    await seedExpense('e10', validExpense());
    await assertSucceeds(asVendedor('vendedor-1').collection('expenses').doc('e10').get());
  });

  // FASE S1.2: la regla global (`match /{document=**} { allow read: if
  // request.auth != null; }`, S1-01) que OReaba con esta condición y la
  // volvía inefectiva fue cerrada — ahora la condición de ownership de
  // `expenses.read` es la que realmente decide. Este test documentaba el gap
  // heredado; ahora confirma que quedó corregido.
  test('read: un usuario operativo NO puede leer el gasto de otro (S1-01 corregido en FASE S1.2)', async () => {
    await seedExpense('e11', validExpense({ createdByUid: 'vendedor-1' }));
    await assertFails(asEntregador('entregador-1').collection('expenses').doc('e11').get());
  });

  test('read: admin puede leer cualquier gasto', async () => {
    await seedExpense('e12', validExpense({ createdByUid: 'vendedor-1' }));
    await assertSucceeds(asAdmin().collection('expenses').doc('e12').get());
  });

  test('read: anonymous no puede leer nada', async () => {
    await seedExpense('e13', validExpense());
    await assertFails(asAnon().collection('expenses').doc('e13').get());
  });

  test('update: el creador cancela su PENDING sin cierre asignado', async () => {
    await seedExpense('e14', validExpense());
    await assertSucceeds(
      asVendedor('vendedor-1').collection('expenses').doc('e14').update({ status: 'CANCELLED' })
    );
  });

  test('update: otro usuario no puede cancelar un gasto ajeno', async () => {
    await seedExpense('e15', validExpense({ createdByUid: 'vendedor-1' }));
    await assertFails(
      asEntregador('entregador-1').collection('expenses').doc('e15').update({ status: 'CANCELLED' })
    );
  });

  test('update: no se puede cancelar un gasto ya APPROVED', async () => {
    await seedExpense('e16', validExpense({ status: 'APPROVED' }));
    await assertFails(
      asVendedor('vendedor-1').collection('expenses').doc('e16').update({ status: 'CANCELLED' })
    );
  });

  test('update: no se puede cancelar un gasto ya vinculado a un cierre', async () => {
    await seedExpense('e17', validExpense({ cashClosingId: 'c1' }));
    await assertFails(
      asVendedor('vendedor-1').collection('expenses').doc('e17').update({ status: 'CANCELLED' })
    );
  });

  test('update: el creador NO puede editar amount de su propio gasto PENDING', async () => {
    await seedExpense('e18', validExpense());
    await assertFails(
      asVendedor('vendedor-1').collection('expenses').doc('e18').update({ amount: 999 })
    );
  });

  test('update: admin aprueba un PENDING', async () => {
    await seedExpense('e19', validExpense());
    await assertSucceeds(
      asAdmin().collection('expenses').doc('e19').update({
        status: 'APPROVED', reviewedByUid: 'admin-1', reviewedAt: new Date(),
      })
    );
  });

  test('update: admin rechaza un PENDING', async () => {
    await seedExpense('e20', validExpense());
    await assertSucceeds(
      asAdmin().collection('expenses').doc('e20').update({
        status: 'REJECTED', reviewedByUid: 'admin-1', reviewedAt: new Date(),
      })
    );
  });

  test('update: un vendedor (no admin) no puede aprobar', async () => {
    await seedExpense('e21', validExpense());
    await assertFails(
      asVendedor('vendedor-2').collection('expenses').doc('e21').update({
        status: 'APPROVED', reviewedByUid: 'vendedor-2', reviewedAt: new Date(),
      })
    );
  });

  // FASE E6.3.1: APPROVED ya no es terminal para REJECTED (decisión del
  // propietario) — pero sigue siendo terminal para volver a APPROVED.
  test('update: admin SÍ puede rechazar un gasto ya APPROVED (FASE E6.3.1)', async () => {
    await seedExpense('e22', validExpense({ status: 'APPROVED' }));
    await assertSucceeds(
      asAdmin().collection('expenses').doc('e22').update({
        status: 'REJECTED', reviewedByUid: 'admin-1', reviewedAt: new Date(),
      })
    );
  });

  test('update: admin no puede reaprobar un gasto ya APPROVED', async () => {
    await seedExpense('e22b', validExpense({ status: 'APPROVED' }));
    await assertFails(
      asAdmin().collection('expenses').doc('e22b').update({
        status: 'APPROVED', reviewedByUid: 'admin-1', reviewedAt: new Date(),
      })
    );
  });

  test('update: admin no puede reabrir un gasto ya REJECTED', async () => {
    await seedExpense('e22c', validExpense({ status: 'REJECTED' }));
    await assertFails(
      asAdmin().collection('expenses').doc('e22c').update({
        status: 'APPROVED', reviewedByUid: 'admin-1', reviewedAt: new Date(),
      })
    );
    await assertFails(
      asAdmin().collection('expenses').doc('e22c').update({
        status: 'REJECTED', reviewedByUid: 'admin-1', reviewedAt: new Date(),
      })
    );
  });

  test('update: admin no puede aprobar/rechazar un gasto CANCELLED', async () => {
    await seedExpense('e22d', validExpense({ status: 'CANCELLED' }));
    await assertFails(
      asAdmin().collection('expenses').doc('e22d').update({
        status: 'APPROVED', reviewedByUid: 'admin-1', reviewedAt: new Date(),
      })
    );
    await assertFails(
      asAdmin().collection('expenses').doc('e22d').update({
        status: 'REJECTED', reviewedByUid: 'admin-1', reviewedAt: new Date(),
      })
    );
  });

  test('update: admin no puede pasar un gasto APPROVED a CANCELLED', async () => {
    await seedExpense('e22e', validExpense({ status: 'APPROVED' }));
    await assertFails(
      asAdmin().collection('expenses').doc('e22e').update({
        status: 'CANCELLED', reviewedByUid: 'admin-1', reviewedAt: new Date(),
      })
    );
  });

  // NOTA (FASE E3): antes de E3, NINGUNA regla permitía tocar cashClosingId —
  // este test lo comprobaba tanto para el dueño como para el admin. Desde E3,
  // el DUEÑO sí puede fijarlo una vez (es exactamente la transición que
  // closeTurno() ejecuta — ver describe('cashClosingId (FASE E3)') más abajo).
  // Lo que sigue sin permitirse es que el ADMIN lo haga arbitrariamente sin
  // ser el dueño del gasto.
  test('update: admin no puede alterar cashClosingId de un gasto ajeno arbitrariamente', async () => {
    await seedExpense('e23', validExpense());
    await assertFails(
      asAdmin().collection('expenses').doc('e23').update({ cashClosingId: 'c-fake' })
    );
  });

  test('update: alterar createdByUid se rechaza', async () => {
    await seedExpense('e24', validExpense());
    await assertFails(
      asAdmin().collection('expenses').doc('e24').update({ createdByUid: 'otro' })
    );
  });

  test('delete: nadie puede eliminar un gasto, ni el creador ni el admin', async () => {
    await seedExpense('e25', validExpense());
    await assertFails(asVendedor('vendedor-1').collection('expenses').doc('e25').delete());
    await assertFails(asAdmin().collection('expenses').doc('e25').delete());
  });

  // FASE E3 — transición cashClosingId (null → id del cierre).
  describe('cashClosingId (FASE E3)', () => {
    test('el dueño puede vincular su gasto CASH sin liquidar a un cierre', async () => {
      await seedExpense('e30', validExpense());
      await assertSucceeds(
        asVendedor('vendedor-1').collection('expenses').doc('e30').update({ cashClosingId: 'closing-1' })
      );
    });

    test('otro usuario no puede vincular un gasto ajeno', async () => {
      await seedExpense('e31', validExpense({ createdByUid: 'vendedor-1' }));
      await assertFails(
        asEntregador('entregador-1').collection('expenses').doc('e31').update({ cashClosingId: 'closing-1' })
      );
    });

    test('admin tampoco puede vincular el gasto de otro (esta rama exige ser el dueño)', async () => {
      await seedExpense('e32', validExpense({ createdByUid: 'vendedor-1' }));
      await assertFails(
        asAdmin().collection('expenses').doc('e32').update({ cashClosingId: 'closing-1' })
      );
    });

    test('un gasto ya vinculado no puede moverse a otro cierre', async () => {
      await seedExpense('e33', validExpense({ cashClosingId: 'closing-1' }));
      await assertFails(
        asVendedor('vendedor-1').collection('expenses').doc('e33').update({ cashClosingId: 'closing-2' })
      );
    });

    test('un gasto ya vinculado no puede desvincularse (string → null)', async () => {
      await seedExpense('e34', validExpense({ cashClosingId: 'closing-1' }));
      await assertFails(
        asVendedor('vendedor-1').collection('expenses').doc('e34').update({ cashClosingId: null })
      );
    });

    test('no se puede cambiar amount aprovechando esta transición', async () => {
      await seedExpense('e35', validExpense());
      await assertFails(
        asVendedor('vendedor-1').collection('expenses').doc('e35').update({ cashClosingId: 'closing-1', amount: 999 })
      );
    });

    test('no se puede cambiar paymentMethod aprovechando esta transición', async () => {
      await seedExpense('e36', validExpense());
      await assertFails(
        asVendedor('vendedor-1').collection('expenses').doc('e36').update({ cashClosingId: 'closing-1', paymentMethod: 'PERSONAL' })
      );
    });

    test('no se puede cambiar status aprovechando esta transición', async () => {
      await seedExpense('e37', validExpense());
      await assertFails(
        asVendedor('vendedor-1').collection('expenses').doc('e37').update({ cashClosingId: 'closing-1', status: 'APPROVED' })
      );
    });

    test('un gasto PERSONAL nunca puede recibir cashClosingId (paymentMethod!=CASH bloquea la rama)', async () => {
      await seedExpense('e38', validExpense({ paymentMethod: 'PERSONAL', reimbursement: { status: 'PENDING', amount: 500, paidAt: null } }));
      await assertFails(
        asVendedor('vendedor-1').collection('expenses').doc('e38').update({ cashClosingId: 'closing-1' })
      );
    });
  });
});
