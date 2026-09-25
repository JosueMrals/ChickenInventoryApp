/**
 * Regresión de firestore.rules contra Firestore Emulator real (no simulado).
 *
 * Requiere el Emulator corriendo — usar `npm run test:emulator`, que levanta
 * Firestore+Auth Emulator vía Firebase CLI, corre esta suite, y los apaga.
 * NO corre como parte de `npm test` (ver jest.config.js).
 *
 * Modelo de autorización REAL de este proyecto (verificado leyendo
 * firebase/firestore.rules antes de escribir esto, no asumido):
 *   - 4 roles: admin, vendedor, entregador, bodeguero — vía custom claim
 *     `request.auth.token.role`, con fallback legacy a users/{uid}.role.
 *   - NO existe concepto de "branch" en el modelo de datos de esta app
 *     (products/sales/etc. son globales) — no hay nada que probar de
 *     "branch isolation" sin inventarlo, así que no se escribe ese test.
 *   - NO existe un campo status ('inactive'/'suspended') que la regla
 *     verifique en users/{uid} — la única gate es el rol. No se inventa.
 */
const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
// Compat-namespaced (igual que el resto de este archivo, `.collection().doc().set()`):
// FieldValue.serverTimestamp() se importa aparte, no vive en la instancia de firestore().
const firebaseCompat = require('firebase/compat/app');
require('firebase/compat/firestore');
const serverTimestamp = () => firebaseCompat.firestore.FieldValue.serverTimestamp();

const RULES_PATH = path.resolve(__dirname, '../../firebase/firestore.rules');

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'chickeninventoryapp-emulator-test',
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
const asVendedor = (uid = 'vendedor-1', email = 'vendedor-1@test.com') =>
  testEnv.authenticatedContext(uid, { role: 'vendedor', email }).firestore();
const asBodeguero = (uid = 'bodeguero-1') => testEnv.authenticatedContext(uid, { role: 'bodeguero' }).firestore();
const asEntregador = (uid = 'entregador-1') => testEnv.authenticatedContext(uid, { role: 'entregador' }).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

const seedProduct = async (id, data) => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('products').doc(id).set({ name: 'Pollo entero', stock: 10, ...data });
  });
};

describe('Security Rules — regresión (Firestore Emulator real)', () => {
  test('anonymous: sin auth, la regla global deniega lectura', async () => {
    await seedProduct('p1');
    await assertFails(asAnon().collection('products').doc('p1').get());
  });

  // FASE S1.4.1: sales.create ya no es solo `isAdmin()||isVendedor()` — exige
  // el shape real de registerQuickSaleFull (ver firestore.rules). El payload
  // mínimo de antes ({receiptNumber,total,createdAt}) probaba el rol, no el
  // shape; se completa aquí para seguir probando lo mismo bajo la Rule nueva.
  test('authorized user: vendedor puede crear una venta (isAdmin() || isVendedor())', async () => {
    await assertSucceeds(
      asVendedor().collection('sales').doc('s1').set({
        receiptNumber: '000001',
        subtotal: 100,
        total: 100,
        tip: 0,
        amountPaid: 100,
        change: 0,
        paymentMethod: 'cash',
        transferNumber: '',
        items: [{ id: 'p1', name: 'Pollo', quantity: 2, unitPrice: 50, discount: 0, total: 100, purchasePrice: 30 }],
        createdAt: serverTimestamp(),
        soldBy: 'vendedor-1@test.com',
        soldById: 'vendedor-1',
        customerId: null,
        customerName: 'Venta Rápida',
        customerPhone: '',
      })
    );
  });

  test('role escalation: entregador NO puede eliminar un producto (solo isAdmin())', async () => {
    await seedProduct('p1');
    await assertFails(asEntregador().collection('products').doc('p1').delete());
  });

  test('authorized user: admin sí puede eliminar un producto', async () => {
    await seedProduct('p1');
    await assertSucceeds(asAdmin().collection('products').doc('p1').delete());
  });

  test('role escalation: vendedor NO puede modificar creditLimit de un cliente (campo reservado a admin)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('customers').doc('c1').set({
        firstName: 'Juan', lastName: 'Pérez', creditLimit: 500, discount: 0,
      });
    });
    await assertFails(
      asVendedor().collection('customers').doc('c1').update({ creditLimit: 999999 })
    );
  });

  test('identity spoofing: goodsReceipts.create exige createdByUid == request.auth.uid', async () => {
    await seedProduct('p1');
    await assertFails(
      asBodeguero('bodeguero-1').collection('goodsReceipts').doc('r1').set({
        status: 'completed',
        createdByUid: 'otro-usuario-distinto', // spoofed
        totalUnits: 5,
      })
    );
  });

  test('identity spoofing: goodsReceipts.create con el uid real del actor sí se permite', async () => {
    await assertSucceeds(
      asBodeguero('bodeguero-1').collection('goodsReceipts').doc('r2').set({
        status: 'completed',
        createdByUid: 'bodeguero-1', // uid real del contexto autenticado
        totalUnits: 5,
      })
    );
  });

  test('inventoryMovements legítimo: vendedor puede crear un movimiento type "sale" (solo exige rol)', async () => {
    await assertSucceeds(
      asVendedor().collection('inventoryMovements').doc('m1').set({
        type: 'sale',
        productId: 'p1',
        quantity: 4,
        relatedSaleId: 's1',
        createdByUid: 'vendedor-1',
        createdAt: new Date(),
      })
    );
  });

  test('inventoryMovements: usuario no autorizado (entregador) NO puede crear el movimiento', async () => {
    await assertFails(
      asEntregador().collection('inventoryMovements').doc('m2').set({
        type: 'sale',
        productId: 'p1',
        quantity: 4,
        createdByUid: 'entregador-1',
        createdAt: new Date(),
      })
    );
  });

  // HALLAZGO (no un bug introducido por FASE 21/22 — se reporta, no se corrige
  // aquí por regla explícita de esta fase): la regla de inventoryMovements
  // solo exige rol para `create`, no valida `createdByUid == request.auth.uid`
  // como sí lo hace goodsReceipts. Este test documenta que la regla ACTUAL
  // permite el spoofing de identidad en este campo — no es el resultado
  // "correcto" deseable, es el resultado REAL medido contra la regla vigente.
  test('inventoryMovements: la regla actual NO bloquea createdByUid spoofed (hallazgo, no se corrige en esta fase)', async () => {
    await assertSucceeds(
      asVendedor('vendedor-1').collection('inventoryMovements').doc('m3').set({
        type: 'sale',
        productId: 'p1',
        quantity: 4,
        createdByUid: 'uid-que-no-es-el-del-token', // spoofed y la regla lo permite hoy
        createdAt: new Date(),
      })
    );
  });

  test('branch isolation: NO APLICA — este modelo de datos no tiene concepto de branch', () => {
    // Ningún match de firestore.rules referencia un campo branch/sucursal.
    // Escribir un test aquí requeriría inventar un campo que la regla no usa.
    expect(true).toBe(true);
  });

  test('usuario inactive/suspended: NO APLICA — no existe ese campo de status en el modelo de users', () => {
    // hasRole()/legacyHasRole() solo verifican `role`; no hay `status` en
    // users/{uid} que la regla lea. Inventarlo violaría "no inventar claims".
    expect(true).toBe(true);
  });
});
