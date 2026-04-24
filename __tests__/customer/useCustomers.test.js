/**
 * Tests para useCustomers hook
 */
import { renderHook, act } from '@testing-library/react-hooks';

const mockFetchCustomers = jest.fn();
const mockCreateCustomer = jest.fn();
const mockUpdateCustomer = jest.fn();
const mockDeleteCustomer = jest.fn();

jest.mock('../../android/app/src/screens/customer/services/customerService', () => ({
  fetchCustomers: (...args) => mockFetchCustomers(...args),
  createCustomer: (...args) => mockCreateCustomer(...args),
  updateCustomer: (...args) => mockUpdateCustomer(...args),
  deleteCustomer: (...args) => mockDeleteCustomer(...args),
}));

const { useCustomers } = require('../../android/app/src/screens/customer/hooks/useCustomers');

describe('useCustomers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('inicia con loading=true y customers=[]', () => {
    mockFetchCustomers.mockReturnValue(jest.fn());

    const { result } = renderHook(() => useCustomers());
    expect(result.current.loading).toBe(true);
    expect(result.current.customers).toEqual([]);
  });

  it('actualiza customers cuando el listener emite datos', () => {
    let listener;
    mockFetchCustomers.mockImplementation((cb) => {
      listener = cb;
      return jest.fn();
    });

    const { result } = renderHook(() => useCustomers());

    act(() => {
      listener([{ id: 'c1', firstName: 'Juan' }]);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.customers).toEqual([{ id: 'c1', firstName: 'Juan' }]);
  });

  it('create llama a createCustomer', async () => {
    mockFetchCustomers.mockReturnValue(jest.fn());
    mockCreateCustomer.mockResolvedValue({ id: 'new1' });

    const { result } = renderHook(() => useCustomers());

    await act(async () => {
      await result.current.create({ firstName: 'Ana' });
    });

    expect(mockCreateCustomer).toHaveBeenCalledWith({ firstName: 'Ana' });
  });

  it('update llama a updateCustomer', async () => {
    mockFetchCustomers.mockReturnValue(jest.fn());
    mockUpdateCustomer.mockResolvedValue();

    const { result } = renderHook(() => useCustomers());

    await act(async () => {
      await result.current.update('c1', { firstName: 'Editado' });
    });

    expect(mockUpdateCustomer).toHaveBeenCalledWith('c1', { firstName: 'Editado' });
  });

  it('remove llama a deleteCustomer', async () => {
    mockFetchCustomers.mockReturnValue(jest.fn());
    mockDeleteCustomer.mockResolvedValue();

    const { result } = renderHook(() => useCustomers());

    await act(async () => {
      await result.current.remove('c1');
    });

    expect(mockDeleteCustomer).toHaveBeenCalledWith('c1');
  });

  it('se desuscribe al desmontar', () => {
    const unsub = jest.fn();
    mockFetchCustomers.mockReturnValue(unsub);

    const { unmount } = renderHook(() => useCustomers());
    unmount();

    expect(unsub).toHaveBeenCalled();
  });
});

