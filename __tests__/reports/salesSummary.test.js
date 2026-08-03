/**
 * Resumen de ventas del módulo de reportes.
 *
 * Dos regresiones que fija esta suite:
 *
 * 1. El resumen NO devolvía `timeseries`. El panel de Ventas mostraba sus KPIs y
 *    su gráfica solo `if (timeseries.length > 0)`, así que esa cabecera entera
 *    —ingresos, ganancia, ventas, promedio y tendencia— no se pintaba nunca.
 *
 * 2. La serie diaria se agrupaba con `toISOString().slice(0,10)`, que es el día
 *    en UTC. Nicaragua está en UTC-6: toda venta desde las 18:00 se contaba en
 *    el día siguiente y el reporte diario salía corrido.
 */

const mockState = { sales: [], presales: [], products: {} };

jest.mock('@react-native-firebase/firestore', () => {
  // Definido dentro del factory: jest lo eleva por encima de los imports y no
  // permite referenciar variables externas (salvo las que empiezan con `mock`).
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
        if (name === 'presales') return snapOf(mockState.presales);
        if (name === 'products') {
          return snapOf(
            Object.keys(mockState.products).map((id) => ({ id, data: mockState.products[id] })),
          );
        }
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

/** Documento de venta con `createdAt` estilo Timestamp de Firestore. */
const venta = (id, date, total, items = []) => ({
  id,
  data: { createdAt: { toDate: () => date }, total, items, createdBy: 'ana@test.com' },
});

beforeEach(() => {
  mockState.sales = [];
  mockState.presales = [];
  mockState.products = {};
  clearAllReportsCaches();
});

describe('getSalesSummaryOptimized: serie diaria', () => {
  it('devuelve `timeseries` — sin ella el panel de Ventas no pinta nada', async () => {
    mockState.sales = [venta('s1', new Date(2026, 6, 10, 9, 0), 100)];

    const r = await getSalesSummaryOptimized({ from: null, to: null });

    expect(Array.isArray(r.timeseries)).toBe(true);
    expect(r.timeseries).toHaveLength(1);
    expect(r.timeseries[0]).toMatchObject({ date: '2026-07-10', income: 100, count: 1 });
  });

  it('agrupa por día local: una venta nocturna NO se corre al día siguiente', async () => {
    // 21:00 hora local. En UTC-6 eso son las 03:00 UTC del día 11, así que con
    // toISOString() esta venta se contabilizaba el 11.
    mockState.sales = [venta('s1', new Date(2026, 6, 10, 21, 0), 250)];

    const r = await getSalesSummaryOptimized({ from: null, to: null });

    expect(r.timeseries[0].date).toBe('2026-07-10');
  });

  it('acumula varias ventas del mismo día y ordena cronológicamente', async () => {
    mockState.sales = [
      venta('s1', new Date(2026, 6, 11, 8, 0), 50),
      venta('s2', new Date(2026, 6, 10, 20, 0), 100),
      venta('s3', new Date(2026, 6, 10, 9, 0), 30),
    ];

    const r = await getSalesSummaryOptimized({ from: null, to: null });

    expect(r.timeseries.map((p) => p.date)).toEqual(['2026-07-10', '2026-07-11']);
    expect(r.timeseries[0]).toMatchObject({ income: 130, count: 2 });
    expect(r.timeseries[1]).toMatchObject({ income: 50, count: 1 });
  });

  it('un período sin ventas devuelve totales en cero y serie vacía', async () => {
    const r = await getSalesSummaryOptimized({ from: null, to: null });

    expect(r.totalSalesCount).toBe(0);
    expect(r.totalIncome).toBe(0);
    expect(r.timeseries).toEqual([]);
  });
});

describe('getSalesSummaryOptimized: totales', () => {
  it('calcula la ganancia usando el costo guardado en la línea', async () => {
    mockState.sales = [
      venta('s1', new Date(2026, 6, 10, 9, 0), 100, [
        { productId: 'p1', quantity: 2, total: 100, purchasePrice: 30 },
      ]),
    ];

    const r = await getSalesSummaryOptimized({ from: null, to: null });

    expect(r.totalIncome).toBe(100);
    expect(r.totalCost).toBe(60);   // 2 × 30
    expect(r.profit).toBe(40);
  });

  it('expone los descuentos en un solo campo (antes se duplicaban en `totalSaved`)', async () => {
    mockState.sales = [
      venta('s1', new Date(2026, 6, 10, 9, 0), 90, [
        { productId: 'p1', quantity: 1, total: 90, purchasePrice: 30, discount: 10 },
      ]),
    ];

    const r = await getSalesSummaryOptimized({ from: null, to: null });

    expect(r.totalDiscounts).toBe(10);
    expect(r.totalSaved).toBeUndefined();
  });

  it('incluye las pre-ventas completadas junto con las ventas rápidas', async () => {
    mockState.sales = [venta('s1', new Date(2026, 6, 10, 9, 0), 100)];
    mockState.presales = [venta('p1', new Date(2026, 6, 10, 11, 0), 200)];

    const r = await getSalesSummaryOptimized({ from: null, to: null });

    expect(r.totalSalesCount).toBe(2);
    expect(r.totalIncome).toBe(300);
    expect(r.timeseries[0]).toMatchObject({ date: '2026-07-10', income: 300, count: 2 });
  });
});
