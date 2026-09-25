/**
 * FASE S1.5.1 — regresión permanente de `returnRequests` (create/update/delete).
 * Endurece `create`/`update` con `hasOnly()` sobre los campos reales de
 * `returnService.js` (createReturnRequest/updateReturnRequest/
 * approveReturnRequest/rejectReturnRequest) y cierra S1.5-F3 (entregador ya
 * no puede resolver una devolución). Ver
 * `audit-reports/fase-s1-5-0-return-requests-audit.md` y
 * `fase-s1-5-1-return-requests-security-implementation.md`.
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
    projectId: 'chickeninventoryapp-emulator-test-return-requests-rules',
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

const seedReturnRequest = async (id, data) => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('returnRequests').doc(id).set(data);
  });
};

const createPayload = (requestedByUid, overrides = {}) => ({
  presaleId: 'ps-1', routeId: 'route-1', routeName: 'Ruta 1', entregadorId: 'entregador-y',
  status: 'pending_review', reason: 'Producto dañado',
  requestedBy: `${requestedByUid}@test.com`, requestedByUid, requestedByRole: 'vendedor',
  requestedAt: new Date(), customerName: 'Juan Pérez', saleTotal: 100,
  items: [{ productId: 'p1', productName: 'Pollo', quantity: 2, unitPrice: 50, total: 100 }], bonuses: [],
  confirmedBy: null, confirmedAt: null, rejectedBy: null, rejectionNote: null,
  ...overrides,
});

const baseReturnRequest = (overrides = {}) => ({
  presaleId: 'ps-1', routeId: 'route-1', routeName: 'Ruta 1', entregadorId: 'entregador-y',
  status: 'pending_review', reason: 'Producto dañado',
  requestedBy: 'vendedor-x@test.com', requestedByUid: 'vendedor-x', requestedByRole: 'vendedor',
  requestedAt: new Date(), customerName: 'Juan Pérez', saleTotal: 100,
  items: [{ productId: 'p1', productName: 'Pollo', quantity: 2, unitPrice: 50, total: 100 }], bonuses: [],
  confirmedBy: null, confirmedAt: null, rejectedBy: null, rejectionNote: null,
  ...overrides,
});

// ── create ───────────────────────────────────────────────────────────────────
describe('S1.5.1 — returnRequests.create', () => {
  test('1. admin crea una solicitud con payload real → PASS', async () => {
    await assertSucceeds(asAdmin('admin-1').collection('returnRequests').doc('r1').set(createPayload('admin-1')));
  });

  test('2. vendedor crea una solicitud con payload real → PASS', async () => {
    await assertSucceeds(asVendedor('vendedor-x').collection('returnRequests').doc('r2').set(createPayload('vendedor-x')));
  });

  test('3. entregador crea una solicitud con payload real → PASS', async () => {
    await assertSucceeds(asEntregador('entregador-x').collection('returnRequests').doc('r3').set(createPayload('entregador-x')));
  });

  test('4. bodeguero NO puede crear una solicitud → DENIED', async () => {
    await assertFails(asBodeguero('bodeguero-x').collection('returnRequests').doc('r4').set(createPayload('bodeguero-x')));
  });

  test('5. requestedByUid falso (uid de otro usuario) → DENIED', async () => {
    await assertFails(
      asVendedor('vendedor-x').collection('returnRequests').doc('r5').set(createPayload('otro-uid'))
    );
  });

  test('6. campo no autorizado fuera del shape real → DENIED', async () => {
    await assertFails(
      asVendedor('vendedor-x').collection('returnRequests').doc('r6').set({
        ...createPayload('vendedor-x'), discountCode: 'PROMO',
      })
    );
  });
});

// ── update ───────────────────────────────────────────────────────────────────
describe('S1.5.1 — returnRequests.update', () => {
  test('7. el solicitante corrige reason/items mientras pending_review → PASS', async () => {
    await seedReturnRequest('r7', baseReturnRequest());
    await assertSucceeds(
      asVendedor('vendedor-x').collection('returnRequests').doc('r7').update({
        reason: 'Motivo corregido',
        items: [{ productId: 'p1', productName: 'Pollo', quantity: 1, unitPrice: 50, total: 50 }],
        bonuses: [],
        updatedAt: new Date(),
      })
    );
  });

  test('8. otro usuario (no el solicitante) intenta editar la solicitud → DENIED', async () => {
    await seedReturnRequest('r8', baseReturnRequest());
    await assertFails(
      asVendedor('otro-vendedor').collection('returnRequests').doc('r8').update({
        reason: 'Motivo alterado', items: [], bonuses: [], updatedAt: new Date(),
      })
    );
  });

  test('9. el solicitante intenta cambiar status (fuera de su rama) → DENIED', async () => {
    await seedReturnRequest('r9', baseReturnRequest());
    await assertFails(
      asVendedor('vendedor-x').collection('returnRequests').doc('r9').update({
        reason: 'Motivo', items: [], bonuses: [], status: 'approved', updatedAt: new Date(),
      })
    );
  });

  test('10. el solicitante intenta cambiar requestedByUid (adueñarse de otra solicitud) → DENIED', async () => {
    await seedReturnRequest('r10', baseReturnRequest());
    await assertFails(
      asVendedor('vendedor-x').collection('returnRequests').doc('r10').update({
        reason: 'Motivo', items: [], bonuses: [], requestedByUid: 'otro-uid', updatedAt: new Date(),
      })
    );
  });

  test('11. entregador intenta aprobar (S1.5-F3) → DENIED', async () => {
    await seedReturnRequest('r11', baseReturnRequest());
    await assertFails(
      asEntregador('entregador-x').collection('returnRequests').doc('r11').update({
        status: 'approved', confirmedBy: 'entregador-x@test.com', confirmedAt: new Date(),
        verifiedItems: [], hasShortages: false,
      })
    );
  });

  test('12. vendedor intenta aprobar → DENIED', async () => {
    await seedReturnRequest('r12', baseReturnRequest());
    await assertFails(
      asVendedor('vendedor-x').collection('returnRequests').doc('r12').update({
        status: 'approved', confirmedBy: 'vendedor-x@test.com', confirmedAt: new Date(),
        verifiedItems: [], hasShortages: false,
      })
    );
  });

  test('13. bodeguero aprueba una solicitud pending_review → PASS', async () => {
    await seedReturnRequest('r13', baseReturnRequest());
    await assertSucceeds(
      asBodeguero('bodeguero-x').collection('returnRequests').doc('r13').update({
        status: 'approved', confirmedBy: 'bodeguero-x@test.com', confirmedAt: new Date(),
        verifiedItems: [{ productId: 'p1', productName: 'Pollo', isBonus: false, expectedQty: 2, receivedQty: 2, missingQty: 0 }],
        hasShortages: false,
      })
    );
  });

  test('14. admin aprueba una solicitud pending_review → PASS', async () => {
    await seedReturnRequest('r14', baseReturnRequest());
    await assertSucceeds(
      asAdmin('admin-1').collection('returnRequests').doc('r14').update({
        status: 'rejected', rejectedBy: 'admin-1@test.com', rejectedAt: new Date(), rejectionNote: 'No corresponde',
      })
    );
  });

  test('15. nadie puede modificar una solicitud ya approved', async () => {
    await seedReturnRequest('r15', baseReturnRequest({ status: 'approved' }));
    await assertFails(
      asBodeguero('bodeguero-x').collection('returnRequests').doc('r15').update({
        status: 'rejected', rejectedBy: 'bodeguero-x@test.com', rejectedAt: new Date(), rejectionNote: 'x',
      })
    );
    await assertFails(
      asVendedor('vendedor-x').collection('returnRequests').doc('r15').update({
        reason: 'Motivo', items: [], bonuses: [], updatedAt: new Date(),
      })
    );
  });

  test('16. nadie puede modificar una solicitud ya rejected', async () => {
    await seedReturnRequest('r16', baseReturnRequest({ status: 'rejected' }));
    await assertFails(
      asAdmin('admin-1').collection('returnRequests').doc('r16').update({
        status: 'approved', confirmedBy: 'admin-1@test.com', confirmedAt: new Date(),
        verifiedItems: [], hasShortages: false,
      })
    );
    await assertFails(
      asVendedor('vendedor-x').collection('returnRequests').doc('r16').update({
        reason: 'Motivo', items: [], bonuses: [], updatedAt: new Date(),
      })
    );
  });
});

// ── delete ───────────────────────────────────────────────────────────────────
describe('S1.5.1 — returnRequests.delete', () => {
  test('17. el dueño elimina su solicitud pending_review → PASS', async () => {
    await seedReturnRequest('r17', baseReturnRequest());
    await assertSucceeds(asVendedor('vendedor-x').collection('returnRequests').doc('r17').delete());
  });

  test('18. el dueño NO puede eliminar una solicitud ya approved', async () => {
    await seedReturnRequest('r18', baseReturnRequest({ status: 'approved' }));
    await assertFails(asVendedor('vendedor-x').collection('returnRequests').doc('r18').delete());
  });

  test('19. el dueño NO puede eliminar una solicitud ya rejected', async () => {
    await seedReturnRequest('r19', baseReturnRequest({ status: 'rejected' }));
    await assertFails(asVendedor('vendedor-x').collection('returnRequests').doc('r19').delete());
  });

  test('20. admin puede eliminar cualquier solicitud, incluso ya resuelta (regla actual, sin cambios)', async () => {
    await seedReturnRequest('r20', baseReturnRequest({ status: 'approved' }));
    await assertSucceeds(asAdmin('admin-1').collection('returnRequests').doc('r20').delete());
  });
});
