/**
 * Tests para useSalesHistory hook
 */
import { renderHook, act } from '@testing-library/react-hooks';

const mockFetchSalesByCustomer = jest.fn();

// Mock the module paths as they are resolved relative to the source file
jest.mock('../../android/app/src/screens/sales/services/saleService', () => ({
  fetchSalesByCustomer: (...args) => mockFetchSalesByCustomer(...args),
}), { virtual: true });

// The hook imports from ../../utils/dateHelpers (relative to hooks dir = screens/utils/dateHelpers)
// We need to mock both possible resolution paths
jest.mock('../../android/app/src/screens/utils/dateHelpers', () => ({
  startOfToday: () => new Date('2026-04-19T00:00:00'),
  startOfWeek: () => new Date('2026-04-13T00:00:00'),
  startOfMonth: () => new Date('2026-04-01T00:00:00'),
}), { virtual: true });

jest.mock('../../android/app/src/utils/dateHelpers', () => ({
  startOfToday: () => new Date('2026-04-19T00:00:00'),
  startOfWeek: () => new Date('2026-04-13T00:00:00'),
  startOfMonth: () => new Date('2026-04-01T00:00:00'),
}), { virtual: true });

const { useSalesHistory } = require('../../android/app/src/screens/customer/hooks/useSalesHistory');

describe('useSalesHistory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sin customerId → sales=[] y loading=false', () => {
    const { result } = renderHook(() => useSalesHistory(null));
    expect(result.current.sales).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('con customerId suscribe y recibe ventas', () => {
    let listener;
    mockFetchSalesByCustomer.mockImplementation((id, cb) => {
      listener = cb;
      return jest.fn();
    });

    const { result } = renderHook(() => useSalesHistory('c1'));

    act(() => {
      listener([
        { id: 's1', date: new Date('2026-04-19T12:00:00'), total: 100 },
        { id: 's2', date: new Date('2026-04-10T12:00:00'), total: 200 },
        { id: 's3', date: new Date('2026-03-01T12:00:00'), total: 300 },
      ]);
    });

    expect(result.current.sales).toHaveLength(3);
    expect(result.current.loading).toBe(false);
  });

  it('filtra por "today"', () => {
    let listener;
    mockFetchSalesByCustomer.mockImplementation((id, cb) => {
      listener = cb;
      return jest.fn();
    });

    const { result } = renderHook(() => useSalesHistory('c1'));

    act(() => {
      listener([
        { id: 's1', date: new Date('2026-04-19T12:00:00'), total: 100 },
        { id: 's2', date: new Date('2026-04-10T12:00:00'), total: 200 },
      ]);
    });

    act(() => result.current.setFilter('today'));

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].id).toBe('s1');
  });

  it('filtra por "week"', () => {
    let listener;
    mockFetchSalesByCustomer.mockImplementation((id, cb) => {
      listener = cb;
      return jest.fn();
    });

    const { result } = renderHook(() => useSalesHistory('c1'));

    act(() => {
      listener([
        { id: 's1', date: new Date('2026-04-19T12:00:00'), total: 100 },
        { id: 's2', date: new Date('2026-04-14T12:00:00'), total: 200 },
        { id: 's3', date: new Date('2026-04-01T12:00:00'), total: 300 },
      ]);
    });

    act(() => result.current.setFilter('week'));

    expect(result.current.filtered).toHaveLength(2);
  });

  it('filtra por "month"', () => {
    let listener;
    mockFetchSalesByCustomer.mockImplementation((id, cb) => {
      listener = cb;
      return jest.fn();
    });

    const { result } = renderHook(() => useSalesHistory('c1'));

    act(() => {
      listener([
        { id: 's1', date: new Date('2026-04-19T12:00:00'), total: 100 },
        { id: 's2', date: new Date('2026-03-15T12:00:00'), total: 200 },
      ]);
    });

    act(() => result.current.setFilter('month'));

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].id).toBe('s1');
  });

  it('filter "all" muestra todo', () => {
    let listener;
    mockFetchSalesByCustomer.mockImplementation((id, cb) => {
      listener = cb;
      return jest.fn();
    });

    const { result } = renderHook(() => useSalesHistory('c1'));

    act(() => {
      listener([
        { id: 's1', date: new Date('2026-04-19'), total: 100 },
        { id: 's2', date: new Date('2025-01-01'), total: 200 },
      ]);
    });

    // default is 'all'
    expect(result.current.filtered).toHaveLength(2);
  });

  it('se desuscribe al desmontar', () => {
    const unsub = jest.fn();
    mockFetchSalesByCustomer.mockReturnValue(unsub);

    const { unmount } = renderHook(() => useSalesHistory('c1'));
    unmount();
    expect(unsub).toHaveBeenCalled();
  });
});



