/**
 * reimbursementService — lectura de reimbursements/{expenseId}. La escritura
 * vive en expenseService.reviewExpense() (FASE E6.1); este servicio es
 * puramente de lectura.
 */
const mockDoc = jest.fn();
jest.mock('../../android/app/src/services/firebaseConfig', () => ({
  firestore: Object.assign(
    () => ({ collection: (name) => ({ doc: (id) => mockDoc(name, id) }) }),
    { FieldValue: { serverTimestamp: () => 'ts' } },
  ),
}));

const { getReimbursement, REIMBURSEMENT_STATUSES } = require('../../android/app/src/screens/expenses/services/reimbursementService');

beforeEach(() => mockDoc.mockReset());

test('REIMBURSEMENT_STATUSES expone los tres estados del dominio', () => {
  expect(REIMBURSEMENT_STATUSES).toEqual(['PENDING', 'PAID', 'CANCELLED']);
});

test('getReimbursement devuelve null si el documento no existe', async () => {
  mockDoc.mockReturnValue({ get: async () => ({ exists: () => false }) });
  const result = await getReimbursement('e1');
  expect(result).toBeNull();
  expect(mockDoc).toHaveBeenCalledWith('reimbursements', 'e1');
});

test('getReimbursement devuelve el documento con su id cuando existe', async () => {
  mockDoc.mockReturnValue({
    get: async () => ({
      exists: () => true,
      id: 'e1',
      data: () => ({ expenseId: 'e1', status: 'PENDING', amount: 500 }),
    }),
  });
  const result = await getReimbursement('e1');
  expect(result).toEqual({ id: 'e1', expenseId: 'e1', status: 'PENDING', amount: 500 });
});
