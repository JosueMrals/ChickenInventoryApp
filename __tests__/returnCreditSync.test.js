/**
 * approveReturnRequest debe bajar el crédito junto con la factura.
 * Antes solo actualizaba la pre-venta: el doc de `credits` no se tocaba nunca,
 * así que al cliente se le seguía cobrando la mercadería devuelta. El cálculo
 * está cubierto en returnService.test.js (applyReturnToCredit); aquí se prueba
 * el enganche: que la transacción lea y escriba el crédito de verdad.
 */

const mockState = { docs: {}, writes: [] };

jest.mock('@react-native-firebase/firestore', () => {
  const firestore = () => ({
    collection: (name) => ({
      doc: (id = 'auto') => ({ path: `${name}/${id}`, id }),
      where: () => ({ where: () => ({ get: async () => ({ empty: true }) }) }),
    }),
    runTransaction: async (fn) => fn({
      get: async (ref) => ({
        ref,
        exists: () => !!mockState.docs[ref.path],
        data: () => mockState.docs[ref.path],
      }),
      update: (ref, payload) => {
        mockState.docs[ref.path] = { ...mockState.docs[ref.path], ...payload };
        mockState.writes.push({ path: ref.path, payload });
      },
      set: (ref, payload) => {
        mockState.docs[ref.path] = payload;
        mockState.writes.push({ path: ref.path, payload });
      },
    }),
  });
  firestore.FieldValue = {
    serverTimestamp: () => 'ts',
    increment: (n) => ({ __increment: n }),
  };
  return firestore;
});

jest.mock('@react-native-firebase/auth', () => () => ({
  currentUser: { uid: 'bod-1', email: 'bodega@test.com' },
}));

const { approveReturnRequest } = require('../android/app/src/services/returnService');

// Factura: 10 × C$20 con C$50 de descuento (neto C$15/u) → total C$250.
const presaleDoc = (overrides = {}) => ({
  items: [{ productId: 'p1', productName: 'Pollo entero', quantity: 10, unitPrice: 20, total: 150 }],
  bonuses: [],
  subtotal: 200,
  total: 150,
  totalDiscount: 50,
  status: 'credit_dispatched',
  creditId: 'cred-1',
  ...overrides,
});

const returnRequest = {
  presaleId: 'ps-1',
  items: [{ productId: 'p1', productName: 'Pollo entero', quantity: 4, unitPrice: 20 }],
  bonuses: [],
};

const writesTo = (path) => mockState.writes.filter((w) => w.path === path);

beforeEach(() => {
  mockState.docs = {
    'returnRequests/ret-1': { status: 'pending_review' },
    'products/p1': { stock: 0 },
    'presales/ps-1': presaleDoc(),
  };
  mockState.writes = [];
});

test('la devolución baja el crédito junto con la factura', () => {
  mockState.docs['credits/cred-1'] = { total: 150, paid: 0, pending: 150, status: 'pending' };

  return approveReturnRequest({ returnRequestId: 'ret-1', returnRequest }).then(() => {
    // 4 de 10 unidades a neto C$15 → salen C$60 de C$150.
    expect(mockState.docs['presales/ps-1'].total).toBe(90);
    // El crédito tiene que seguir a la factura, no quedarse en 150.
    expect(mockState.docs['credits/cred-1']).toMatchObject({
      total: 90,
      pending: 90,
      paid: 0,
      status: 'pending',
    });
  });
});

test('respeta los abonos ya cobrados: solo baja lo pendiente', async () => {
  mockState.docs['credits/cred-1'] = { total: 150, paid: 60, pending: 90, status: 'pending' };

  await approveReturnRequest({ returnRequestId: 'ret-1', returnRequest });

  expect(mockState.docs['credits/cred-1']).toMatchObject({ total: 90, pending: 30, paid: 60 });
});

test('venta de contado (sin creditId): no se escribe ningún crédito', async () => {
  mockState.docs['presales/ps-1'] = presaleDoc({ creditId: undefined, status: 'dispatched' });
  mockState.docs['credits/cred-1'] = { total: 150, paid: 0, pending: 150, status: 'pending' };

  await approveReturnRequest({ returnRequestId: 'ret-1', returnRequest });

  expect(writesTo('credits/cred-1')).toHaveLength(0);
  expect(mockState.docs['credits/cred-1'].total).toBe(150); // intacto
});

test('creditId que ya no existe: la devolución no se cae', async () => {
  // El crédito fue eliminado (admin) pero la pre-venta conserva el creditId.
  await approveReturnRequest({ returnRequestId: 'ret-1', returnRequest });

  expect(writesTo('credits/cred-1')).toHaveLength(0);
  expect(mockState.docs['presales/ps-1'].total).toBe(90);
  expect(mockState.docs['returnRequests/ret-1'].status).toBe('approved');
});

test('una solicitud ya resuelta no vuelve a tocar el crédito', async () => {
  mockState.docs['returnRequests/ret-1'] = { status: 'approved' };
  mockState.docs['credits/cred-1'] = { total: 150, paid: 0, pending: 150, status: 'pending' };

  await expect(
    approveReturnRequest({ returnRequestId: 'ret-1', returnRequest })
  ).rejects.toThrow(/ya fue aprobada/);

  expect(writesTo('credits/cred-1')).toHaveLength(0);
});
