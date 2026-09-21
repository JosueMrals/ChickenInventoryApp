/**
 * FASE S1.3 — regresión permanente de `presales.update` (S1-03 / S1.3.0-F1,F2,F3).
 *
 * Reemplaza `isOperativo()` sin distinción por 9 ramas, una por cada writer
 * real identificado en la auditoría S1.3.0 (ver
 * `audit-reports/fase-s1-3-0-presales-state-machine-audit.md`, secciones 6 y
 * 12). Los ataques A-H/H2 de esta suite son los mismos 10 casos que S1.3.0
 * probó con `assertSucceeds` contra las Rules viejas — aquí se esperan
 * `assertFails`.
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
    projectId: 'chickeninventoryapp-emulator-test-presales-rules',
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
const asAdmin = (uid = 'admin-1') => testEnv.authenticatedContext(uid, { role: 'admin' }).firestore();
const asBodeguero = (uid = 'bodeguero-x') => testEnv.authenticatedContext(uid, { role: 'bodeguero' }).firestore();
const asEntregador = (uid = 'entregador-x') => testEnv.authenticatedContext(uid, { role: 'entregador' }).firestore();

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
  customer: { firstName: 'Juan', lastName: 'Pérez' },
  customerId: 'cust-1',
  customerName: 'Juan Pérez',
  subtotal: 100,
  total: 100,
  totalDiscount: 0,
  categoryDiscountTotal: 0,
  status: 'pending',
  paymentMethod: 'cash',
  createdAt: new Date(),
  createdBy: 'otro-vendedor@test.com',
  items: [{ productId: 'p1', quantity: 2, unitPrice: 50, total: 100 }],
  bonuses: [],
  inventoryDeducted: true,
  ...overrides,
});

// ── Ataques A-H/H2 (S1.3.0) ─────────────────────────────────────────────────
// A/B/E/F: S1.3.0 los probó como "campo único" para demostrar la falta TOTAL
// de hasOnly/rol/estado (S1-03). Con las Rules nuevas, editar un campo de
// CONTENIDO (customerName/total/items/customerId) de una pre-venta pending
// SIGUE siendo legítimo para cualquier vendedor/admin: `presales` no tiene
// `createdByUid`, ningún servicio real restringe por dueño, y CLAUDE.md/el
// Role Matrix de S1.3.0 documentan `presales` como flujo compartido
// admin+vendedor sin owner-scope (decisión explícita, no un hueco residual).
// Lo que S1-03 realmente rompía — cualquier CAMPO, incluyendo status/
// entregadorId/amountPaid, y cualquier ROL — ya queda cerrado por las ramas
// 2-9 (ver el resto de este archivo) y por D/G/H/H2 abajo.
describe('S1.3 — Ataques diagnosticados en S1.3.0 (reclasificados tras las Rules nuevas)', () => {
  test('A: vendedor-x SÍ puede editar customerName de una pre-venta ajena (pending, flujo compartido, sin ownership)', async () => {
    await seedPreSale('ps-a', basePreSale());
    await assertSucceeds(
      asVendedor('vendedor-x').collection('presales').doc('ps-a').update({ customerName: 'Nombre Corregido' })
    );
  });

  test('A2: bodeguero/entregador NO pueden editar customerName (rol incorrecto — aquí sí queda cerrado)', async () => {
    await seedPreSale('ps-a2', basePreSale());
    await assertFails(asBodeguero().collection('presales').doc('ps-a2').update({ customerName: 'X' }));
    await seedPreSale('ps-a3', basePreSale());
    await assertFails(asEntregador().collection('presales').doc('ps-a3').update({ customerName: 'X' }));
  });

  test('B: vendedor-x SÍ puede bajar el total de una pre-venta pending (mismo criterio que A)', async () => {
    await seedPreSale('ps-b', basePreSale());
    await assertSucceeds(
      asVendedor('vendedor-x').collection('presales').doc('ps-b').update({ total: 1 })
    );
  });

  test('B2: vendedor-x NO puede tocar total en una pre-venta ya dispatched (estado terminal cierra el hueco real)', async () => {
    await seedPreSale('ps-b2', basePreSale({ status: 'dispatched', entregadorId: 'e1' }));
    await assertFails(
      asVendedor('vendedor-x').collection('presales').doc('ps-b2').update({ total: 1 })
    );
  });

  test('C: vendedor-x NO puede marcar status:paid directamente desde un estado de bodega (preparing) — ninguna rama lo permite', async () => {
    await seedPreSale('ps-c', basePreSale({ status: 'preparing' }));
    await assertFails(
      asVendedor('vendedor-x').collection('presales').doc('ps-c').update({ status: 'paid' })
    );
  });

  test('D: vendedor-x se autoasigna entregadorId', async () => {
    await seedPreSale('ps-d', basePreSale({ status: 'ready_for_delivery' }));
    await assertFails(
      asVendedor('vendedor-x').collection('presales').doc('ps-d').update({
        status: 'dispatched', entregadorId: 'vendedor-x',
      })
    );
  });

  test('E: vendedor-x SÍ puede editar items de una pre-venta pending (mismo criterio que A)', async () => {
    await seedPreSale('ps-e', basePreSale());
    await assertSucceeds(
      asVendedor('vendedor-x').collection('presales').doc('ps-e').update({
        items: [
          { productId: 'p1', quantity: 2, unitPrice: 50, total: 100 },
          { productId: 'p2', quantity: 5, unitPrice: 80, total: 400 },
        ],
      })
    );
  });

  test('E2: vendedor-x NO puede editar items junto con un campo que ninguna rama autoriza combinar (entregadorId) — hasOnly lo bloquea', async () => {
    await seedPreSale('ps-e2', basePreSale());
    await assertFails(
      asVendedor('vendedor-x').collection('presales').doc('ps-e2').update({
        items: [{ productId: 'p1', quantity: 2, unitPrice: 50, total: 100 }],
        entregadorId: 'vendedor-x',
      })
    );
  });

  test('F: vendedor-x SÍ puede reasignar customerId de una pre-venta pending (mismo criterio que A)', async () => {
    await seedPreSale('ps-f', basePreSale());
    await assertSucceeds(
      asVendedor('vendedor-x').collection('presales').doc('ps-f').update({ customerId: 'cust-2' })
    );
  });

  test('G: bodeguero-x marca directamente status:paid (fuera de su flujo)', async () => {
    await seedPreSale('ps-g', basePreSale());
    await assertFails(
      asBodeguero('bodeguero-x').collection('presales').doc('ps-g').update({ status: 'paid' })
    );
  });

  test('G2: bodeguero-x cambia total de una pre-venta que no le pertenece', async () => {
    await seedPreSale('ps-g2', basePreSale());
    await assertFails(
      asBodeguero('bodeguero-x').collection('presales').doc('ps-g2').update({ total: 999999 })
    );
  });

  test('H: entregador-x cobra (payload completo de la rama 4) una entrega asignada a OTRO entregador', async () => {
    await seedPreSale('ps-h', basePreSale({ status: 'dispatched', entregadorId: 'entregador-y' }));
    await assertFails(
      asEntregador('entregador-x').collection('presales').doc('ps-h').update({
        status: 'paid', amountPaid: 100, change: 0, fechaPago: new Date(), updatedAt: new Date(),
      })
    );
  });

  test('H2: entregador-x roba una entrega (ready_for_delivery → dispatched, se autoasigna)', async () => {
    await seedPreSale('ps-h2', basePreSale({ status: 'ready_for_delivery' }));
    await assertFails(
      asEntregador('entregador-x').collection('presales').doc('ps-h2').update({
        status: 'dispatched', entregadorId: 'entregador-x', dispatchedAt: new Date(),
        dispatchedBy: 'entregador-x', fechaEntregaRepartidor: new Date(),
      })
    );
  });

  test('H3: entregador-x reasigna entregadorId de una entrega ya despachada a otro (sin cambiar status)', async () => {
    await seedPreSale('ps-h3', basePreSale({ status: 'dispatched', entregadorId: 'entregador-y' }));
    await assertFails(
      asEntregador('entregador-x').collection('presales').doc('ps-h3').update({ entregadorId: 'entregador-x' })
    );
  });
});

// ── Inmutabilidad de campos de creación ────────────────────────────────────
describe('S1.3 — createdBy/createdAt/preSaleNumber quedan inmutables', () => {
  test('vendedor no puede colar createdBy dentro de una edición legítima de contenido', async () => {
    await seedPreSale('ps-imm', basePreSale({ createdBy: 'creador-original@test.com' }));
    await assertFails(
      asVendedor('vendedor-x').collection('presales').doc('ps-imm').update({
        customer: { firstName: 'X' }, customerId: 'c2', customerName: 'X',
        subtotal: 100, totalDiscount: 0, categoryDiscountTotal: 0, total: 100,
        paymentMethod: 'cash', creditDueDate: null, updatedAt: new Date(),
        updatedBy: 'vendedor-x', items: [], bonuses: [], route: null, routeId: null,
        status: 'pending',
        createdBy: 'vendedor-x@test.com',
      })
    );
  });
});

// ── Hard delete deshabilitado (S1.3.0-F6) ──────────────────────────────────
describe('S1.3 — presales.delete queda deshabilitado (ningún writer real hace hard-delete)', () => {
  test('admin ya no puede borrar físicamente una pre-venta', async () => {
    await seedPreSale('ps-del', basePreSale());
    await assertFails(asAdmin().collection('presales').doc('ps-del').delete());
  });

  test('vendedor tampoco puede borrar físicamente una pre-venta', async () => {
    await seedPreSale('ps-del2', basePreSale());
    await assertFails(asVendedor().collection('presales').doc('ps-del2').delete());
  });
});

// ── 1) Edición de contenido no terminal (admin/vendedor) ───────────────────
describe('S1.3 — rama 1: edición de contenido no terminal', () => {
  // S1.3.1: sin inventoryDeducted*/inventoryDeductedAt/inventoryDeductedBy —
  // updatePreSaleInFirestore solo los copia hacia adelante con el mismo valor
  // (nunca los cambia), así que el writer real nunca los incluye en
  // affectedKeys() y este payload no necesita enviarlos para ser legítimo.
  const fullEditPayload = (overrides = {}) => ({
    customer: { firstName: 'Ana' }, customerId: 'cust-2', customerName: 'Ana',
    subtotal: 200, totalDiscount: 0, categoryDiscountTotal: 0, total: 200,
    paymentMethod: 'cash', creditDueDate: null, updatedAt: new Date(), updatedBy: 'vendedor-x',
    items: [{ productId: 'p1', quantity: 4, unitPrice: 50, total: 200 }], bonuses: [],
    route: null, routeId: null, status: 'pending',
    ...overrides,
  });

  test('vendedor puede editar total/items/customer de una pre-venta pending (propia o ajena, es un flujo operativo compartido)', async () => {
    await seedPreSale('ps-edit1', basePreSale());
    await assertSucceeds(asVendedor('vendedor-x').collection('presales').doc('ps-edit1').update(fullEditPayload()));
  });

  test('admin puede editar contenido igual que vendedor', async () => {
    await seedPreSale('ps-edit2', basePreSale());
    await assertSucceeds(asAdmin().collection('presales').doc('ps-edit2').update(fullEditPayload()));
  });

  test('bodeguero NO puede usar esta rama (rol incorrecto)', async () => {
    await seedPreSale('ps-edit3', basePreSale());
    await assertFails(asBodeguero().collection('presales').doc('ps-edit3').update(fullEditPayload()));
  });

  test('vendedor NO puede editar contenido de una pre-venta ya dispatched (estado terminal)', async () => {
    await seedPreSale('ps-edit4', basePreSale({ status: 'dispatched', entregadorId: 'entregador-y' }));
    await assertFails(asVendedor('vendedor-x').collection('presales').doc('ps-edit4').update(fullEditPayload()));
  });

  test('vendedor puede convertir cash→credit vía esta rama (status pending→credit_pending, mismo escalón)', async () => {
    await seedPreSale('ps-edit5', basePreSale());
    await assertSucceeds(
      asVendedor('vendedor-x').collection('presales').doc('ps-edit5').update(
        fullEditPayload({ paymentMethod: 'credit', status: 'credit_pending' })
      )
    );
  });

  test('vendedor NO puede saltar de pending a credit_ready_for_delivery en un solo edit (no es conversión de escalón)', async () => {
    await seedPreSale('ps-edit6', basePreSale());
    await assertFails(
      asVendedor('vendedor-x').collection('presales').doc('ps-edit6').update(
        fullEditPayload({ paymentMethod: 'credit', status: 'credit_ready_for_delivery' })
      )
    );
  });

  // ── FASE S1.3.1 — inventoryDeducted* ya NO está en el hasOnly de esta rama:
  // updatePreSaleInFirestore solo los copia con el mismo valor, nunca los
  // cambia, así que permitirlos dejaba a admin/vendedor alterar el estado de
  // inventario con un valor arbitrario sin ejecutar el writer que de verdad lo
  // mueve. basePreSale() no seedea inventoryDeductedAt/inventoryDeductedBy,
  // así que cualquier valor concreto aquí es un cambio real (affectedKeys lo
  // detecta), no un passthrough.
  test('S1.3.1: vendedor NO puede cambiar inventoryDeducted vía la rama de edición de contenido', async () => {
    await seedPreSale('ps-inv1', basePreSale({ inventoryDeducted: true }));
    await assertFails(
      asVendedor('vendedor-x').collection('presales').doc('ps-inv1').update(
        fullEditPayload({ inventoryDeducted: false })
      )
    );
  });

  test('S1.3.1: vendedor NO puede cambiar inventoryDeductedAt vía la rama de edición de contenido', async () => {
    await seedPreSale('ps-inv2', basePreSale());
    await assertFails(
      asVendedor('vendedor-x').collection('presales').doc('ps-inv2').update(
        fullEditPayload({ inventoryDeductedAt: new Date() })
      )
    );
  });

  test('S1.3.1: vendedor NO puede cambiar inventoryDeductedBy vía la rama de edición de contenido', async () => {
    await seedPreSale('ps-inv3', basePreSale());
    await assertFails(
      asVendedor('vendedor-x').collection('presales').doc('ps-inv3').update(
        fullEditPayload({ inventoryDeductedBy: 'vendedor-x@test.com' })
      )
    );
  });

  test('S1.3.1: admin tampoco puede cambiar inventoryDeducted* vía esta rama', async () => {
    await seedPreSale('ps-inv4', basePreSale());
    await assertFails(
      asAdmin().collection('presales').doc('ps-inv4').update(fullEditPayload({ inventoryDeducted: false }))
    );
  });

  // Confirma que la remoción NO rompe el writer real: updatePreSaleInFirestore
  // relee inventoryDeducted* y los reescribe con el MISMO valor (passthrough).
  // Simulado aquí seedeando ya el valor y reenviándolo sin cambio: no debería
  // aparecer en affectedKeys() y el edit legítimo debe seguir pasando.
  test('S1.3.1: una edición legítima sigue funcionando si el payload incluye inventoryDeducted* con el MISMO valor ya existente (passthrough real del writer)', async () => {
    const seededAt = new Date('2026-01-01T00:00:00Z');
    await seedPreSale('ps-inv5', basePreSale({ inventoryDeducted: true, inventoryDeductedAt: seededAt, inventoryDeductedBy: 'creador@test.com' }));
    await assertSucceeds(
      asVendedor('vendedor-x').collection('presales').doc('ps-inv5').update({
        ...fullEditPayload(),
        inventoryDeducted: true, inventoryDeductedAt: seededAt, inventoryDeductedBy: 'creador@test.com',
      })
    );
  });

  // ── FASE S1.3.1 — Paso 9, "campos cruzados": un campo de contenido legítimo
  // combinado con un campo que pertenece a OTRO writer debe seguir cayendo por
  // hasOnly, sin importar que el campo de contenido en sí sea legítimo.
  test('S1.3.1: contenido + campo de dispatch (entregadorId) en el mismo write → DENIED', async () => {
    await seedPreSale('ps-cross1', basePreSale());
    await assertFails(
      asVendedor('vendedor-x').collection('presales').doc('ps-cross1').update({
        ...fullEditPayload(), entregadorId: 'vendedor-x',
      })
    );
  });

  test('S1.3.1: contenido + campo de cobro (amountPaid) en el mismo write → DENIED', async () => {
    await seedPreSale('ps-cross2', basePreSale());
    await assertFails(
      asVendedor('vendedor-x').collection('presales').doc('ps-cross2').update({
        ...fullEditPayload(), amountPaid: 100,
      })
    );
  });

  test('S1.3.1: contenido + campo de cancelación (cancelledAt) en el mismo write → DENIED', async () => {
    await seedPreSale('ps-cross3', basePreSale());
    await assertFails(
      asVendedor('vendedor-x').collection('presales').doc('ps-cross3').update({
        ...fullEditPayload(), cancelledAt: new Date(),
      })
    );
  });
});

// ── 2) Avance/retroceso de bodega ───────────────────────────────────────────
describe('S1.3 — rama 2: avance/retroceso de bodega (isBodeguero exclusivo)', () => {
  const warehousePayload = (status, items = [{ productId: 'p1', status: 'preparing' }]) => ({
    status, items, bonuses: [], updatedAt: new Date(), lastWorker: 'bodeguero-x@test.com',
  });

  test('bodeguero avanza pending → preparing', async () => {
    await seedPreSale('ps-wh1', basePreSale());
    await assertSucceeds(asBodeguero().collection('presales').doc('ps-wh1').update(warehousePayload('preparing')));
  });

  test('bodeguero avanza preparing → ready_for_delivery', async () => {
    await seedPreSale('ps-wh2', basePreSale({ status: 'preparing' }));
    await assertSucceeds(
      asBodeguero().collection('presales').doc('ps-wh2').update(warehousePayload('ready_for_delivery', [{ productId: 'p1', status: 'ready' }]))
    );
  });

  test('bodeguero retrocede ready_for_delivery → preparing', async () => {
    await seedPreSale('ps-wh3', basePreSale({ status: 'ready_for_delivery' }));
    await assertSucceeds(asBodeguero().collection('presales').doc('ps-wh3').update(warehousePayload('preparing')));
  });

  test('bodeguero retrocede preparing → pending', async () => {
    await seedPreSale('ps-wh4', basePreSale({ status: 'preparing' }));
    await assertSucceeds(
      asBodeguero().collection('presales').doc('ps-wh4').update(warehousePayload('pending', [{ productId: 'p1', status: 'pending' }]))
    );
  });

  test('bodeguero avanza el riel de crédito: credit_pending → credit_preparing', async () => {
    await seedPreSale('ps-wh5', basePreSale({ status: 'credit_pending', paymentMethod: 'credit' }));
    await assertSucceeds(asBodeguero().collection('presales').doc('ps-wh5').update(warehousePayload('credit_preparing')));
  });

  test('bodeguero NO puede cruzar de riel (pending → credit_preparing) por esta rama', async () => {
    await seedPreSale('ps-wh6', basePreSale());
    await assertFails(asBodeguero().collection('presales').doc('ps-wh6').update(warehousePayload('credit_preparing')));
  });

  test('vendedor NO puede avanzar bodega aunque use el payload exacto', async () => {
    await seedPreSale('ps-wh7', basePreSale());
    await assertFails(asVendedor().collection('presales').doc('ps-wh7').update(warehousePayload('preparing')));
  });

  test('bodeguero NO puede avanzar una orden ya dispatched (terminal para bodega)', async () => {
    await seedPreSale('ps-wh8', basePreSale({ status: 'dispatched', entregadorId: 'e1' }));
    await assertFails(asBodeguero().collection('presales').doc('ps-wh8').update(warehousePayload('preparing')));
  });
});

// ── 3) Despacho ──────────────────────────────────────────────────────────────
describe('S1.3 — rama 3: despacho (isBodeguero exclusivo, cubre dispatch individual y handover masivo)', () => {
  const dispatchPayload = (entregadorId = 'entregador-x') => ({
    status: 'dispatched', entregadorId, dispatchedAt: new Date(),
    dispatchedBy: 'bodeguero-x', fechaEntregaRepartidor: new Date(),
  });

  test('bodeguero despacha una orden ready_for_delivery', async () => {
    await seedPreSale('ps-disp1', basePreSale({ status: 'ready_for_delivery' }));
    await assertSucceeds(asBodeguero('bodeguero-x').collection('presales').doc('ps-disp1').update(dispatchPayload()));
  });

  test('bodeguero despacha una orden credit_ready_for_delivery', async () => {
    await seedPreSale('ps-disp2', basePreSale({ status: 'credit_ready_for_delivery', paymentMethod: 'credit' }));
    await assertSucceeds(asBodeguero('bodeguero-x').collection('presales').doc('ps-disp2').update(dispatchPayload()));
  });

  test('vendedor NO puede despachar aunque use el payload exacto del handover', async () => {
    await seedPreSale('ps-disp3', basePreSale({ status: 'ready_for_delivery' }));
    await assertFails(asVendedor('vendedor-x').collection('presales').doc('ps-disp3').update(dispatchPayload('vendedor-x')));
  });

  test('entregador NO puede despachar aunque use el payload exacto del handover', async () => {
    await seedPreSale('ps-disp4', basePreSale({ status: 'ready_for_delivery' }));
    await assertFails(asEntregador('entregador-x').collection('presales').doc('ps-disp4').update(dispatchPayload('entregador-x')));
  });

  test('bodeguero NO puede despachar desde pending (solo ready_for_delivery/credit_ready_for_delivery)', async () => {
    await seedPreSale('ps-disp5', basePreSale());
    await assertFails(asBodeguero('bodeguero-x').collection('presales').doc('ps-disp5').update(dispatchPayload()));
  });

  test('handover: el crédito enlazado también se actualiza correctamente (credits.update ya lo permite, sin tocar esta fase)', async () => {
    await seedPreSale('ps-disp6', basePreSale({ status: 'ready_for_delivery', creditId: 'cr-1', paymentMethod: 'credit' }));
    await seedCredit('cr-1', { total: 100, paid: 0, pending: 100, status: 'pending', entregadorId: null });
    await assertSucceeds(asBodeguero('bodeguero-x').collection('presales').doc('ps-disp6').update(dispatchPayload()));
    await assertSucceeds(
      asBodeguero('bodeguero-x').collection('credits').doc('cr-1').update({ entregadorId: 'entregador-x' })
    );
  });
});

// ── 4) Cobro por el entregador asignado ─────────────────────────────────────
describe('S1.3 — rama 4: cobro por el entregador asignado (ownership)', () => {
  test('el entregador asignado SÍ puede cobrar su propia entrega (contado)', async () => {
    await seedPreSale('ps-pay1', basePreSale({ status: 'dispatched', entregadorId: 'entregador-x' }));
    await assertSucceeds(
      asEntregador('entregador-x').collection('presales').doc('ps-pay1').update({
        status: 'paid', amountPaid: 100, change: 0, fechaPago: new Date(), updatedAt: new Date(),
      })
    );
  });

  test('el entregador asignado SÍ puede dejar un crédito parcialmente cobrado (credit_dispatched)', async () => {
    await seedPreSale('ps-pay2', basePreSale({ status: 'dispatched', entregadorId: 'entregador-x', paymentMethod: 'credit' }));
    await assertSucceeds(
      asEntregador('entregador-x').collection('presales').doc('ps-pay2').update({
        status: 'credit_dispatched', amountPaid: 40, change: 0, creditId: 'cr-2', updatedAt: new Date(),
      })
    );
  });

  test('un entregador NO asignado no puede cobrar (ver también ataque H)', async () => {
    await seedPreSale('ps-pay3', basePreSale({ status: 'dispatched', entregadorId: 'entregador-y' }));
    await assertFails(
      asEntregador('entregador-x').collection('presales').doc('ps-pay3').update({
        status: 'paid', amountPaid: 100, change: 0, fechaPago: new Date(), updatedAt: new Date(),
      })
    );
  });

  test('vendedor NO puede usar el payload EXCLUSIVO de esta rama (inventoryDeducted*, no lo cubre ninguna otra rama de vendedor/admin)', async () => {
    await seedPreSale('ps-pay4', basePreSale({ status: 'dispatched', entregadorId: 'vendedor-x' }));
    await assertFails(
      asVendedor('vendedor-x').collection('presales').doc('ps-pay4').update({
        status: 'paid', amountPaid: 100, change: 0, fechaPago: new Date(), updatedAt: new Date(),
        inventoryDeducted: true, inventoryDeductedAt: new Date(), inventoryDeductedBy: 'vendedor-x',
      })
    );
  });
});

// ── 5) Cobro directo en mostrador (admin/vendedor) ──────────────────────────
describe('S1.3 — rama 5: cobro directo en mostrador (convertPreSaleToSale)', () => {
  const counterPayload = () => ({
    status: 'paid', saleId: 'sale-1', fechaPago: new Date(), amountPaid: 100,
    change: 0, paymentMethod: 'cash', updatedAt: new Date(), updatedBy: 'vendedor-x',
  });

  test('vendedor cobra en mostrador una pre-venta pending', async () => {
    await seedPreSale('ps-cnt1', basePreSale());
    await assertSucceeds(asVendedor('vendedor-x').collection('presales').doc('ps-cnt1').update(counterPayload()));
  });

  test('admin cobra en mostrador una pre-venta ya dispatched (cliente pasa a recoger/pagar directo)', async () => {
    await seedPreSale('ps-cnt2', basePreSale({ status: 'dispatched', entregadorId: 'entregador-y' }));
    await assertSucceeds(asAdmin().collection('presales').doc('ps-cnt2').update(counterPayload()));
  });

  test('bodeguero NO puede usar esta rama', async () => {
    await seedPreSale('ps-cnt3', basePreSale());
    await assertFails(asBodeguero().collection('presales').doc('ps-cnt3').update(counterPayload()));
  });

  test('entregador NO puede usar esta rama (su cobro es la rama 4, con ownership)', async () => {
    await seedPreSale('ps-cnt4', basePreSale({ status: 'dispatched', entregadorId: 'entregador-x' }));
    await assertFails(asEntregador('entregador-x').collection('presales').doc('ps-cnt4').update(counterPayload()));
  });
});

// ── 6) Saldar crédito ya despachado ─────────────────────────────────────────
describe('S1.3 — rama 6: saldar un crédito ya despachado (mismos roles que credits.update)', () => {
  const settlePayload = () => ({ status: 'paid', fechaPago: new Date(), updatedAt: new Date() });

  test('admin puede saldar un credit_dispatched a paid', async () => {
    await seedPreSale('ps-set1', basePreSale({ status: 'credit_dispatched', paymentMethod: 'credit', entregadorId: 'entregador-y' }));
    await assertSucceeds(asAdmin().collection('presales').doc('ps-set1').update(settlePayload()));
  });

  test('vendedor puede saldar un credit_dispatched a paid', async () => {
    await seedPreSale('ps-set2', basePreSale({ status: 'credit_dispatched', paymentMethod: 'credit', entregadorId: 'entregador-y' }));
    await assertSucceeds(asVendedor().collection('presales').doc('ps-set2').update(settlePayload()));
  });

  test('cualquier entregador (no necesariamente el asignado) puede saldar un credit_dispatched — mismo criterio que credits.update, sin ownership', async () => {
    await seedPreSale('ps-set3', basePreSale({ status: 'credit_dispatched', paymentMethod: 'credit', entregadorId: 'entregador-y' }));
    await assertSucceeds(asEntregador('entregador-x').collection('presales').doc('ps-set3').update(settlePayload()));
  });

  test('bodeguero NO puede usar esta rama', async () => {
    await seedPreSale('ps-set4', basePreSale({ status: 'credit_dispatched', paymentMethod: 'credit' }));
    await assertFails(asBodeguero().collection('presales').doc('ps-set4').update(settlePayload()));
  });

  test('un entregador NO puede usar el payload de 3 campos de esta rama para robar el cobro completo de una entrega en efectivo dispatched (debe usar la rama 4, con ownership)', async () => {
    await seedPreSale('ps-set5', basePreSale({ status: 'dispatched', entregadorId: 'entregador-y', paymentMethod: 'cash' }));
    // Payload de 3 campos (rama 6) SÍ pasa el hasOnly, pero esto documenta que
    // el resultado es igual de "pagado" sin registrar amountPaid/change reales
    // — riesgo aceptado y heredado de credits.update (ver comentario en Rules).
    // Lo que NO debe poder hacer es colar además amountPaid/change en el mismo
    // write con ownership ajeno usando la rama 4.
    await assertFails(
      asEntregador('entregador-x').collection('presales').doc('ps-set5').update({
        status: 'paid', amountPaid: 100, change: 0, fechaPago: new Date(), updatedAt: new Date(),
      })
    );
  });
});

// ── 7) Conversión cash/crédito y eliminar crédito ───────────────────────────
describe('S1.3 — rama 7: conversión cash/crédito (createCreditFromPreSale / eliminarCredito)', () => {
  test('vendedor crea un crédito desde una pre-venta pending', async () => {
    await seedPreSale('ps-conv1', basePreSale());
    await assertSucceeds(
      asVendedor().collection('presales').doc('ps-conv1').update({
        status: 'credit_pending', creditId: 'cr-3', creditDueDate: new Date(), updatedAt: new Date(),
      })
    );
  });

  test('vendedor crea un crédito desde una pre-venta ya dispatched (assertPreSaleCreditable lo permite)', async () => {
    await seedPreSale('ps-conv2', basePreSale({ status: 'dispatched', entregadorId: 'e1' }));
    await assertSucceeds(
      asVendedor().collection('presales').doc('ps-conv2').update({
        status: 'credit_pending', creditId: 'cr-4', creditDueDate: new Date(), updatedAt: new Date(),
      })
    );
  });

  test('admin elimina un crédito y regresa la pre-venta a contado (credit_pending → pending)', async () => {
    await seedPreSale('ps-conv3', basePreSale({ status: 'credit_pending', paymentMethod: 'credit', creditId: 'cr-5' }));
    await assertSucceeds(
      asAdmin().collection('presales').doc('ps-conv3').update({
        status: 'pending', paymentMethod: 'cash', creditId: null, creditDueDate: null, updatedAt: new Date(),
      })
    );
  });

  test('bodeguero NO puede convertir cash/crédito', async () => {
    await seedPreSale('ps-conv4', basePreSale());
    await assertFails(
      asBodeguero().collection('presales').doc('ps-conv4').update({
        status: 'credit_pending', creditId: 'cr-6', creditDueDate: new Date(), updatedAt: new Date(),
      })
    );
  });

  test('vendedor NO puede crear un crédito desde una pre-venta ya cobrada (paid no es un origen válido)', async () => {
    await seedPreSale('ps-conv5', basePreSale({ status: 'paid' }));
    await assertFails(
      asVendedor().collection('presales').doc('ps-conv5').update({
        status: 'credit_pending', creditId: 'cr-7', creditDueDate: new Date(), updatedAt: new Date(),
      })
    );
  });
});

// ── 8) Cancelación ───────────────────────────────────────────────────────────
describe('S1.3 — rama 8: cancelación (soft-cancel)', () => {
  const cancelPayload = () => ({
    status: 'cancelled', cancelledAt: new Date(), cancelledBy: 'vendedor-x',
    cancellationReason: 'Cliente canceló', updatedAt: new Date(), updatedBy: 'vendedor-x',
    inventoryRestored: true, inventoryRestoredAt: new Date(), inventoryRestoredBy: 'vendedor-x',
  });

  test('vendedor cancela una pre-venta pending', async () => {
    await seedPreSale('ps-cxl1', basePreSale());
    await assertSucceeds(asVendedor('vendedor-x').collection('presales').doc('ps-cxl1').update(cancelPayload()));
  });

  test('admin cancela una pre-venta credit_pending', async () => {
    await seedPreSale('ps-cxl2', basePreSale({ status: 'credit_pending', paymentMethod: 'credit' }));
    await assertSucceeds(asAdmin().collection('presales').doc('ps-cxl2').update(cancelPayload()));
  });

  test('vendedor NO puede cancelar una pre-venta ya en preparing (bodega ya la trabajó)', async () => {
    await seedPreSale('ps-cxl3', basePreSale({ status: 'preparing' }));
    await assertFails(asVendedor('vendedor-x').collection('presales').doc('ps-cxl3').update(cancelPayload()));
  });

  test('bodeguero/entregador NO pueden cancelar', async () => {
    await seedPreSale('ps-cxl4', basePreSale());
    await assertFails(asBodeguero().collection('presales').doc('ps-cxl4').update(cancelPayload()));
    await seedPreSale('ps-cxl5', basePreSale());
    await assertFails(asEntregador().collection('presales').doc('ps-cxl5').update(cancelPayload()));
  });
});

// ── 9) Devolución aprobada ───────────────────────────────────────────────────
describe('S1.3/S1.5.1 — rama 9: devolución aprobada (admin/bodeguero — vendedor y entregador excluidos)', () => {
  const returnPayload = (status) => ({
    items: [], bonuses: [], subtotal: 0, total: 0, totalDiscount: 0,
    returnedSummary: [{ productId: 'p1', quantity: 2, total: 100 }], returnedTotal: 100,
    status, returnedAt: new Date(), lastReturnAt: new Date(), returnApprovedBy: 'bodeguero-x',
  });

  test('bodeguero aprueba una devolución total (returned)', async () => {
    await seedPreSale('ps-ret1', basePreSale({ status: 'dispatched', entregadorId: 'e1' }));
    await assertSucceeds(asBodeguero('bodeguero-x').collection('presales').doc('ps-ret1').update(returnPayload('returned')));
  });

  // S1.5-F3 (S1.5.0/S1.5.1): isEntregador() se retiró de esta rama — el único
  // writer real (approveReturnRequest, vía returnRequests.update →
  // isWarehouseResolution()) exige admin/bodeguero; un entregador nunca
  // llegaba a completar esa transacción, así que su presencia aquí era una
  // concesión inalcanzable, no una capacidad real.
  test('entregador NO puede aprobar una devolución directamente sobre presales (S1.5-F3)', async () => {
    await seedPreSale('ps-ret2', basePreSale({ status: 'paid' }));
    await assertFails(asEntregador('entregador-x').collection('presales').doc('ps-ret2').update(returnPayload('partially_returned')));
  });

  test('admin aprueba una devolución', async () => {
    await seedPreSale('ps-ret3', basePreSale());
    await assertSucceeds(asAdmin().collection('presales').doc('ps-ret3').update(returnPayload('returned')));
  });

  test('vendedor NO puede aprobar devoluciones (excluido explícitamente)', async () => {
    await seedPreSale('ps-ret4', basePreSale());
    await assertFails(asVendedor('vendedor-x').collection('presales').doc('ps-ret4').update(returnPayload('returned')));
  });

  test('esta rama no puede usarse para colar un status distinto de partially_returned/returned', async () => {
    await seedPreSale('ps-ret5', basePreSale());
    await assertFails(asBodeguero('bodeguero-x').collection('presales').doc('ps-ret5').update(returnPayload('paid')));
  });
});

// ── history: sin cambios, append-only ───────────────────────────────────────
describe('S1.3 — presales/history sigue siendo append-only (sin cambios en esta fase)', () => {
  test('vendedor puede crear una entrada de historial', async () => {
    await seedPreSale('ps-hist1', basePreSale());
    await assertSucceeds(
      asVendedor().collection('presales').doc('ps-hist1').collection('history').doc('h1').set({
        timestamp: new Date(), user: 'vendedor-x@test.com', action: 'EDIT', details: 'x',
      })
    );
  });

  test('nadie puede editar una entrada de historial ya creada', async () => {
    await seedPreSale('ps-hist2', basePreSale());
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('presales').doc('ps-hist2').collection('history').doc('h2').set({
        timestamp: new Date(), user: 'x', action: 'CREATE', details: 'x',
      });
    });
    await assertFails(
      asAdmin().collection('presales').doc('ps-hist2').collection('history').doc('h2').update({ details: 'editado' })
    );
  });
});
