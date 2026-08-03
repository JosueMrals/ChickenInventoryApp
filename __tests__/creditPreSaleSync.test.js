/**
 * abonarCredito marca la preventa enlazada como 'paid' con una transacción
 * PROPIA (fuera de la transacción del abono, deliberadamente, para no bloquear
 * el abono por datos legacy de preSaleId) que ahora relee el estado real antes
 * de escribir. Antes era un `.update()` ciego: un abono reproducido desde la
 * cola offline podía reescribir 'paid' sobre una preventa que mientras tanto
 * fue cancelada — el mismo patrón que regresaba facturas cobradas a "pendiente".
 */

const mockState = { docs: {}, writes: [] };

jest.mock('@react-native-firebase/firestore', () => {
  const firestore = () => ({
    collection: () => ({
      doc: (id) => ({ id }),
    }),
    runTransaction: async (fn) => fn({
      get: async (ref) => ({
        ref,
        exists: () => !!mockState.docs[ref.id],
        data: () => mockState.docs[ref.id],
      }),
      update: (ref, payload) => {
        mockState.docs[ref.id] = { ...mockState.docs[ref.id], ...payload };
        mockState.writes.push({ id: ref.id, payload });
      },
    }),
  });
  firestore.FieldValue = {
    serverTimestamp: () => 'ts',
    increment: (n) => n,
    arrayUnion: (v) => [v],
  };
  firestore.Timestamp = { fromDate: (d) => d };
  return firestore;
});

jest.mock('@react-native-firebase/auth', () => () => ({
  currentUser: { uid: 'admin-1', email: 'admin@test.com' },
}));

const creditsService = require('../android/app/src/screens/credits/services/creditsService');

beforeEach(() => {
  mockState.docs = {};
  mockState.writes = [];
});

const creditDoc = (overrides = {}) => ({
  total: 100,
  paid: 0,
  pending: 100,
  status: 'pending',
  payments: [],
  preSaleId: 'ps-1',
  ...overrides,
});

describe('abonarCredito: sincronización de la preventa enlazada', () => {
  test('salda el crédito y marca la preventa como paid cuando el estado lo permite', async () => {
    mockState.docs['cred-1'] = creditDoc();
    mockState.docs['ps-1'] = { status: 'credit_pending' };

    const result = await creditsService.abonarCredito('cred-1', 100, 'admin@test.com');

    expect(result.estado).toBe('paid');
    expect(result.linkedPreSaleUpdated).toBe(true);
    expect(mockState.docs['ps-1'].status).toBe('paid');
  });

  test('reintento idempotente: si el servidor ya la tiene paid, no vuelve a escribir', async () => {
    mockState.docs['cred-1'] = creditDoc();
    mockState.docs['ps-1'] = { status: 'paid', fechaPago: 'ya-estaba' };

    const result = await creditsService.abonarCredito('cred-1', 100, 'admin@test.com');

    expect(result.linkedPreSaleUpdated).toBe(true);
    // No se reescribió: el campo previo sigue intacto y no se registró escritura.
    expect(mockState.docs['ps-1'].fechaPago).toBe('ya-estaba');
    expect(mockState.writes.find((w) => w.id === 'ps-1')).toBeUndefined();
  });

  test('el abono no falla si la preventa ya está en un estado terminal incompatible', async () => {
    mockState.docs['cred-1'] = creditDoc();
    mockState.docs['ps-1'] = { status: 'cancelled' };

    const result = await creditsService.abonarCredito('cred-1', 100, 'admin@test.com');

    // El crédito sí quedó saldado: el fallo del enlace no debe bloquear el abono.
    expect(result.estado).toBe('paid');
    expect(result.linkedPreSaleUpdated).toBe(false);
    expect(mockState.docs['ps-1'].status).toBe('cancelled'); // sin tocar
  });
});
