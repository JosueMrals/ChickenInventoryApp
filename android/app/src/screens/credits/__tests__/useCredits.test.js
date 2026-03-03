import { renderHook } from '@testing-library/react-hooks';
import { useCredits } from '../hooks/useCredits';

jest.mock('../services/creditsService', () => ({
  fetchCredits: (cb) => {
    cb([]);
    return () => {};
  },
  abonarCredito: jest.fn(),
  eliminarCredito: jest.fn(),
}));

describe('useCredits', () => {
  it('initializes with empty credits', () => {
    const { result } = renderHook(() => useCredits({ email: 'test@example.com' }, 'admin', 'all'));
    expect(result.current.filteredCredits).toEqual([]);
    expect(result.current.totals).toEqual({ paid: 0, pending: 0 });
  });
});
