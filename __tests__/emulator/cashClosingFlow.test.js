/**
 * FASE CC1 — escenario funcional completo de Cierre de Caja contra el
 * Emulator real: el mismo problema reportado (admin veía C$0.00 mientras los
 * gastos sí aparecían) reproducido de punta a punta.
 *
 * Las QUERIES son literalmente las de subscribeMyUnclaimedCollections
 * (cashClosingService.js) y subscribeMyEligibleCashExpenses
 * (expenseService.js), corriendo contra las reglas reales — lo que se valida
 * es la lectura que alimenta la pantalla, no una simulación de su resultado.
 * Las ESCRITURAS replican las de los writers reales (no se puede invocar
 * @react-native-firebase bajo Jest; ver quickSaleConcurrency.test.js).
 */
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, collection, getDocs, setDoc, query, where } = require('firebase/firestore');

const RULES_PATH = path.resolve(__dirname, '../../firebase/firestore.rules');
const ADMIN = 'admin-1';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'chickeninventoryapp-emulator-test-cash-flow',
    firestore: {
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => { if (testEnv) await testEnv.cleanup(); });
afterEach(async () => { if (testEnv) await testEnv.clearFirestore(); });

const asAdmin = () => testEnv.authenticatedContext(ADMIN, { role: 'admin' }).firestore();
const asVendedor = (uid = 'vendedor-x') => testEnv.authenticatedContext(uid, { role: 'vendedor' }).firestore();

const sum = (docs) => Number(docs.reduce((t, d) => t + Number(d.data().amount || 0), 0).toFixed(2));

/** Query real de subscribeMyUnclaimedCollections. */
const ingresosDe = async (db, uid) => sum((await getDocs(query(
  collection(db, 'cashCollections'),
  where('uid', '==', uid),
  where('turnoId', '==', null),
))).docs);

/** Query real de subscribeMyEligibleCashExpenses (status se filtra en cliente). */
const egresosDe = async (db, uid) => sum((await getDocs(query(
  collection(db, 'expenses'),
  where('createdByUid', '==', uid),
  where('paymentMethod', '==', 'CASH'),
  where('cashClosingId', '==', null),
))).docs.filter((d) => ['PENDING', 'APPROVED'].includes(d.data().status)));

const netoDe = async (db, uid) =>
  Number(((await ingresosDe(db, uid)) - (await egresosDe(db, uid))).toFixed(2));

const abono = (db, uid, id, amount) => setDoc(doc(db, 'cashCollections', id), {
  uid, userName: `${uid}@test.com`, amount, method: null, sourceType: 'creditAbono',
  sourceId: 'cred-1', customerName: 'Juan Pérez', at: new Date(), turnoId: null,
});

const cobroPreventa = (db, uid, preSaleId, amount) =>
  setDoc(doc(db, 'cashCollections', `presale-${preSaleId}`), {
    uid, userName: `${uid}@test.com`, amount, method: null, sourceType: 'presale',
    sourceId: preSaleId, customerName: 'Juan Pérez', at: new Date(), turnoId: null,
  });

const gastoCash = (db, uid, id, amount) => setDoc(doc(db, 'expenses', id), {
  amount, category: 'FUEL', description: null, paymentMethod: 'CASH', status: 'PENDING',
  createdByUid: uid, createdAt: new Date(),
  receipt: { url: 'https://x/r.jpg', path: 'expenseReceipts/r.jpg', uploadedAt: new Date() },
  cashClosingId: null, routeId: null, reviewedByUid: null, reviewedAt: null, reimbursement: null,
});

const contarCajas = async (uid) => {
  let n = 0;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    n = (await getDocs(query(collection(ctx.firestore(), 'cashClosings'), where('uid', '==', uid)))).size;
  });
  return n;
};

describe('CC1 — escenario funcional del admin (el C$0.00 reportado)', () => {
  test('1-5: abono, segundo abono, gasto, preventa sin cobro y cobro real', async () => {
    const db = asAdmin();

    // Escenario 1 — usuario sin caja: abono C$500 → ingresos 500, neto +500.
    await assertSucceeds(abono(db, ADMIN, 'cc-1', 500));
    expect(await ingresosDe(db, ADMIN)).toBe(500);
    expect(await netoDe(db, ADMIN)).toBe(500);

    // Escenario 2 — mismo usuario, abono C$300 → neto +800.
    await assertSucceeds(abono(db, ADMIN, 'cc-2', 300));
    expect(await netoDe(db, ADMIN)).toBe(800);

    // Escenario 3 — gasto C$100 → ingresos 800, egresos 100, neto 700.
    await assertSucceeds(gastoCash(db, ADMIN, 'g-1', 100));
    expect(await ingresosDe(db, ADMIN)).toBe(800);
    expect(await egresosDe(db, ADMIN)).toBe(100);
    expect(await netoDe(db, ADMIN)).toBe(700);

    // Escenario 4 — crear una preventa NO es movimiento monetario.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'presales', 'ps-9'), {
        status: 'pending', total: 400, createdBy: `${ADMIN}@test.com`,
      });
    });
    expect(await netoDe(db, ADMIN)).toBe(700);
    expect(await contarCajas(ADMIN)).toBe(0);

    // Escenario 5 — el pago real de esa preventa SÍ mueve dinero: neto 900.
    await assertSucceeds(cobroPreventa(db, ADMIN, 'ps-9', 200));
    expect(await netoDe(db, ADMIN)).toBe(900);
  });

  test('un reintento no duplica ni reescribe el cobro (id determinístico + cobro inmutable)', async () => {
    const db = asAdmin();
    await assertSucceeds(cobroPreventa(db, ADMIN, 'ps-9', 200));

    // El id es `presale-{preSaleId}`, el mismo que usa el cobro en entrega
    // (completePreSalePayment): los dos caminos no pueden sumar dos veces la
    // misma preventa. Y un segundo intento ni siquiera puede reescribirlo —
    // las reglas solo dejan tocar `turnoId` (el reclamo del turno).
    await assertFails(cobroPreventa(db, ADMIN, 'ps-9', 200));

    expect(await ingresosDe(db, ADMIN)).toBe(200);
  });

  test('un cobro ya reclamado por un turno deja de contar en la caja abierta', async () => {
    const db = asAdmin();
    await assertSucceeds(abono(db, ADMIN, 'cc-1', 500));
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'cashCollections', 'cc-1'), { turnoId: 'turno-viejo' }, { merge: true });
    });
    expect(await ingresosDe(db, ADMIN)).toBe(0);
  });
});

describe('CC1 — aislamiento por usuario', () => {
  test('el movimiento del usuario A no aparece en la caja del usuario B', async () => {
    await assertSucceeds(abono(asAdmin(), ADMIN, 'cc-a', 500));
    await assertSucceeds(gastoCash(asAdmin(), ADMIN, 'g-a', 100));
    await assertSucceeds(abono(asVendedor(), 'vendedor-x', 'cc-b', 700));

    expect(await netoDe(asAdmin(), ADMIN)).toBe(400);
    expect(await netoDe(asVendedor(), 'vendedor-x')).toBe(700);
  });

  test('el admin no ve los cobros ajenos dentro de SU caja (revisa turnos, no los suma)', async () => {
    await assertSucceeds(abono(asVendedor(), 'vendedor-x', 'cc-b', 700));
    expect(await ingresosDe(asAdmin(), ADMIN)).toBe(0);
  });
});
