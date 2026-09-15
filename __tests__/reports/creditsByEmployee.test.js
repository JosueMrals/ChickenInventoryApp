/**
 * getSalesSummaryOptimized — detalle de crédito por vendedor ("Cobrado en el período").
 *
 * Regresión: `collectedToDate` sumaba abonos solo de créditos CREADOS dentro del
 * rango. Un crédito originado antes de `from` pero abonado dentro del rango
 * quedaba fuera por completo, subestimando lo realmente cobrado en el período.
 */

const mockState = { sales: [], credits: [] };

jest.mock('@react-native-firebase/firestore', () => {
  const snapOf = (docs) => ({
    forEach: (fn) => docs.forEach((d) => fn({ id: d.id, data: () => d.data })),
    docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
    empty: docs.length === 0,
  });

  const makeQuery = (name) => {
    const q = {
      where: () => q,
      orderBy: () => q,
      limit: () => q,
      startAfter: () => q,
      get: async () => {
        if (name === 'sales') return snapOf(mockState.sales);
        if (name === 'credits') return snapOf(mockState.credits);
        return snapOf([]);
      },
    };
    return q;
  };

  const firestore = () => ({ collection: (name) => makeQuery(name) });
  firestore.FieldPath = { documentId: () => '__name__' };
  firestore.Timestamp = { fromDate: (d) => d };
  return firestore;
});

const {
  getSalesSummaryOptimized,
  clearAllReportsCaches,
} = require('../../android/app/src/screens/reports/services/reportsService');

const venta = (id, date, total) => ({
  id,
  data: { createdAt: { toDate: () => date }, total, items: [], createdBy: 'ana@test.com' },
});

beforeEach(() => {
  mockState.sales = [];
  mockState.credits = [];
  clearAllReportsCaches();
});

describe('getSalesSummaryOptimized: crédito por vendedor', () => {
  it('cuenta un abono del período aunque el crédito se haya creado antes del rango', async () => {
    const from = new Date(2026, 6, 1);
    const to = new Date(2026, 6, 31, 23, 59, 59);

    mockState.sales = [venta('s1', new Date(2026, 6, 10, 9, 0), 100)];
    mockState.credits = [{
      id: 'c1',
      data: {
        createdAt: { toDate: () => new Date(2026, 5, 15) }, // creado en junio, fuera del rango
        createdBy: 'ana@test.com',
        status: 'pending',
        total: 500,
        pending: 200,
        payments: [
          { amount: 300, date: { toDate: () => new Date(2026, 6, 20) } }, // abonado en julio
        ],
      },
    }];

    const r = await getSalesSummaryOptimized({ from, to });
    const ana = r.salesByEmployee.find((e) => e.id === 'ana@test.com');

    expect(ana.collectedToDate).toBe(300);
    // El crédito no se originó en el rango: no debe sumar a creditPending/creditPaid.
    expect(ana.creditPending || 0).toBe(0);
  });

  it('no cuenta un abono fuera del rango', async () => {
    const from = new Date(2026, 6, 1);
    const to = new Date(2026, 6, 31, 23, 59, 59);

    mockState.sales = [venta('s1', new Date(2026, 6, 10, 9, 0), 100)];
    mockState.credits = [{
      id: 'c1',
      data: {
        createdAt: { toDate: () => new Date(2026, 6, 5) },
        createdBy: 'ana@test.com',
        status: 'pending',
        total: 500,
        pending: 500,
        payments: [
          { amount: 300, date: { toDate: () => new Date(2026, 7, 5) } }, // agosto, fuera de rango
        ],
      },
    }];

    const r = await getSalesSummaryOptimized({ from, to });
    const ana = r.salesByEmployee.find((e) => e.id === 'ana@test.com');

    expect(ana.collectedToDate || 0).toBe(0);
    expect(ana.creditPending).toBe(500);
  });
});
