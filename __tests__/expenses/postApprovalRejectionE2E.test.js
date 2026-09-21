/**
 * FASE E6.3.1 — prueba end-to-end del flujo que E6.3.0 encontró inalcanzable:
 *
 *   createExpense(PERSONAL)
 *   → reviewExpense(APPROVED)      → reimbursement PENDING
 *   → payReimbursement()           → reimbursement PAID, cashOutflow creado
 *   → reviewExpense(REJECTED)      → deliveryShortage creado
 *
 * A diferencia de los tests de expenseServiceTransaction.test.js (que
 * siembran el estado directamente en el mock), este archivo encadena las
 * funciones REALES una tras otra sobre el mismo mockDb — es la única forma
 * de demostrar que la transición es alcanzable de verdad, no solo que el
 * código interno hace lo correcto si se le fuerza a ejecutarse.
 */

const mockDb = { data: { expenses: {}, reimbursements: {}, cashOutflows: {}, financials: {}, deliveryShortages: {} }, writes: [] };

jest.mock('@react-native-firebase/firestore', () => {
  let autoId = 0;

  const doGet = async (ref) => {
    const coll = mockDb.data[ref.collection] || {};
    const doc = coll[ref.id];
    return { exists: () => !!doc, data: () => doc, id: ref.id, ref };
  };
  const doSet = (ref, payload) => {
    const coll = mockDb.data[ref.collection] || (mockDb.data[ref.collection] = {});
    coll[ref.id] = payload;
    mockDb.writes.push({ op: 'set', collection: ref.collection, id: ref.id, payload });
  };
  const doUpdate = (ref, payload) => {
    const coll = mockDb.data[ref.collection] || (mockDb.data[ref.collection] = {});
    coll[ref.id] = { ...(coll[ref.id] || {}), ...payload };
    mockDb.writes.push({ op: 'update', collection: ref.collection, id: ref.id, payload });
  };

  const makeRef = (collection, id) => {
    const ref = { collection, id: id != null ? id : `auto-${++autoId}` };
    ref.get = () => doGet(ref);
    ref.set = (payload) => doSet(ref, payload);
    ref.update = (payload) => doUpdate(ref, payload);
    return ref;
  };

  const txApi = { get: doGet, set: doSet, update: doUpdate };

  const firestore = () => ({
    collection: (name) => ({ doc: (id) => makeRef(name, id) }),
    runTransaction: async (fn) => fn(txApi),
  });
  firestore.FieldValue = { serverTimestamp: () => 'ts' };
  return firestore;
});

const { createExpense, reviewExpense } = require('../../android/app/src/screens/expenses/services/expenseService');
const { payReimbursement } = require('../../android/app/src/screens/expenses/services/reimbursementService');

const validReceipt = { url: 'https://mock/r.jpg', path: 'expenseReceipts/u1_1.jpg' };

beforeEach(() => {
  mockDb.data = { expenses: {}, reimbursements: {}, cashOutflows: {}, financials: {}, deliveryShortages: {} };
  mockDb.writes = [];
});

test('flujo real completo: create → approve → pay → reject → deliveryShortage', async () => {
  // 1. create — el empleado registra el gasto.
  const expenseId = await createExpense({
    amount: 500, category: 'FUEL', paymentMethod: 'PERSONAL', receipt: validReceipt, createdByUid: 'u1',
  });
  expect(mockDb.data.expenses[expenseId].status).toBe('PENDING');
  expect(mockDb.data.reimbursements[expenseId]).toBeUndefined(); // no nace hasta aprobar

  // 2. approve — el admin aprueba el gasto real.
  await reviewExpense(expenseId, 'APPROVED', 'admin-1');
  expect(mockDb.data.expenses[expenseId].status).toBe('APPROVED');
  expect(mockDb.data.financials[`expense-${expenseId}`]).toMatchObject({ type: 'expense', amount: 500 });
  expect(mockDb.data.reimbursements[expenseId]).toMatchObject({ status: 'PENDING', amount: 500 });

  // 3. pay — otro admin paga el reembolso real (no el mismo que aprobó, aunque
  // eso no es un requisito — solo evita el auto-pago si coincidiera con el creador).
  await payReimbursement(expenseId, { paymentMethod: 'CASH', paidByUid: 'admin-2' });
  expect(mockDb.data.reimbursements[expenseId]).toMatchObject({ status: 'PAID', paidByUid: 'admin-2' });
  expect(mockDb.data.cashOutflows[expenseId]).toMatchObject({ expenseId, amount: 500, paymentMethod: 'CASH' });

  // 4. reject — el mismo Expense, ya APPROVED y con el reembolso ya PAGADO,
  // se rechaza mediante la función real reviewExpense(). Antes de E6.3.1 esto
  // era imposible: canReviewExpense() exigía PENDING.
  await reviewExpense(expenseId, 'REJECTED', 'admin-3');

  // Resultado final — exactamente lo que el propietario definió en E6.3.1:
  expect(mockDb.data.expenses[expenseId].status).toBe('REJECTED');
  expect(mockDb.data.reimbursements[expenseId].status).toBe('PAID'); // no se revierte
  expect(mockDb.data.cashOutflows[expenseId]).toMatchObject({ amount: 500 }); // permanece
  expect(mockDb.data.financials[`expense-${expenseId}`]).toMatchObject({ amount: 500 }); // permanece histórico
  expect(mockDb.data.deliveryShortages[`reimbursement-rejected-${expenseId}`]).toMatchObject({
    expenseId,
    reason: 'reimbursement_rejected_post_paid',
    entregadorId: 'u1',
    totalMissingValue: 500,
    status: 'pending',
  });
});

test('flujo real: create → approve → reject (sin pago) → reimbursement CANCELLED, sin deliveryShortage', async () => {
  const expenseId = await createExpense({
    amount: 300, category: 'FOOD', paymentMethod: 'PERSONAL', receipt: validReceipt, createdByUid: 'u1',
  });
  await reviewExpense(expenseId, 'APPROVED', 'admin-1');
  expect(mockDb.data.reimbursements[expenseId].status).toBe('PENDING');

  await reviewExpense(expenseId, 'REJECTED', 'admin-2');

  expect(mockDb.data.expenses[expenseId].status).toBe('REJECTED');
  expect(mockDb.data.reimbursements[expenseId].status).toBe('CANCELLED');
  expect(mockDb.data.deliveryShortages[`reimbursement-rejected-${expenseId}`]).toBeUndefined();
});

test('flujo real: create → approve → reject (real) → no se puede volver a rechazar ni aprobar', async () => {
  const expenseId = await createExpense({
    amount: 200, category: 'TOLL', paymentMethod: 'CASH', receipt: validReceipt, createdByUid: 'u1',
  });
  await reviewExpense(expenseId, 'APPROVED', 'admin-1');
  await reviewExpense(expenseId, 'REJECTED', 'admin-2');

  await expect(reviewExpense(expenseId, 'REJECTED', 'admin-3')).rejects.toThrow(/ya fue revisado/i);
  await expect(reviewExpense(expenseId, 'APPROVED', 'admin-3')).rejects.toThrow(/ya fue revisado/i);
});

test('flujo real: el creador no puede pagarse su propio reembolso, incluso con el resto del flujo real', async () => {
  const expenseId = await createExpense({
    amount: 400, category: 'FUEL', paymentMethod: 'PERSONAL', receipt: validReceipt, createdByUid: 'admin-1',
  });
  await reviewExpense(expenseId, 'APPROVED', 'admin-1');

  await expect(payReimbursement(expenseId, { paymentMethod: 'CASH', paidByUid: 'admin-1' }))
    .rejects.toThrow(/no puede pagar su propio reembolso/i);
  expect(mockDb.data.reimbursements[expenseId].status).toBe('PENDING');
  expect(mockDb.data.cashOutflows[expenseId]).toBeUndefined();
});
