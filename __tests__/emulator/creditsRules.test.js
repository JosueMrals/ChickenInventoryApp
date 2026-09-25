/**
 * FASE S1.6.1 — regresión permanente de `credits` (S1.6-F0/F1/F4).
 * Dos shapes reales de create (crédito desde pre-venta / desde venta rápida)
 * y la sincronización de `total` contra la pre-venta enlazada (rama 3 de
 * update) vía `getAfter()` — ver
 * `audit-reports/fase-s1-6-0-credits-security-audit.md` y
 * `fase-s1-6-1-credits-security-rules-implementation.md`.
 */
const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
// Cliente compat-namespaced (igual que salesRules.test.js): FieldValue.serverTimestamp()
// se importa aparte, no vive en la instancia de firestore().
const firebaseCompat = require('firebase/compat/app');
require('firebase/compat/firestore');
const serverTimestamp = () => firebaseCompat.firestore.FieldValue.serverTimestamp();

const RULES_PATH = path.resolve(__dirname, '../../firebase/firestore.rules');

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'chickeninventoryapp-emulator-test-credits-rules',
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
const seedCredit = async (id, data) => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('credits').doc(id).set(data);
  });
};

const basePreSale = (overrides = {}) => ({
  status: 'pending', customerId: 'cust-1', total: 200, createdBy: 'creador-original@test.com',
  ...overrides,
});

const creditFromPreSalePayload = (preSale, overrides = {}) => ({
  preSaleId: 'ps-1', customerId: preSale.customerId, customerName: 'Juan Pérez',
  clientName: 'Juan Pérez', dueDate: null, total: preSale.total, paid: 0,
  pending: preSale.total, status: 'pending', createdAt: new Date(), createdBy: preSale.createdBy,
  entregadorId: null,
  ...overrides,
});

const creditFromQuickSalePayload = (uid, email, overrides = {}) => ({
  saleId: 'sale-1', customerId: 'cust-1', customerName: 'Juan Pérez', total: 100,
  paid: 40, pending: 60, status: 'pending', createdAt: serverTimestamp(),
  createdBy: email, entregadorId: null,
  ...overrides,
});

// ── CREATE — crédito desde pre-venta ────────────────────────────────────────
describe('S1.6.1 — credits.create (shape: desde pre-venta)', () => {
  test('1. admin crea un crédito real desde pre-venta → PASS', async () => {
    await seedPreSale('ps-1', basePreSale());
    await assertSucceeds(
      asAdmin('admin-1', 'admin-1@test.com').collection('credits').doc('c1').set(
        creditFromPreSalePayload(basePreSale())
      )
    );
  });

  test('2. vendedor crea un crédito real desde pre-venta → PASS', async () => {
    await seedPreSale('ps-1', basePreSale());
    await assertSucceeds(
      asVendedor('vendedor-x', 'vendedor-x@test.com').collection('credits').doc('c2').set(
        creditFromPreSalePayload(basePreSale())
      )
    );
  });

  test('3. bodeguero NO puede crear un crédito → DENIED', async () => {
    await seedPreSale('ps-1', basePreSale());
    await assertFails(
      asBodeguero('bodeguero-x', 'bodeguero-x@test.com').collection('credits').doc('c3').set(
        creditFromPreSalePayload(basePreSale())
      )
    );
  });

  test('4. entregador NO puede crear un crédito → DENIED', async () => {
    await seedPreSale('ps-1', basePreSale());
    await assertFails(
      asEntregador('entregador-x', 'entregador-x@test.com').collection('credits').doc('c4').set(
        creditFromPreSalePayload(basePreSale())
      )
    );
  });

  test('5. preSaleId inexistente → DENIED', async () => {
    await assertFails(
      asVendedor('vendedor-x').collection('credits').doc('c5').set(
        creditFromPreSalePayload(basePreSale(), { preSaleId: 'ps-no-existe' })
      )
    );
  });

  test('6. preSale real + customerId de otra pre-sale → DENIED', async () => {
    await seedPreSale('ps-1', basePreSale());
    await assertFails(
      asVendedor('vendedor-x').collection('credits').doc('c6').set(
        creditFromPreSalePayload(basePreSale(), { customerId: 'cust-ajeno' })
      )
    );
  });

  test('7. preSale real + total de otra pre-sale → DENIED', async () => {
    await seedPreSale('ps-1', basePreSale());
    await assertFails(
      asVendedor('vendedor-x').collection('credits').doc('c7').set(
        creditFromPreSalePayload(basePreSale(), { total: 999, pending: 999 })
      )
    );
  });

  test('8. preSale real + datos legítimos completos → PASS', async () => {
    const preSale = basePreSale({ total: 350 });
    await seedPreSale('ps-1', preSale);
    await assertSucceeds(
      asVendedor('vendedor-x').collection('credits').doc('c8').set(
        creditFromPreSalePayload(preSale)
      )
    );
  });

  test('9. campo arbitrario adicional → DENIED', async () => {
    await seedPreSale('ps-1', basePreSale());
    await assertFails(
      asVendedor('vendedor-x').collection('credits').doc('c9').set({
        ...creditFromPreSalePayload(basePreSale()), discountCode: 'PROMO',
      })
    );
  });

  test('10. createdBy falsificado (no coincide con el creador real de la pre-venta) → DENIED', async () => {
    await seedPreSale('ps-1', basePreSale());
    await assertFails(
      asVendedor('vendedor-x').collection('credits').doc('c10').set(
        creditFromPreSalePayload(basePreSale(), { createdBy: 'suplantado@test.com' })
      )
    );
  });

  test('11. createdAt: NO se valida en este shape (el writer real usa new Date(), no serverTimestamp()) — cualquier fecha pasa junto con el resto de datos legítimos', async () => {
    const preSale = basePreSale();
    await seedPreSale('ps-1', preSale);
    await assertSucceeds(
      asVendedor('vendedor-x').collection('credits').doc('c11').set(
        creditFromPreSalePayload(preSale, { createdAt: new Date('2020-01-01') })
      )
    );
  });

  test('estado de la pre-venta fuera de {pending,dispatched} → DENIED', async () => {
    const preSale = basePreSale({ status: 'paid' });
    await seedPreSale('ps-1', preSale);
    await assertFails(
      asVendedor('vendedor-x').collection('credits').doc('c-status').set(
        creditFromPreSalePayload(preSale)
      )
    );
  });

  test('paid distinto de 0 en la creación → DENIED (el writer real siempre crea en 0)', async () => {
    const preSale = basePreSale();
    await seedPreSale('ps-1', preSale);
    await assertFails(
      asVendedor('vendedor-x').collection('credits').doc('c-paid').set(
        creditFromPreSalePayload(preSale, { paid: 50, pending: 150 })
      )
    );
  });
});

// ── CREATE — crédito desde venta rápida ─────────────────────────────────────
describe('S1.6.1 — credits.create (shape: desde venta rápida — Quick Sale)', () => {
  test('12. Quick Sale crea un crédito legítimo → PASS', async () => {
    await assertSucceeds(
      asVendedor('vendedor-x', 'vendedor-x@test.com').collection('credits').doc('qc1').set(
        creditFromQuickSalePayload('vendedor-x', 'vendedor-x@test.com')
      )
    );
  });

  test('13. Quick Sale con campo arbitrario → DENIED', async () => {
    await assertFails(
      asVendedor('vendedor-x', 'vendedor-x@test.com').collection('credits').doc('qc2').set({
        ...creditFromQuickSalePayload('vendedor-x', 'vendedor-x@test.com'), presaleId: 'ps-1',
      })
    );
  });

  test('14. Quick Sale con createdBy suplantado → DENIED', async () => {
    await assertFails(
      asVendedor('vendedor-x', 'vendedor-x@test.com').collection('credits').doc('qc3').set(
        creditFromQuickSalePayload('vendedor-x', 'suplantado@test.com')
      )
    );
  });

  test('Quick Sale con createdAt fabricado (no request.time) → DENIED', async () => {
    await assertFails(
      asVendedor('vendedor-x', 'vendedor-x@test.com').collection('credits').doc('qc4').set(
        creditFromQuickSalePayload('vendedor-x', 'vendedor-x@test.com', { createdAt: new Date() })
      )
    );
  });
});

// ── UPDATE — abonos (regresión, sin tocar F2) ───────────────────────────────
describe('S1.6.1 — credits.update rama abonos (regresión)', () => {
  const abonoCredit = (overrides = {}) => ({
    preSaleId: 'ps-abono', customerId: 'cust-1', total: 100, paid: 0, pending: 100,
    status: 'pending', payments: [], createdBy: 'x@test.com', createdAt: new Date(),
    ...overrides,
  });

  test('15. paid > total → DENIED', async () => {
    await seedCredit('cab1', abonoCredit());
    await assertFails(
      asVendedor('vendedor-x').collection('credits').doc('cab1').update({
        paid: 150, pending: 0, status: 'paid', updatedAt: new Date(), payments: [{ amount: 150 }],
      })
    );
  });

  test('16. paid disminuye → DENIED', async () => {
    await seedCredit('cab2', abonoCredit({ paid: 50, pending: 50 }));
    await assertFails(
      asVendedor('vendedor-x').collection('credits').doc('cab2').update({
        paid: 30, pending: 70, status: 'pending', updatedAt: new Date(), payments: [],
      })
    );
  });

  test('17. pending aumenta → DENIED', async () => {
    await seedCredit('cab3', abonoCredit({ paid: 50, pending: 50 }));
    await assertFails(
      asVendedor('vendedor-x').collection('credits').doc('cab3').update({
        paid: 50, pending: 60, status: 'pending', updatedAt: new Date(), payments: [],
      })
    );
  });

  test('18. payments disminuye (se borra una entrada) → DENIED', async () => {
    await seedCredit('cab4', abonoCredit({ paid: 40, pending: 60, payments: [{ amount: 40 }] }));
    await assertFails(
      asVendedor('vendedor-x').collection('credits').doc('cab4').update({
        paid: 70, pending: 30, status: 'pending', updatedAt: new Date(), payments: [],
      })
    );
  });

  test('19. abono legítimo → PASS', async () => {
    await seedCredit('cab5', abonoCredit());
    await assertSucceeds(
      asEntregador('entregador-x').collection('credits').doc('cab5').update({
        paid: 40, pending: 60, status: 'pending', updatedAt: new Date(),
        payments: [{ amount: 40, date: new Date(), by: 'entregador-x@test.com' }],
      })
    );
  });
});

// ── UPDATE — sincronización con la pre-venta (rama 3, getAfter()) ──────────
describe('S1.6.1 — credits.update rama sync (S1.6-F1, getAfter())', () => {
  const syncCredit = (overrides = {}) => ({
    preSaleId: 'ps-sync', customerId: 'cust-1', total: 200, paid: 0, pending: 200,
    status: 'pending', createdBy: 'x@test.com', createdAt: new Date(),
    ...overrides,
  });

  test('20. total del write coincide con el total NUEVO de la pre-venta en la MISMA transacción → PASS', async () => {
    await seedPreSale('ps-sync', basePreSale({ total: 200 }));
    await seedCredit('csync1', syncCredit());
    const db = asVendedor('vendedor-x');
    await assertSucceeds(
      db.runTransaction(async (tx) => {
        tx.update(db.collection('presales').doc('ps-sync'), { total: 150 });
        tx.update(db.collection('credits').doc('csync1'), {
          total: 150, pending: 150, status: 'pending', updatedAt: new Date(),
        });
      })
    );
  });

  test('21. total del write NO coincide con el total nuevo de la pre-venta → DENIED', async () => {
    await seedPreSale('ps-sync', basePreSale({ total: 200 }));
    await seedCredit('csync2', syncCredit());
    const db = asVendedor('vendedor-x');
    await assertFails(
      db.runTransaction(async (tx) => {
        tx.update(db.collection('presales').doc('ps-sync'), { total: 150 });
        tx.update(db.collection('credits').doc('csync2'), {
          total: 999, pending: 999, status: 'pending', updatedAt: new Date(),
        });
      })
    );
  });

  test('22. preSaleId apunta a una pre-venta inexistente → DENIED', async () => {
    await seedCredit('csync3', syncCredit({ preSaleId: 'ps-no-existe' }));
    await assertFails(
      asVendedor('vendedor-x').collection('credits').doc('csync3').update({
        total: 100, pending: 100, status: 'pending', updatedAt: new Date(),
      })
    );
  });

  test('23. customerId/preSaleId manipulado mediante update → DENIED (ni siquiera están en el hasOnly)', async () => {
    await seedPreSale('ps-sync', basePreSale({ total: 200 }));
    await seedCredit('csync4', syncCredit());
    await assertFails(
      asVendedor('vendedor-x').collection('credits').doc('csync4').update({
        total: 150, pending: 150, status: 'pending', updatedAt: new Date(),
        preSaleId: 'ps-otra', customerId: 'cust-otro',
      })
    );
  });

  test('24. paid cambiado durante el sync → DENIED', async () => {
    await seedPreSale('ps-sync', basePreSale({ total: 200 }));
    await seedCredit('csync5', syncCredit());
    await assertFails(
      asVendedor('vendedor-x').collection('credits').doc('csync5').update({
        total: 150, pending: 150, paid: 50, status: 'pending', updatedAt: new Date(),
      })
    );
  });

  test('25. devolución legítima (admin/bodeguero) sincroniza total en la misma transacción → PASS', async () => {
    await seedPreSale('ps-sync', basePreSale({ total: 200 }));
    await seedCredit('csync6', syncCredit());
    const db = asBodeguero('bodeguero-x');
    await assertSucceeds(
      db.runTransaction(async (tx) => {
        tx.update(db.collection('presales').doc('ps-sync'), { total: 80, status: 'partially_returned' });
        tx.update(db.collection('credits').doc('csync6'), {
          total: 80, pending: 80, status: 'pending', updatedAt: new Date(),
        });
      })
    );
  });

  test('26. edición legítima de pre-venta (vendedor) sincroniza total en la misma transacción → PASS', async () => {
    await seedPreSale('ps-sync', basePreSale({ total: 200 }));
    await seedCredit('csync7', syncCredit());
    const db = asVendedor('vendedor-x');
    await assertSucceeds(
      db.runTransaction(async (tx) => {
        tx.update(db.collection('presales').doc('ps-sync'), { total: 300 });
        tx.update(db.collection('credits').doc('csync7'), {
          total: 300, pending: 300, status: 'pending', updatedAt: new Date(),
        });
      })
    );
  });
});

// ── UPDATE — entregadorId (regresión) ───────────────────────────────────────
describe('S1.6.1 — credits.update rama entregadorId (regresión)', () => {
  test('27. admin cambia entregadorId → PASS', async () => {
    await seedCredit('cent1', { total: 100, paid: 0, pending: 100, status: 'pending' });
    await assertSucceeds(
      asAdmin('admin-1').collection('credits').doc('cent1').update({ entregadorId: 'entregador-y' })
    );
  });

  test('28. bodeguero cambia entregadorId → PASS', async () => {
    await seedCredit('cent2', { total: 100, paid: 0, pending: 100, status: 'pending' });
    await assertSucceeds(
      asBodeguero('bodeguero-x').collection('credits').doc('cent2').update({ entregadorId: 'entregador-y' })
    );
  });

  test('29. vendedor cambia entregadorId → DENIED', async () => {
    await seedCredit('cent3', { total: 100, paid: 0, pending: 100, status: 'pending' });
    await assertFails(
      asVendedor('vendedor-x').collection('credits').doc('cent3').update({ entregadorId: 'entregador-y' })
    );
  });

  test('30. entregador cambia entregadorId → DENIED', async () => {
    await seedCredit('cent4', { total: 100, paid: 0, pending: 100, status: 'pending' });
    await assertFails(
      asEntregador('entregador-x').collection('credits').doc('cent4').update({ entregadorId: 'entregador-y' })
    );
  });
});

// ── DELETE (regresión) ───────────────────────────────────────────────────────
describe('S1.6.1 — credits.delete (regresión, sin cambios de política)', () => {
  test('31. vendedor elimina un crédito sin abonos (paid=0) → PASS', async () => {
    await seedCredit('cdel1', { total: 100, paid: 0, pending: 100, status: 'pending' });
    await assertSucceeds(asVendedor('vendedor-x').collection('credits').doc('cdel1').delete());
  });

  test('32. vendedor NO puede eliminar un crédito con abonos → DENIED', async () => {
    await seedCredit('cdel2', { total: 100, paid: 40, pending: 60, status: 'pending' });
    await assertFails(asVendedor('vendedor-x').collection('credits').doc('cdel2').delete());
  });

  test('33. admin puede eliminar un crédito con abonos — comportamiento actual preservado', async () => {
    await seedCredit('cdel3', { total: 100, paid: 40, pending: 60, status: 'pending' });
    await assertSucceeds(asAdmin('admin-1').collection('credits').doc('cdel3').delete());
  });
});

// ── CROSS-DOCUMENT ATTACK (obligatorio, Paso 26) ────────────────────────────
describe('S1.6.1 — cross-document attack en credits.create', () => {
  test('presaleId=A + customerId/total de B → DENIED', async () => {
    const preSaleA = basePreSale({ customerId: 'cust-A', total: 100, createdBy: 'a@test.com' });
    const preSaleB = basePreSale({ customerId: 'cust-B', total: 999, createdBy: 'b@test.com' });
    await seedPreSale('presale-A', preSaleA);
    await seedPreSale('presale-B', preSaleB);

    await assertFails(
      asVendedor('vendedor-x').collection('credits').doc('cross1').set({
        preSaleId: 'presale-A', customerId: preSaleB.customerId, customerName: 'X', clientName: 'X',
        dueDate: null, total: preSaleB.total, paid: 0, pending: preSaleB.total, status: 'pending',
        createdAt: new Date(), createdBy: preSaleB.createdBy, entregadorId: null,
      })
    );
  });

  test('presaleId=A + customerId=A pero total=B → DENIED', async () => {
    const preSaleA = basePreSale({ customerId: 'cust-A', total: 100, createdBy: 'a@test.com' });
    const preSaleB = basePreSale({ customerId: 'cust-B', total: 999, createdBy: 'b@test.com' });
    await seedPreSale('presale-A2', preSaleA);
    await seedPreSale('presale-B2', preSaleB);

    await assertFails(
      asVendedor('vendedor-x').collection('credits').doc('cross2').set({
        preSaleId: 'presale-A2', customerId: preSaleA.customerId, customerName: 'X', clientName: 'X',
        dueDate: null, total: preSaleB.total, paid: 0, pending: preSaleB.total, status: 'pending',
        createdAt: new Date(), createdBy: preSaleA.createdBy, entregadorId: null,
      })
    );
  });

  test('payload completamente correspondiente a A → PASS', async () => {
    const preSaleA = basePreSale({ customerId: 'cust-A', total: 100, createdBy: 'a@test.com' });
    await seedPreSale('presale-A3', preSaleA);

    await assertSucceeds(
      asVendedor('vendedor-x').collection('credits').doc('cross3').set({
        preSaleId: 'presale-A3', customerId: preSaleA.customerId, customerName: 'X', clientName: 'X',
        dueDate: null, total: preSaleA.total, paid: 0, pending: preSaleA.total, status: 'pending',
        createdAt: new Date(), createdBy: preSaleA.createdBy, entregadorId: null,
      })
    );
  });
});
