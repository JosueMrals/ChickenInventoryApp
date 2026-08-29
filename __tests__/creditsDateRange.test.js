/**
 * Filtro de fechas de la pantalla de Créditos.
 *
 * El rango va al query, no al cliente: la lista está acotada a 100 documentos,
 * así que filtrar la fecha en JS mostraría "no hay créditos en marzo" cuando en
 * realidad marzo no entró en la página descargada. Y los totales del encabezado
 * —que son dinero— tienen que quedar acotados al mismo rango que la lista.
 */

const mockState = { aggregates: [], queries: [] };

const makeQuery = (name, filters = [], meta = {}) => ({
  __name: name,
  __filters: filters,
  __meta: meta,
  where: (field, op, value) => makeQuery(name, [...filters, { field, op, value }], meta),
  orderBy: (field, dir) => makeQuery(name, filters, { ...meta, orderBy: [field, dir] }),
  limit: (n) => makeQuery(name, filters, { ...meta, limit: n }),
  onSnapshot: (onNext) => {
    mockState.queries.push({ filters, meta });
    onNext({ docs: [] });
    return () => {};
  },
});

const firestoreMock = () => ({ collection: (name) => makeQuery(name) });
firestoreMock.Timestamp = { fromDate: (d) => d };
firestoreMock.FieldValue = { serverTimestamp: () => 'ts', arrayUnion: (v) => [v] };

jest.mock('@react-native-firebase/firestore', () => ({
  __esModule: true,
  default: firestoreMock,
  sum: (field) => ({ __sum: field }),
  count: () => ({ __count: true }),
  getAggregateFromServer: async (query) => {
    mockState.aggregates.push(query.__filters);
    return { data: () => ({ value: 100, docs: 3 }) };
  },
}));

jest.mock('@react-native-firebase/auth', () => () => ({ currentUser: null }));

jest.mock('../android/app/src/services/firebaseConfig', () => ({
  firestore: firestoreMock,
  auth: () => ({ currentUser: null }),
}));

jest.mock('../android/app/src/services/errorMonitoring', () => ({ captureError: jest.fn() }));

const { fetchCredits, getCreditTotals } = require('../android/app/src/screens/credits/services/creditsService');

// Fechas fijas: anclar a `Date.now()` hace fallar la suite cerca de medianoche.
const FROM = new Date(2026, 0, 15, 13, 30);
const TO = new Date(2026, 0, 20, 9, 5);

const findFilter = (filters, op) => filters.find((f) => f.field === 'createdAt' && f.op === op);

beforeEach(() => {
  mockState.aggregates = [];
  mockState.queries = [];
});

test('el rango va al query y se normaliza a días completos', () => {
  fetchCredits(() => {}, { status: 'pending', from: FROM, to: TO });

  const { filters, meta } = mockState.queries[0];
  expect(filters).toContainEqual({ field: 'status', op: '==', value: 'pending' });

  // Sin normalizar, "hasta el 20" cortaba a las 00:00 y dejaba fuera todo ese día.
  expect(findFilter(filters, '>=').value).toEqual(new Date(2026, 0, 15, 0, 0, 0, 0));
  expect(findFilter(filters, '<=').value).toEqual(new Date(2026, 0, 20, 23, 59, 59, 999));

  // El índice (status ASC, createdAt DESC) exige este orden.
  expect(meta.orderBy).toEqual(['createdAt', 'desc']);
});

test('sin rango el query no lleva filtros de fecha', () => {
  fetchCredits(() => {}, { status: 'paid' });

  const { filters } = mockState.queries[0];
  expect(filters.filter((f) => f.field === 'createdAt')).toHaveLength(0);
});

test('un extremo suelto acota solo por ese lado', () => {
  fetchCredits(() => {}, { from: FROM });

  const { filters } = mockState.queries[0];
  expect(findFilter(filters, '>=')).toBeTruthy();
  expect(findFilter(filters, '<=')).toBeUndefined();
});

test('los totales quedan acotados al mismo rango que la lista', async () => {
  const totals = await getCreditTotals({ from: FROM, to: TO });

  // Un agregado por estado, ambos con el rango aplicado: si solo lo llevara uno,
  // el encabezado sumaría cobrado de una semana contra pendiente de toda la cartera.
  expect(mockState.aggregates).toHaveLength(2);
  mockState.aggregates.forEach((filters) => {
    expect(findFilter(filters, '>=')).toBeTruthy();
    expect(findFilter(filters, '<=')).toBeTruthy();
  });

  // Los contadores de los filtros salen del servidor: la lista descargada ya
  // viene filtrada por estado y el estado inactivo siempre contaría 0.
  expect(totals).toEqual({ paid: 100, pending: 100, countPaid: 3, countPending: 3 });
});
