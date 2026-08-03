import { renderHook } from '@testing-library/react-hooks';
import { useCredits } from '../hooks/useCredits';

jest.mock('../../../services/firebaseConfig', () => ({
  auth: () => ({
    currentUser: { email: 'mocked-auth@example.com' },
  }),
}));

// `failWith` simula un query rechazado (índice en construcción, permisos).
const mockState = { failWith: null };

jest.mock('../services/creditsService', () => ({
  fetchCredits: (cb, _opts, onError) => {
    if (mockState.failWith) onError?.(mockState.failWith);
    else cb([]);
    return () => {};
  },
  // Los totales ahora se suman en el servidor, no sobre la lista descargada.
  getCreditTotals: jest.fn().mockResolvedValue({ paid: 0, pending: 0 }),
  abonarCredito: jest.fn(),
  eliminarCredito: jest.fn(),
}));

beforeEach(() => { mockState.failWith = null; });

describe('useCredits', () => {
  it('initializes with empty credits', () => {
    const { result } = renderHook(() => useCredits({ email: 'test@example.com' }, 'admin', 'all'));
    expect(result.current.filteredCredits).toEqual([]);
    expect(result.current.totals).toEqual({ paid: 0, pending: 0 });
  });

  it('handles missing user object without crashing', () => {
    const { result } = renderHook(() => useCredits(null, 'admin', 'all'));
    expect(result.current.filteredCredits).toEqual([]);
  });

  // Regresión: un query fallido dejaba `loading` en true para siempre y la
  // pantalla se quedaba girando en "Cargando créditos...", sin lista ni motivo.
  it('un query fallido termina la carga y expone el error', () => {
    mockState.failWith = new Error('The query requires an index');

    const { result } = renderHook(() => useCredits({ email: 'test@example.com' }, 'vendedor', 'pending'));

    expect(result.current.loading).toBe(false);
    expect(result.current.loadError).toBeTruthy();
    expect(result.current.filteredCredits).toEqual([]);
  });
});
