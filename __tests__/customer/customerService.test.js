/**
 * Tests para customerService.js
 * Cubre: fetchCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer
 */
import firestore from '@react-native-firebase/firestore';

// Re-mock firestore con mayor control
const mockAdd = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockGet = jest.fn();
const mockOnSnapshot = jest.fn();
const mockOrderBy = jest.fn();
const mockDoc = jest.fn();

jest.mock('@react-native-firebase/firestore', () => {
  const doc = (id) => ({
    get: mockGet,
    update: mockUpdate,
    delete: mockDelete,
  });
  const collection = () => ({
    orderBy: mockOrderBy,
    doc: mockDoc.mockImplementation(doc),
    add: mockAdd,
  });
  const firestore = () => ({ collection });
  firestore.FieldValue = { serverTimestamp: jest.fn() };
  return firestore;
});

const {
  fetchCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} = require('../../android/app/src/screens/customer/services/customerService');

describe('customerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── fetchCustomers ───
  describe('fetchCustomers', () => {
    it('suscribe a la colección y mapea documentos correctamente', () => {
      const fakeUnsubscribe = jest.fn();
      const fakeDocs = [
        {
          id: 'c1',
          data: () => ({ firstName: 'Juan', lastName: 'Pérez', phone: '555', creditLimit: 100, type: 'Mayorista', discount: 5 }),
        },
        {
          id: 'c2',
          data: () => ({}), // documento vacío → valores por defecto
        },
      ];

      mockOrderBy.mockReturnValue({
        onSnapshot: (successCb, _errorCb) => {
          successCb({ size: 2, docs: fakeDocs });
          return fakeUnsubscribe;
        },
      });

      const onUpdate = jest.fn();
      const unsub = fetchCustomers(onUpdate);

      expect(onUpdate).toHaveBeenCalledTimes(1);
      const result = onUpdate.mock.calls[0][0];
      expect(result).toHaveLength(2);
      // Primer cliente con datos
      expect(result[0]).toMatchObject({ id: 'c1', firstName: 'Juan', creditLimit: 100, discount: 5 });
      // Segundo cliente con defaults
      expect(result[1]).toMatchObject({ id: 'c2', firstName: '', creditLimit: 0, type: 'Común', discount: 0 });
      expect(unsub).toBe(fakeUnsubscribe);
    });

    it('llama onUpdate([]) cuando hay error en snapshot', () => {
      mockOrderBy.mockReturnValue({
        onSnapshot: (_successCb, errorCb) => {
          errorCb(new Error('fail'));
          return jest.fn();
        },
      });

      const onUpdate = jest.fn();
      fetchCustomers(onUpdate);
      expect(onUpdate).toHaveBeenCalledWith([]);
    });
  });

  // ─── getCustomerById ───
  describe('getCustomerById', () => {
    it('retorna cliente mapeado cuando el doc existe', async () => {
      mockGet.mockResolvedValue({
        exists: true,
        id: 'c1',
        data: () => ({ firstName: 'Ana', lastName: 'López', phone: '111' }),
      });

      const result = await getCustomerById('c1');
      expect(result).toMatchObject({ id: 'c1', firstName: 'Ana' });
    });

    it('retorna null cuando el doc no existe', async () => {
      mockGet.mockResolvedValue({ exists: false });
      const result = await getCustomerById('xxx');
      expect(result).toBeNull();
    });

    it('lanza error cuando firestore falla', async () => {
      mockGet.mockRejectedValue(new Error('network'));
      await expect(getCustomerById('c1')).rejects.toThrow('network');
    });
  });

  // ─── createCustomer ───
  describe('createCustomer', () => {
    it('crea un cliente con valores por defecto', async () => {
      mockAdd.mockResolvedValue({ id: 'new1' });

      const ref = await createCustomer({ firstName: 'Pedro' });
      expect(mockAdd).toHaveBeenCalledTimes(1);

      const payload = mockAdd.mock.calls[0][0];
      expect(payload.firstName).toBe('Pedro');
      expect(payload.lastName).toBe('');
      expect(payload.type).toBe('Común');
      expect(payload.creditLimit).toBe(0);
      expect(payload.createdAt).toBeInstanceOf(Date);
      expect(ref).toEqual({ id: 'new1' });
    });

    it('lanza error si firestore falla', async () => {
      mockAdd.mockRejectedValue(new Error('write fail'));
      await expect(createCustomer({ firstName: 'X' })).rejects.toThrow('write fail');
    });
  });

  // ─── updateCustomer ───
  describe('updateCustomer', () => {
    it('actualiza con updatedAt', async () => {
      mockUpdate.mockResolvedValue();
      await updateCustomer('c1', { firstName: 'Juan Editado' });

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      const payload = mockUpdate.mock.calls[0][0];
      expect(payload.firstName).toBe('Juan Editado');
      expect(payload.updatedAt).toBeInstanceOf(Date);
    });

    it('lanza error si firestore falla', async () => {
      mockUpdate.mockRejectedValue(new Error('update fail'));
      await expect(updateCustomer('c1', {})).rejects.toThrow('update fail');
    });
  });

  // ─── deleteCustomer ───
  describe('deleteCustomer', () => {
    it('elimina el documento', async () => {
      mockDelete.mockResolvedValue();
      await deleteCustomer('c1');
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    it('lanza error si firestore falla', async () => {
      mockDelete.mockRejectedValue(new Error('delete fail'));
      await expect(deleteCustomer('c1')).rejects.toThrow('delete fail');
    });
  });
});

