/**
 * FASE S1.7.1 — regresión permanente de Storage `expenseReceipts` (S1.7-F2).
 * Requiere el Storage Emulator además de Firestore/Auth — ver
 * `npm run test:emulator:storage` (agregado en esta fase) o ejecutar
 * manualmente con `--only firestore,storage,auth`.
 */
const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');

const RULES_PATH = path.resolve(__dirname, '../../firebase/storage.rules');

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'chickeninventoryapp-emulator-test-storage-expense-receipts',
    storage: {
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

const asAdmin = (uid = 'admin-1') => testEnv.authenticatedContext(uid, { role: 'admin' }).storage();
const asVendedorA = () => testEnv.authenticatedContext('vendedorA', { role: 'vendedor' }).storage();
const asEntregadorA = () => testEnv.authenticatedContext('entregadorA', { role: 'entregador' }).storage();
const asBodegueroA = () => testEnv.authenticatedContext('bodegueroA', { role: 'bodeguero' }).storage();

const seedFile = async (path_) => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.storage().ref(path_).putString('fake-jpg-bytes');
  });
};

describe('S1.7.1 — Storage expenseReceipts.delete (ownership por uid en el path)', () => {
  test('admin elimina su propio archivo', async () => {
    const p = 'expenseReceipts/admin-1_1111.jpg';
    await seedFile(p);
    await assertSucceeds(asAdmin('admin-1').ref(p).delete());
  });

  test('admin elimina el archivo de otro usuario', async () => {
    const p = 'expenseReceipts/vendedorA_2222.jpg';
    await seedFile(p);
    await assertSucceeds(asAdmin('admin-1').ref(p).delete());
  });

  test('el dueño elimina su propio archivo', async () => {
    const p = 'expenseReceipts/vendedorA_3333.jpg';
    await seedFile(p);
    await assertSucceeds(asVendedorA().ref(p).delete());
  });

  test('el dueño NO puede eliminar el archivo de otro usuario (vendedorA borra el de vendedorB)', async () => {
    const p = 'expenseReceipts/vendedorB_4444.jpg';
    await seedFile(p);
    await assertFails(asVendedorA().ref(p).delete());
  });

  test('entregadorA NO puede eliminar el archivo de vendedorB', async () => {
    const p = 'expenseReceipts/vendedorB_5555.jpg';
    await seedFile(p);
    await assertFails(asEntregadorA().ref(p).delete());
  });

  test('bodegueroA NO puede eliminar el archivo de vendedorB', async () => {
    const p = 'expenseReceipts/vendedorB_6666.jpg';
    await seedFile(p);
    await assertFails(asBodegueroA().ref(p).delete());
  });

  test('usuario no autenticado NO puede eliminar ningún archivo', async () => {
    const p = 'expenseReceipts/vendedorA_7777.jpg';
    await seedFile(p);
    await assertFails(testEnv.unauthenticatedContext().storage().ref(p).delete());
  });

  test('lectura sigue abierta a cualquier operativo (sin cambios)', async () => {
    const p = 'expenseReceipts/vendedorA_8888.jpg';
    await seedFile(p);
    await assertSucceeds(asVendedorA().ref(p).getMetadata());
    await assertSucceeds(asEntregadorA().ref(p).getMetadata());
  });

  test('escritura (upload) sigue sin cambios: cualquier operativo puede subir', async () => {
    const p = 'expenseReceipts/entregadorA_9999.jpg';
    await assertSucceeds(
      asEntregadorA().ref(p).putString('fake-jpg-bytes', 'raw', { contentType: 'image/jpeg' })
    );
  });
});
