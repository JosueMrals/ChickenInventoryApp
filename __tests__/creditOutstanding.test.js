/**
 * getCustomerOutstandingCredit: deuda vigente del cliente, base del control de
 * sobregiro acumulado. Antes no existía y el límite se comparaba solo contra el
 * total de la venta en curso, así que el tope se podía superar tantas veces como
 * facturas distintas se le hicieran al mismo cliente.
 */

const mockState = { sum: 0, docs: {}, fail: false, queries: [] };

// Constructor de refs encadenables compartido por ambos mocks de firestore.
const makeCollection = (name) => {
  const build = (filters) => ({
    __name: name,
    __filters: filters,
    where: (field, op, value) => build([...filters, { field, op, value }]),
    doc: (id) => ({
      id,
      get: async () => ({
        exists: () => !!mockState.docs[id],
        data: () => mockState.docs[id],
      }),
    }),
  });
  return build([]);
};

// preSaleService (importado en cadena por creditsService) llama a
// firestore().collection() al cargar el módulo, así que el default debe servir.
jest.mock('@react-native-firebase/firestore', () => {
  const firestore = () => ({ collection: makeCollection });
  firestore.Timestamp = { fromDate: (d) => d };
  firestore.FieldValue = { serverTimestamp: () => 'ts', arrayUnion: (v) => [v] };
  return {
    __esModule: true,
    default: firestore,
    sum: (field) => ({ __sum: field }),
    getAggregateFromServer: async (query) => {
      if (mockState.fail) throw new Error('offline');
      mockState.queries.push(query.__filters);
      return { data: () => ({ value: mockState.sum }) };
    },
  };
});

jest.mock('@react-native-firebase/auth', () => () => ({ currentUser: null }));

jest.mock('../android/app/src/services/firebaseConfig', () => {
  const firestore = () => ({ collection: makeCollection });
  firestore.Timestamp = { fromDate: (d) => d };
  firestore.FieldValue = { serverTimestamp: () => 'ts', arrayUnion: (v) => [v] };
  return { firestore, auth: () => ({ currentUser: null }) };
});

jest.mock('../android/app/src/services/errorMonitoring', () => ({ captureError: jest.fn() }));

const { getCustomerOutstandingCredit } = require('../android/app/src/screens/credits/services/creditsService');

beforeEach(() => {
  mockState.sum = 0;
  mockState.docs = {};
  mockState.fail = false;
  mockState.queries = [];
});

test('suma lo pendiente de los créditos vigentes del cliente', async () => {
  mockState.sum = 950;

  await expect(getCustomerOutstandingCredit('cli-1')).resolves.toBe(950);
  // Debe filtrar por cliente Y por estado: sumar los ya pagados inflaría la deuda.
  expect(mockState.queries[0]).toEqual([
    { field: 'customerId', op: '==', value: 'cli-1' },
    { field: 'status', op: '==', value: 'pending' },
  ]);
});

test('sin cliente no hay deuda que consultar', async () => {
  await expect(getCustomerOutstandingCredit(null)).resolves.toBe(0);
  expect(mockState.queries).toHaveLength(0);
});

test('al editar, excluye el crédito de la propia preventa', async () => {
  // Sin excluirlo se contaría dos veces y bloquearía cualquier edición.
  mockState.sum = 950;
  mockState.docs['cred-propio'] = { status: 'pending', pending: 400 };

  await expect(getCustomerOutstandingCredit('cli-1', { excludeCreditId: 'cred-propio' }))
    .resolves.toBe(550);
});

test('un crédito ya saldado no se resta al excluirlo', async () => {
  // Si ya está 'paid' no entró en la suma; restarlo daría una deuda de menos.
  mockState.sum = 950;
  mockState.docs['cred-propio'] = { status: 'paid', pending: 0 };

  await expect(getCustomerOutstandingCredit('cli-1', { excludeCreditId: 'cred-propio' }))
    .resolves.toBe(950);
});

test('excluir un crédito inexistente no altera la suma', async () => {
  mockState.sum = 300;

  await expect(getCustomerOutstandingCredit('cli-1', { excludeCreditId: 'no-existe' }))
    .resolves.toBe(300);
});

test('nunca devuelve negativo', async () => {
  mockState.sum = 100;
  mockState.docs['cred-propio'] = { status: 'pending', pending: 999 };

  await expect(getCustomerOutstandingCredit('cli-1', { excludeCreditId: 'cred-propio' }))
    .resolves.toBe(0);
});

test('si el agregado falla devuelve null, no 0', async () => {
  // 0 significaría "no debe nada" y autorizaría crédito a un cliente sobregirado.
  mockState.fail = true;

  await expect(getCustomerOutstandingCredit('cli-1')).resolves.toBeNull();
});
