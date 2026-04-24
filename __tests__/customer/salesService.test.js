/**
 * Tests para salesService.js
 * Cubre: fetchSalesByCustomer, registerSale, updateSale, deleteSale
 */

const mockAdd = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockOnSnapshot = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();

jest.mock('@react-native-firebase/firestore', () => {
  const doc = () => ({
    update: mockUpdate,
    delete: mockDelete,
  });
  const collection = () => ({
    where: mockWhere,
    doc: jest.fn().mockImplementation(doc),
    add: mockAdd,
  });
  const firestore = () => ({ collection });
  firestore.FieldValue = { serverTimestamp: jest.fn() };
  return firestore;
});

const {
  fetchSalesByCustomer,
  registerSale,
  updateSale,
  deleteSale,
} = require('../../android/app/src/screens/customer/services/salesService');

describe('salesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });
  });

  describe('fetchSalesByCustomer', () => {
    it('suscribe y mapea ventas correctamente', () => {
      const fakeUnsub = jest.fn();
      const fakeDocs = [
        {
          id: 's1',
          data: () => ({
            saleNumber: 1,
            customerId: 'c1',
            items: [{ name: 'Pollo' }],
            subtotal: 100,
            total: 90,
            discountApplied: 10,
            paymentType: 'cash',
            date: { toDate: () => new Date('2026-01-01') },
          }),
        },
        { id: 's2', data: () => ({}) },
      ];

      mockOrderBy.mockReturnValue({
        onSnapshot: (success, _err) => {
          success({ size: 2, docs: fakeDocs });
          return fakeUnsub;
        },
      });

      const onUpdate = jest.fn();
      const unsub = fetchSalesByCustomer('c1', onUpdate);

      expect(onUpdate).toHaveBeenCalledTimes(1);
      const list = onUpdate.mock.calls[0][0];
      expect(list).toHaveLength(2);
      expect(list[0]).toMatchObject({ id: 's1', total: 90, items: [{ name: 'Pollo' }] });
      expect(list[1]).toMatchObject({ id: 's2', total: 0, items: [] });
      expect(unsub).toBe(fakeUnsub);
    });

    it('llama onUpdate([]) cuando hay error en snapshot', () => {
      mockOrderBy.mockReturnValue({
        onSnapshot: (_success, err) => {
          err(new Error('fail'));
          return jest.fn();
        },
      });

      const onUpdate = jest.fn();
      fetchSalesByCustomer('c1', onUpdate);
      expect(onUpdate).toHaveBeenCalledWith([]);
    });
  });

  describe('registerSale', () => {
    it('registra venta con date y createdAt', async () => {
      mockAdd.mockResolvedValue({ id: 'sale1' });
      const data = { customerId: 'c1', total: 50 };
      const ref = await registerSale(data);

      const payload = mockAdd.mock.calls[0][0];
      expect(payload.customerId).toBe('c1');
      expect(payload.total).toBe(50);
      expect(payload.date).toBeInstanceOf(Date);
      expect(payload.createdAt).toBeInstanceOf(Date);
      expect(ref).toEqual({ id: 'sale1' });
    });

    it('lanza error si falla', async () => {
      mockAdd.mockRejectedValue(new Error('write'));
      await expect(registerSale({})).rejects.toThrow('write');
    });
  });

  describe('updateSale', () => {
    it('actualiza con updatedAt', async () => {
      mockUpdate.mockResolvedValue();
      await updateSale('s1', { total: 200 });
      const payload = mockUpdate.mock.calls[0][0];
      expect(payload.total).toBe(200);
      expect(payload.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('deleteSale', () => {
    it('elimina la venta', async () => {
      mockDelete.mockResolvedValue();
      await deleteSale('s1');
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });
  });
});

