/**
 * computeExpenseBreakdown — agrupación pura de gastos operativos (financials
 * tipo 'expense') por categoría y método de pago. FASE E5.
 */
jest.mock('@react-native-firebase/firestore', () => {
  const firestore = () => ({ collection: () => ({}) });
  firestore.Timestamp = { fromDate: (d) => d };
  return firestore;
});

const { computeExpenseBreakdown } = require('../../android/app/src/screens/reports/services/reportsService');

const expense = (overrides) => ({ type: 'expense', amount: 100, category: 'FUEL', paymentMethod: 'CASH', ...overrides });
const income = (overrides) => ({ type: 'income', amount: 500, ...overrides });

test('lista vacía da un desglose en cero', () => {
  expect(computeExpenseBreakdown([])).toEqual({ total: 0, count: 0, byCategory: {}, byPaymentMethod: {} });
});

test('ignora los documentos type=income', () => {
  const result = computeExpenseBreakdown([income(), expense({ amount: 200 })]);
  expect(result.total).toBe(200);
  expect(result.count).toBe(1);
});

test('agrupa por categoría', () => {
  const result = computeExpenseBreakdown([
    expense({ category: 'FUEL', amount: 500 }),
    expense({ category: 'FUEL', amount: 300 }),
    expense({ category: 'FOOD', amount: 100 }),
  ]);
  expect(result.byCategory).toEqual({ FUEL: 800, FOOD: 100 });
  expect(result.total).toBe(900);
  expect(result.count).toBe(3);
});

test('agrupa por método de pago', () => {
  const result = computeExpenseBreakdown([
    expense({ paymentMethod: 'CASH', amount: 500 }),
    expense({ paymentMethod: 'PERSONAL', amount: 300 }),
    expense({ paymentMethod: 'CASH', amount: 200 }),
  ]);
  expect(result.byPaymentMethod).toEqual({ CASH: 700, PERSONAL: 300 });
});

test('la suma de byCategory y de byPaymentMethod siempre coincide con total (nunca se cuenta dos veces)', () => {
  const docs = [
    expense({ category: 'FUEL', paymentMethod: 'CASH', amount: 500 }),
    expense({ category: 'FOOD', paymentMethod: 'PERSONAL', amount: 300 }),
    expense({ category: 'TOLL', paymentMethod: 'CARD', amount: 100 }),
    income({ amount: 9999 }), // no debe contarse en ningún lado
  ];
  const result = computeExpenseBreakdown(docs);
  const sumCategory = Object.values(result.byCategory).reduce((a, b) => a + b, 0);
  const sumMethod = Object.values(result.byPaymentMethod).reduce((a, b) => a + b, 0);
  expect(sumCategory).toBe(result.total);
  expect(sumMethod).toBe(result.total);
  expect(result.total).toBe(900);
});

test('un financial sin category/paymentMethod cae en OTHER/UNKNOWN sin romper', () => {
  const result = computeExpenseBreakdown([{ type: 'expense', amount: 50 }]);
  expect(result.byCategory).toEqual({ OTHER: 50 });
  expect(result.byPaymentMethod).toEqual({ UNKNOWN: 50 });
});
