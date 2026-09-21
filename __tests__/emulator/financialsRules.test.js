/**
 * Regresión de las reglas de `financials` contra Firestore Emulator real —
 * confirma que el nuevo shape del espejo de Expenses (FASE E4: category,
 * paymentMethod, expenseId) es aceptado SIN cambiar la regla existente
 * (no tiene `hasOnly`, solo exige rol), y que el resto del comportamiento
 * (quién puede leer/crear, inmutabilidad) sigue intacto.
 * Requiere el Emulator corriendo — usar `npm run test:emulator`.
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
    projectId: 'chickeninventoryapp-emulator-test-financials',
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
const asVendedor = () => testEnv.authenticatedContext('vendedor-1', { role: 'vendedor' }).firestore();
const asBodeguero = () => testEnv.authenticatedContext('bodeguero-1', { role: 'bodeguero' }).firestore();
const asEntregador = () => testEnv.authenticatedContext('entregador-1', { role: 'entregador' }).firestore();

const mirrorDoc = (overrides = {}) => ({
  type: 'expense',
  amount: 500,
  description: 'Combustible',
  concept: 'Combustible',
  category: 'FUEL',
  paymentMethod: 'CASH',
  expenseId: 'e1',
  createdByUid: 'u1',
  createdAt: new Date(),
  ...overrides,
});

const seedFinancial = async (id, data) => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('financials').doc(id).set(data);
  });
};

describe('financials — regresión de Rules con el nuevo shape del mirror (FASE E4)', () => {
  test('admin (actor real de reviewExpense) puede crear el mirror con los campos nuevos', async () => {
    await assertSucceeds(
      asAdmin().collection('financials').doc('expense-e1').set(mirrorDoc())
    );
  });

  test('vendedor también puede crear financials directamente (regla ya existente, sin cambios)', async () => {
    await assertSucceeds(
      asVendedor().collection('financials').doc('expense-e2').set(mirrorDoc({ expenseId: 'e2' }))
    );
  });

  test('bodeguero NO puede crear financials (regla ya existente, sin ampliar permisos)', async () => {
    await assertFails(
      asBodeguero().collection('financials').doc('expense-e3').set(mirrorDoc({ expenseId: 'e3' }))
    );
  });

  test('entregador NO puede crear financials (regla ya existente, sin ampliar permisos)', async () => {
    await assertFails(
      asEntregador().collection('financials').doc('expense-e4').set(mirrorDoc({ expenseId: 'e4' }))
    );
  });

  test('un financial ya creado es inmutable: nadie puede actualizarlo', async () => {
    await seedFinancial('expense-e5', mirrorDoc({ expenseId: 'e5' }));
    await assertFails(asAdmin().collection('financials').doc('expense-e5').update({ amount: 999 }));
  });

  // FASE E5.1 — createdByUid es un campo aditivo del mirror; la regla ya lo
  // acepta sin cambios (no tiene hasOnly), y sigue siendo inmutable como el
  // resto del documento.
  test('admin puede crear el mirror con createdByUid (FASE E5.1, sin cambio de Rules)', async () => {
    await assertSucceeds(
      asAdmin().collection('financials').doc('expense-e8').set(mirrorDoc({ expenseId: 'e8', createdByUid: 'u1' }))
    );
  });

  test('createdByUid no puede modificarse después de creado', async () => {
    await seedFinancial('expense-e9', mirrorDoc({ expenseId: 'e9', createdByUid: 'u1' }));
    await assertFails(asAdmin().collection('financials').doc('expense-e9').update({ createdByUid: 'u2' }));
  });

  test('un financial ya creado no puede eliminarse, ni siquiera por admin', async () => {
    await seedFinancial('expense-e6', mirrorDoc({ expenseId: 'e6' }));
    await assertFails(asAdmin().collection('financials').doc('expense-e6').delete());
  });

  // FASE S1.2: la regla global (S1-01) fue cerrada, y `financials.read` se
  // acotó a admin exclusivamente (el único lector real es reportsService,
  // usado solo por el módulo Reports, admin-only — ver reporte de la fase).
  // Antes bodeguero/entregador/vendedor podían leer financials por la regla
  // global; ahora ninguno de los tres puede, ni por la global (cerrada) ni
  // por la específica (ya no incluye isVendedor()).
  test('solo admin puede leer financials (S1-01 corregido, financials.read acotado a admin en FASE S1.2)', async () => {
    await seedFinancial('expense-e7', mirrorDoc({ expenseId: 'e7' }));
    await assertSucceeds(asAdmin().collection('financials').doc('expense-e7').get());
    await assertFails(asVendedor().collection('financials').doc('expense-e7').get());
    await assertFails(asBodeguero().collection('financials').doc('expense-e7').get());
    await assertFails(asEntregador().collection('financials').doc('expense-e7').get());
  });
});
