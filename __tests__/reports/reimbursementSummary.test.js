/**
 * computeReimbursementSummary — agrupación pura de reimbursements
 * (pendientes/pagados, por empleado, por método). FASE E6.2. No suma nada a
 * extExpenses/computeExpenseBreakdown: el gasto económico ya está contado en
 * financials desde la aprobación (E4).
 */
jest.mock('@react-native-firebase/firestore', () => {
  const firestore = () => ({ collection: () => ({}) });
  firestore.Timestamp = { fromDate: (d) => d };
  return firestore;
});

const { computeReimbursementSummary } = require('../../android/app/src/screens/reports/services/reportsService');

const pending = (overrides) => ({ status: 'PENDING', amount: 300, createdByUid: 'u1', ...overrides });
const paid = (overrides) => ({ status: 'PAID', amount: 300, createdByUid: 'u1', paymentMethod: 'CASH', ...overrides });
const cancelled = (overrides) => ({ status: 'CANCELLED', amount: 300, createdByUid: 'u1', ...overrides });

test('lista vacía da un resumen en cero', () => {
  expect(computeReimbursementSummary([])).toEqual({
    pendingCount: 0, pendingTotal: 0, paidCount: 0, paidTotal: 0, byEmployee: {}, byMethod: {},
  });
});

test('cuenta pendientes y pagados por separado', () => {
  const result = computeReimbursementSummary([pending({ amount: 100 }), pending({ amount: 200 }), paid({ amount: 300 })]);
  expect(result.pendingCount).toBe(2);
  expect(result.pendingTotal).toBe(300);
  expect(result.paidCount).toBe(1);
  expect(result.paidTotal).toBe(300);
});

test('CANCELLED no cuenta ni como pendiente ni como pagado', () => {
  const result = computeReimbursementSummary([cancelled(), pending({ amount: 50 })]);
  expect(result.pendingCount).toBe(1);
  expect(result.paidCount).toBe(0);
  expect(result.pendingTotal).toBe(50);
});

test('agrupa por empleado, sumando pendiente y pagado por separado', () => {
  const result = computeReimbursementSummary([
    pending({ createdByUid: 'u1', amount: 100 }),
    paid({ createdByUid: 'u1', amount: 200 }),
    pending({ createdByUid: 'u2', amount: 50 }),
  ]);
  expect(result.byEmployee.u1).toMatchObject({ uid: 'u1', pendingTotal: 100, paidTotal: 200 });
  expect(result.byEmployee.u2).toMatchObject({ uid: 'u2', pendingTotal: 50, paidTotal: 0 });
});

test('agrupa pagados por método', () => {
  const result = computeReimbursementSummary([
    paid({ paymentMethod: 'CASH', amount: 300 }),
    paid({ paymentMethod: 'TRANSFER', amount: 150 }),
    paid({ paymentMethod: 'CASH', amount: 100 }),
  ]);
  expect(result.byMethod).toEqual({ CASH: 400, TRANSFER: 150 });
});

test('un pagado sin paymentMethod cae en UNKNOWN sin romper', () => {
  const result = computeReimbursementSummary([{ status: 'PAID', amount: 50, createdByUid: 'u1' }]);
  expect(result.byMethod).toEqual({ UNKNOWN: 50 });
});
