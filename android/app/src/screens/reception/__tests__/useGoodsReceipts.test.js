import { renderHook, act } from '@testing-library/react-hooks';
import { useGoodsReceipts } from '../hooks/useGoodsReceipts';

// El hook se suscribe vía subscribeGoodsReceipts; el mock entrega de inmediato el
// set de recepciones controlado por el test y devuelve un unsubscribe no-op.
const mockState = { docs: [] };
jest.mock('../../../services/receptionService', () => ({
  subscribeGoodsReceipts: (cb) => {
    cb(mockState.docs);
    return () => {};
  },
}));

// Timestamp estilo Firestore (expone toMillis()).
const ts = (millis) => ({ toMillis: () => millis });

const NOW = Date.now();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// Ancla al inicio del día local: "hoy" con NOW - HOUR fallaba si el test corría
// dentro de la primera hora tras medianoche (cruzaba al día anterior).
const TODAY_START = new Date(NOW);
TODAY_START.setHours(0, 0, 0, 0);

const receipts = () => [
  { id: 'r_now', status: 'completed', totalUnits: 5, totalCost: 100, createdAt: ts(TODAY_START.getTime() + HOUR), items: [] }, // hoy
  { id: 'r_3d', status: 'completed', totalUnits: 3, totalCost: 60, createdAt: ts(NOW - 3 * DAY), items: [] },       // 3 días
  { id: 'r_10d', status: 'voided', totalUnits: 8, totalCost: 200, createdAt: ts(NOW - 10 * DAY), items: [] },       // 10 días, anulada
  { id: 'r_40d', status: 'completed', totalUnits: 2, totalCost: 40, createdAt: ts(NOW - 40 * DAY), items: [] },     // 40 días
];

beforeEach(() => { mockState.docs = receipts(); });

const ids = (list) => list.map((r) => r.id).sort();

describe('useGoodsReceipts — filtro por tiempo', () => {
  it('por defecto (all) muestra todas las recepciones', () => {
    const { result } = renderHook(() => useGoodsReceipts());
    expect(ids(result.current.receipts)).toEqual(['r_10d', 'r_3d', 'r_40d', 'r_now']);
    expect(result.current.timeFilter).toBe('all');
  });

  it('"today" deja solo las de hoy', () => {
    const { result } = renderHook(() => useGoodsReceipts());
    act(() => result.current.setTimeFilter('today'));
    expect(ids(result.current.receipts)).toEqual(['r_now']);
  });

  it('"7d" incluye hoy y 3 días, excluye 10 y 40 días', () => {
    const { result } = renderHook(() => useGoodsReceipts());
    act(() => result.current.setTimeFilter('7d'));
    expect(ids(result.current.receipts)).toEqual(['r_3d', 'r_now']);
  });

  it('"30d" excluye la de 40 días', () => {
    const { result } = renderHook(() => useGoodsReceipts());
    act(() => result.current.setTimeFilter('30d'));
    expect(ids(result.current.receipts)).toEqual(['r_10d', 'r_3d', 'r_now']);
  });

  it('el resumen refleja el periodo (solo completadas cuentan al inventario)', () => {
    const { result } = renderHook(() => useGoodsReceipts());
    act(() => result.current.setTimeFilter('7d'));
    // r_now (5u/100) + r_3d (3u/60) completadas; la anulada de 10d queda fuera del rango igual.
    expect(result.current.summary.completedCount).toBe(2);
    expect(result.current.summary.totalUnits).toBe(8);
    expect(result.current.summary.totalCost).toBe(160);
  });

  it('combina tiempo y estado', () => {
    const { result } = renderHook(() => useGoodsReceipts());
    act(() => result.current.setTimeFilter('30d'));
    act(() => result.current.setStatusFilter('voided'));
    expect(ids(result.current.receipts)).toEqual(['r_10d']);
  });

  it('combina tiempo y búsqueda de texto', () => {
    mockState.docs = [
      { id: 'a', status: 'completed', supplier: 'Granja Sur', createdAt: ts(NOW - HOUR), items: [] },
      { id: 'b', status: 'completed', supplier: 'Avícola Norte', createdAt: ts(NOW - HOUR), items: [] },
      { id: 'c', status: 'completed', supplier: 'Granja Sur', createdAt: ts(NOW - 40 * DAY), items: [] },
    ];
    const { result } = renderHook(() => useGoodsReceipts());
    act(() => result.current.setTimeFilter('7d'));
    act(() => result.current.setSearch('granja'));
    expect(ids(result.current.receipts)).toEqual(['a']);
  });
});
