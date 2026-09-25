/**
 * computeExpenseUsers — lista deduplicada de autores de gastos para el filtro
 * "por usuario" del reporte. FASE E5.1. Pura, sin Firestore.
 */
jest.mock('@react-native-firebase/firestore', () => {
  const firestore = () => ({ collection: () => ({}) });
  firestore.Timestamp = { fromDate: (d) => d };
  return firestore;
});

const { computeExpenseUsers } = require('../../android/app/src/screens/reports/services/reportsService');

const expense = (overrides) => ({
  type: 'expense', amount: 100, category: 'FUEL', paymentMethod: 'CASH',
  createdByUid: 'u1', createdByName: 'Ana Pérez', ...overrides,
});

test('lista vacía sin gastos', () => {
  expect(computeExpenseUsers([])).toEqual([]);
});

test('ignora documentos type=income', () => {
  expect(computeExpenseUsers([{ type: 'income', createdByUid: 'u1' }])).toEqual([]);
});

test('ignora financials sin createdByUid (históricos previos a E5.1)', () => {
  expect(computeExpenseUsers([expense({ createdByUid: undefined, createdByName: null })])).toEqual([]);
});

test('deduplica por uid y ordena por nombre', () => {
  const result = computeExpenseUsers([
    expense({ createdByUid: 'u2', createdByName: 'Zoe Ruiz' }),
    expense({ createdByUid: 'u1', createdByName: 'Ana Pérez' }),
    expense({ createdByUid: 'u1', createdByName: 'Ana Pérez' }),
  ]);
  expect(result).toEqual([
    { uid: 'u1', name: 'Ana Pérez' },
    { uid: 'u2', name: 'Zoe Ruiz' },
  ]);
});

test('sin nombre resuelto, usa el uid como etiqueta', () => {
  const result = computeExpenseUsers([expense({ createdByUid: 'u9', createdByName: null })]);
  expect(result).toEqual([{ uid: 'u9', name: 'u9' }]);
});
