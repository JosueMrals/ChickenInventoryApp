/**
 * FASE S1.4.1 — regresión permanente de `sales.create` (S1.4-F0/F1/F4).
 *
 * Dos shapes reales: venta directa (registerQuickSaleFull) y conversión de
 * Pre-sale (convertPreSaleToSale) — ver
 * `audit-reports/fase-s1-4-0-sales-create-audit.md` y
 * `fase-s1-4-1-sales-create-rules-implementation.md`.
 */
const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
// El cliente que devuelve rules-unit-testing es compat-namespaced (`.collection().doc().set()`,
// no modular): FieldValue.serverTimestamp() se importa aparte, no vive en la instancia.
const firebaseCompat = require('firebase/compat/app');
require('firebase/compat/firestore');
const serverTimestamp = () => firebaseCompat.firestore.FieldValue.serverTimestamp();

const RULES_PATH = path.resolve(__dirname, '../../firebase/firestore.rules');

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'chickeninventoryapp-emulator-test-sales-rules',
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

const asVendedor = (uid = 'vendedor-x', email = 'vendedor-x@test.com') =>
  testEnv.authenticatedContext(uid, { role: 'vendedor', email }).firestore();
const asAdmin = (uid = 'admin-1', email = 'admin-1@test.com') =>
  testEnv.authenticatedContext(uid, { role: 'admin', email }).firestore();
const asBodeguero = (uid = 'bodeguero-x', email = 'bodeguero-x@test.com') =>
  testEnv.authenticatedContext(uid, { role: 'bodeguero', email }).firestore();
const asEntregador = (uid = 'entregador-x', email = 'entregador-x@test.com') =>
  testEnv.authenticatedContext(uid, { role: 'entregador', email }).firestore();

const seedPreSale = async (id, data) => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('presales').doc(id).set(data);
  });
};

const seedSale = async (id, data) => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('sales').doc(id).set(data);
  });
};

const basePreSale = (overrides = {}) => ({
  preSaleNumber: 42,
  customer: { firstName: 'Juan', lastName: 'Pérez' },
  customerId: 'cust-1',
  customerName: 'Juan Pérez',
  subtotal: 100,
  totalDiscount: 0,
  categoryDiscountTotal: 0,
  total: 100,
  status: 'pending',
  paymentMethod: 'cash',
  createdAt: new Date(),
  createdBy: 'creador@test.com',
  items: [{ productId: 'p1', quantity: 2, unitPrice: 50, total: 100 }],
  bonuses: [],
  route: null,
  routeId: null,
  ...overrides,
});

// ── Venta directa (registerQuickSaleFull) ───────────────────────────────────
describe('S1.4.1 — venta directa (shape 1)', () => {
  const directSalePayload = (uid = 'vendedor-x', email = 'vendedor-x@test.com', overrides = {}) => ({
    receiptNumber: '000123',
    subtotal: 100,
    total: 100,
    tip: 0,
    amountPaid: 100,
    change: 0,
    paymentMethod: 'cash',
    transferNumber: '',
    items: [{ id: 'p1', name: 'Pollo', quantity: 2, unitPrice: 50, discount: 0, total: 100, purchasePrice: 30 }],
    createdAt: serverTimestamp(),
    soldBy: email,
    soldById: uid,
    customerId: null,
    customerName: 'Venta Rápida',
    customerPhone: '',
    ...overrides,
  });

  test('vendedor crea una venta directa con payload real → ALLOWED', async () => {
    await assertSucceeds(
      asVendedor('vendedor-x', 'vendedor-x@test.com').collection('sales').doc('s1').set(
        directSalePayload('vendedor-x', 'vendedor-x@test.com')
      )
    );
  });

  test('admin crea una venta directa con payload real → ALLOWED', async () => {
    await assertSucceeds(
      asAdmin('admin-1', 'admin-1@test.com').collection('sales').doc('s2').set(
        directSalePayload('admin-1', 'admin-1@test.com')
      )
    );
  });

  test('bodeguero NO puede crear una venta directa → DENIED', async () => {
    await assertFails(
      asBodeguero('bodeguero-x', 'bodeguero-x@test.com').collection('sales').doc('s3').set(
        directSalePayload('bodeguero-x', 'bodeguero-x@test.com')
      )
    );
  });

  test('entregador NO puede crear una venta directa → DENIED', async () => {
    await assertFails(
      asEntregador('entregador-x', 'entregador-x@test.com').collection('sales').doc('s4').set(
        directSalePayload('entregador-x', 'entregador-x@test.com')
      )
    );
  });

  test('venta directa con campo arbitrario fuera del shape → DENIED', async () => {
    await assertFails(
      asVendedor('vendedor-x', 'vendedor-x@test.com').collection('sales').doc('s5').set({
        ...directSalePayload('vendedor-x', 'vendedor-x@test.com'),
        discountCode: 'PROMO50',
      })
    );
  });

  test('venta directa con createdBy falso (campo que ni siquiera existe en este shape) → DENIED', async () => {
    await assertFails(
      asVendedor('vendedor-x', 'vendedor-x@test.com').collection('sales').doc('s6').set({
        ...directSalePayload('vendedor-x', 'vendedor-x@test.com'),
        createdBy: 'otro@test.com',
      })
    );
  });

  test('venta directa con soldBy falso (email de otro usuario) → DENIED', async () => {
    await assertFails(
      asVendedor('vendedor-x', 'vendedor-x@test.com').collection('sales').doc('s7').set(
        directSalePayload('vendedor-x', 'suplantado@test.com')
      )
    );
  });

  test('venta directa con soldById falso (uid de otro usuario) → DENIED', async () => {
    await assertFails(
      asVendedor('vendedor-x', 'vendedor-x@test.com').collection('sales').doc('s8').set({
        ...directSalePayload('vendedor-x', 'vendedor-x@test.com'),
        soldById: 'otro-uid',
      })
    );
  });

  test('venta directa con createdAt fabricado (no request.time) → DENIED', async () => {
    await assertFails(
      asVendedor('vendedor-x', 'vendedor-x@test.com').collection('sales').doc('s9').set({
        ...directSalePayload('vendedor-x', 'vendedor-x@test.com'),
        createdAt: new Date('2020-01-01'),
      })
    );
  });

  test('venta directa con carrito vacío → DENIED', async () => {
    await assertFails(
      asVendedor('vendedor-x', 'vendedor-x@test.com').collection('sales').doc('s10').set({
        ...directSalePayload('vendedor-x', 'vendedor-x@test.com'),
        items: [],
      })
    );
  });

  test('venta directa con total negativo → DENIED', async () => {
    await assertFails(
      asVendedor('vendedor-x', 'vendedor-x@test.com').collection('sales').doc('s11').set({
        ...directSalePayload('vendedor-x', 'vendedor-x@test.com'),
        total: -50,
      })
    );
  });
});

// ── Pre-sale → Sale (convertPreSaleToSale) ──────────────────────────────────
describe('S1.4.1 — conversión de Pre-sale (shape 2)', () => {
  const conversionPayload = (preSale, overrides = {}) => ({
    preSaleId: 'ps-real',
    preSaleNumber: preSale.preSaleNumber,
    saleNumber: '000456',
    customer: preSale.customer,
    customerId: preSale.customerId,
    customerName: preSale.customerName,
    items: preSale.items,
    bonuses: preSale.bonuses,
    subtotal: preSale.subtotal,
    totalDiscount: preSale.totalDiscount,
    categoryDiscountTotal: preSale.categoryDiscountTotal,
    total: preSale.total,
    paymentMethod: 'cash',
    amountPaid: 100,
    change: 0,
    route: preSale.route,
    routeId: preSale.routeId,
    createdAt: serverTimestamp(),
    createdBy: 'vendedor-x@test.com',
    originalCreatedBy: preSale.createdBy,
    inventoryDeducted: true,
    ...overrides,
  });

  test('presale real (pending) + payload consistente → ALLOWED', async () => {
    const preSale = basePreSale();
    await seedPreSale('ps-real', preSale);
    await assertSucceeds(
      asVendedor('vendedor-x', 'vendedor-x@test.com').collection('sales').doc('sale-a').set(
        conversionPayload(preSale)
      )
    );
  });

  test('presale real (dispatched) + payload consistente → ALLOWED', async () => {
    const preSale = basePreSale({ status: 'dispatched', entregadorId: 'e1' });
    await seedPreSale('ps-real', preSale);
    await assertSucceeds(
      asAdmin('admin-1', 'admin-1@test.com').collection('sales').doc('sale-b').set({
        ...conversionPayload(preSale), createdBy: 'admin-1@test.com',
      })
    );
  });

  test('presale real + total manipulado → DENIED', async () => {
    const preSale = basePreSale();
    await seedPreSale('ps-real', preSale);
    await assertFails(
      asVendedor('vendedor-x', 'vendedor-x@test.com').collection('sales').doc('sale-c').set(
        conversionPayload(preSale, { total: 1 })
      )
    );
  });

  test('presale real + subtotal manipulado → DENIED', async () => {
    const preSale = basePreSale();
    await seedPreSale('ps-real', preSale);
    await assertFails(
      asVendedor('vendedor-x', 'vendedor-x@test.com').collection('sales').doc('sale-d').set(
        conversionPayload(preSale, { subtotal: 1 })
      )
    );
  });

  test('presale real + items manipulados → DENIED', async () => {
    const preSale = basePreSale();
    await seedPreSale('ps-real', preSale);
    await assertFails(
      asVendedor('vendedor-x', 'vendedor-x@test.com').collection('sales').doc('sale-e').set(
        conversionPayload(preSale, { items: [{ productId: 'p2', quantity: 99, unitPrice: 1, total: 99 }] })
      )
    );
  });

  test('presale real + customerId manipulado → DENIED', async () => {
    const preSale = basePreSale();
    await seedPreSale('ps-real', preSale);
    await assertFails(
      asVendedor('vendedor-x', 'vendedor-x@test.com').collection('sales').doc('sale-f').set(
        conversionPayload(preSale, { customerId: 'cust-robado' })
      )
    );
  });

  test('presale real + route manipulada → DENIED', async () => {
    const preSale = basePreSale();
    await seedPreSale('ps-real', preSale);
    await assertFails(
      asVendedor('vendedor-x', 'vendedor-x@test.com').collection('sales').doc('sale-g').set(
        conversionPayload(preSale, { routeId: 'ruta-inventada' })
      )
    );
  });

  test('presale inexistente → DENIED', async () => {
    const preSale = basePreSale();
    await assertFails(
      asVendedor('vendedor-x', 'vendedor-x@test.com').collection('sales').doc('sale-h').set(
        conversionPayload(preSale)
      )
    );
  });

  test('presale ya paid → DENIED', async () => {
    const preSale = basePreSale({ status: 'paid' });
    await seedPreSale('ps-real', preSale);
    await assertFails(
      asVendedor('vendedor-x', 'vendedor-x@test.com').collection('sales').doc('sale-i').set(
        conversionPayload(preSale)
      )
    );
  });

  test('presale cancelled → DENIED', async () => {
    const preSale = basePreSale({ status: 'cancelled' });
    await seedPreSale('ps-real', preSale);
    await assertFails(
      asVendedor('vendedor-x', 'vendedor-x@test.com').collection('sales').doc('sale-j').set(
        conversionPayload(preSale)
      )
    );
  });

  test('presale en preparing (aún no despachable/cobrable) → DENIED', async () => {
    const preSale = basePreSale({ status: 'preparing' });
    await seedPreSale('ps-real', preSale);
    await assertFails(
      asVendedor('vendedor-x', 'vendedor-x@test.com').collection('sales').doc('sale-k').set(
        conversionPayload(preSale)
      )
    );
  });

  test('createdBy falso (no coincide con el actor autenticado) → DENIED', async () => {
    const preSale = basePreSale();
    await seedPreSale('ps-real', preSale);
    await assertFails(
      asVendedor('vendedor-x', 'vendedor-x@test.com').collection('sales').doc('sale-l').set(
        conversionPayload(preSale, { createdBy: 'suplantado@test.com' })
      )
    );
  });

  test('inventoryDeducted:false → DENIED (el writer real siempre lo fija en true)', async () => {
    const preSale = basePreSale();
    await seedPreSale('ps-real', preSale);
    await assertFails(
      asVendedor('vendedor-x', 'vendedor-x@test.com').collection('sales').doc('sale-m').set(
        conversionPayload(preSale, { inventoryDeducted: false })
      )
    );
  });

  test('bodeguero/entregador NO pueden convertir una presale, aunque el payload sea consistente', async () => {
    const preSale = basePreSale();
    await seedPreSale('ps-real', preSale);
    await assertFails(
      asBodeguero('bodeguero-x', 'bodeguero-x@test.com').collection('sales').doc('sale-n').set({
        ...conversionPayload(preSale), createdBy: 'bodeguero-x@test.com',
      })
    );
    await seedPreSale('ps-real', preSale);
    await assertFails(
      asEntregador('entregador-x', 'entregador-x@test.com').collection('sales').doc('sale-o').set({
        ...conversionPayload(preSale), createdBy: 'entregador-x@test.com',
      })
    );
  });

  // ── Cross-document attack (S1.4-F0) ───────────────────────────────────────
  test('CROSS-DOCUMENT: preSaleId=A (real, pending) pero total/items/customer/route de B → DENIED', async () => {
    const preSaleA = basePreSale({ preSaleNumber: 1, total: 100, subtotal: 100 });
    const preSaleB = basePreSale({
      preSaleNumber: 2, total: 999, subtotal: 999,
      customerId: 'cust-B', customerName: 'Cliente B',
      items: [{ productId: 'pB', quantity: 50, unitPrice: 20, total: 1000 }],
      routeId: 'ruta-B',
    });
    await seedPreSale('ps-A', preSaleA);
    await seedPreSale('ps-B', preSaleB);

    await assertFails(
      asVendedor('vendedor-x', 'vendedor-x@test.com').collection('sales').doc('sale-cross').set({
        preSaleId: 'ps-A',
        preSaleNumber: preSaleB.preSaleNumber,
        saleNumber: '000789',
        customer: preSaleB.customer,
        customerId: preSaleB.customerId,
        customerName: preSaleB.customerName,
        items: preSaleB.items,
        bonuses: preSaleB.bonuses,
        subtotal: preSaleB.subtotal,
        totalDiscount: preSaleB.totalDiscount,
        categoryDiscountTotal: preSaleB.categoryDiscountTotal,
        total: preSaleB.total,
        paymentMethod: 'cash',
        amountPaid: 999,
        change: 0,
        route: preSaleB.route,
        routeId: preSaleB.routeId,
        createdAt: serverTimestamp(),
        createdBy: 'vendedor-x@test.com',
        originalCreatedBy: preSaleB.createdBy,
        inventoryDeducted: true,
      })
    );
  });
});

// ── sales.update — receiptImageUrl sin writer real (S1.4-F4) ───────────────
describe('S1.4.1 — sales.update queda deshabilitado (sin writer real)', () => {
  test('admin NO puede actualizar receiptImageUrl', async () => {
    await seedSale('sale-upd1', { total: 100, createdAt: new Date() });
    await assertFails(
      asAdmin().collection('sales').doc('sale-upd1').update({ receiptImageUrl: 'https://x' })
    );
  });

  test('vendedor NO puede actualizar receiptImageUrl', async () => {
    await seedSale('sale-upd2', { total: 100, createdAt: new Date() });
    await assertFails(
      asVendedor().collection('sales').doc('sale-upd2').update({ receiptImageUrl: 'https://x' })
    );
  });

  test('entregador NO puede actualizar receiptImageUrl', async () => {
    await seedSale('sale-upd3', { total: 100, createdAt: new Date() });
    await assertFails(
      asEntregador().collection('sales').doc('sale-upd3').update({ receiptImageUrl: 'https://x' })
    );
  });
});
