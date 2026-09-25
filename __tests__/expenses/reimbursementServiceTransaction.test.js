/**
 * reimbursementService.payReimbursement() — pago del reembolso, transaccional
 * (FASE E6.2). Mismo mock en memoria que expenseServiceTransaction.test.js.
 */

const mockDb = { data: { expenses: {}, reimbursements: {}, cashOutflows: {} }, writes: [] };

jest.mock('@react-native-firebase/firestore', () => {
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
    const ref = { collection, id };
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

const { payReimbursement, getCashOutflow } = require('../../android/app/src/screens/expenses/services/reimbursementService');

const resetDb = () => {
  mockDb.data = { expenses: {}, reimbursements: {}, cashOutflows: {} };
  mockDb.writes = [];
};

beforeEach(resetDb);

const seedApprovedPersonal = (overrides = {}) => {
  mockDb.data.expenses.e1 = {
    createdByUid: 'u1', status: 'APPROVED', paymentMethod: 'PERSONAL', amount: 500,
    ...overrides,
  };
};

const seedPendingReimbursement = (overrides = {}) => {
  mockDb.data.reimbursements.e1 = {
    expenseId: 'e1', createdByUid: 'u1', amount: 500, status: 'PENDING',
    createdAt: 'ts', paidAt: null, paidByUid: null, cancelledAt: null,
    cancelledByUid: null, paymentMethod: null, notes: null,
    ...overrides,
  };
};

describe('payReimbursement — pago exitoso', () => {
  test('CASH: PENDING → PAID y crea cashOutflows/{expenseId}', async () => {
    seedApprovedPersonal();
    seedPendingReimbursement();

    await payReimbursement('e1', { paymentMethod: 'CASH', paidByUid: 'admin-1' });

    expect(mockDb.data.reimbursements.e1).toMatchObject({
      status: 'PAID', paymentMethod: 'CASH', paidByUid: 'admin-1', paidAt: 'ts', reference: null,
    });
    expect(mockDb.data.cashOutflows.e1).toMatchObject({
      expenseId: 'e1', amount: 500, paymentMethod: 'CASH', paidByUid: 'admin-1', paidAt: 'ts',
    });
  });

  test('TRANSFER con reference: PENDING → PAID', async () => {
    seedApprovedPersonal();
    seedPendingReimbursement();

    await payReimbursement('e1', { paymentMethod: 'TRANSFER', reference: 'TRX-001', paidByUid: 'admin-1' });

    expect(mockDb.data.reimbursements.e1).toMatchObject({ status: 'PAID', paymentMethod: 'TRANSFER', reference: 'TRX-001' });
    expect(mockDb.data.cashOutflows.e1).toMatchObject({ paymentMethod: 'TRANSFER', reference: 'TRX-001' });
  });

  test('TRANSFER sin reference: falla, nada se escribe', async () => {
    seedApprovedPersonal();
    seedPendingReimbursement();

    await expect(payReimbursement('e1', { paymentMethod: 'TRANSFER', paidByUid: 'admin-1' }))
      .rejects.toThrow(/referencia/i);
    expect(mockDb.writes).toHaveLength(0);
  });

  test('amount del cashOutflow siempre proviene de reimbursement.amount, nunca de un input externo', async () => {
    seedApprovedPersonal({ amount: 777 });
    seedPendingReimbursement({ amount: 777 });

    await payReimbursement('e1', { paymentMethod: 'CASH', paidByUid: 'admin-1' });

    expect(mockDb.data.cashOutflows.e1.amount).toBe(777);
  });

  test('notas opcionales se recortan y quedan null si vienen vacías', async () => {
    seedApprovedPersonal();
    seedPendingReimbursement();

    await payReimbursement('e1', { paymentMethod: 'CASH', notes: '   ', paidByUid: 'admin-1' });

    expect(mockDb.data.reimbursements.e1.notes).toBeNull();
  });
});

describe('payReimbursement — validaciones', () => {
  test('reimbursement inexistente: falla', async () => {
    seedApprovedPersonal();
    await expect(payReimbursement('e1', { paymentMethod: 'CASH', paidByUid: 'admin-1' }))
      .rejects.toThrow(/no existe/i);
  });

  test('reimbursement REJECTED no existe como tal (E6.1: REJECTED cancela el reimbursement) — CANCELLED: falla', async () => {
    seedApprovedPersonal();
    seedPendingReimbursement({ status: 'CANCELLED', cancelledAt: 'ts', cancelledByUid: 'admin-1' });

    await expect(payReimbursement('e1', { paymentMethod: 'CASH', paidByUid: 'admin-1' }))
      .rejects.toThrow(/ya no está pendiente/i);
  });

  test('reimbursement ya PAID: falla, idempotente (no duplica el cashOutflow)', async () => {
    seedApprovedPersonal();
    seedPendingReimbursement({ status: 'PAID', paymentMethod: 'CASH', paidByUid: 'admin-1', paidAt: 'ts' });
    mockDb.data.cashOutflows.e1 = { expenseId: 'e1', amount: 500, paymentMethod: 'CASH', paidByUid: 'admin-1', paidAt: 'ts', reference: null, notes: null };

    await expect(payReimbursement('e1', { paymentMethod: 'CASH', paidByUid: 'admin-2' }))
      .rejects.toThrow(/ya no está pendiente/i);
    expect(Object.keys(mockDb.data.cashOutflows)).toHaveLength(1);
  });

  test('Expense no PERSONAL: falla', async () => {
    seedApprovedPersonal({ paymentMethod: 'CASH' });
    seedPendingReimbursement();

    await expect(payReimbursement('e1', { paymentMethod: 'CASH', paidByUid: 'admin-1' }))
      .rejects.toThrow(/no genera obligación/i);
  });

  test('Expense no APPROVED (todavía PENDING): falla', async () => {
    seedApprovedPersonal({ status: 'PENDING' });
    seedPendingReimbursement();

    await expect(payReimbursement('e1', { paymentMethod: 'CASH', paidByUid: 'admin-1' }))
      .rejects.toThrow(/debe estar aprobado/i);
  });

  test('Expense inexistente: falla', async () => {
    seedPendingReimbursement();
    await expect(payReimbursement('e1', { paymentMethod: 'CASH', paidByUid: 'admin-1' }))
      .rejects.toThrow(/gasto ya no existe/i);
  });

  test('paymentMethod inválido (p.ej. CARD): falla antes de tocar Firestore', async () => {
    seedApprovedPersonal();
    seedPendingReimbursement();

    await expect(payReimbursement('e1', { paymentMethod: 'CARD', paidByUid: 'admin-1' }))
      .rejects.toThrow(/inválido/i);
    expect(mockDb.writes).toHaveLength(0);
  });

  test('sin paidByUid: falla', async () => {
    seedApprovedPersonal();
    seedPendingReimbursement();
    await expect(payReimbursement('e1', { paymentMethod: 'CASH' })).rejects.toThrow(/usuario inválido/i);
  });
});

describe('payReimbursement — concurrencia / retry', () => {
  test('doble pago concurrente: el segundo intento encuentra PENDING ya consumido y falla', async () => {
    seedApprovedPersonal();
    seedPendingReimbursement();

    await payReimbursement('e1', { paymentMethod: 'CASH', paidByUid: 'admin-A' });
    await expect(payReimbursement('e1', { paymentMethod: 'CASH', paidByUid: 'admin-B' }))
      .rejects.toThrow(/ya no está pendiente/i);

    expect(mockDb.data.reimbursements.e1.paidByUid).toBe('admin-A');
    expect(Object.keys(mockDb.data.cashOutflows)).toHaveLength(1);
  });

  test('retry (mismo llamado repetido tras éxito): no genera un segundo cashOutflow', async () => {
    seedApprovedPersonal();
    seedPendingReimbursement();

    await payReimbursement('e1', { paymentMethod: 'CASH', paidByUid: 'admin-1' });
    await expect(payReimbursement('e1', { paymentMethod: 'CASH', paidByUid: 'admin-1' })).rejects.toThrow();

    expect(Object.keys(mockDb.data.cashOutflows)).toHaveLength(1);
  });
});

// FASE E6.3.1 — protección contra auto-pago (createdByUid === paidByUid).
describe('payReimbursement — protección contra auto-pago (FASE E6.3.1)', () => {
  test('createdByUid === paidByUid: rechazado, nada se escribe', async () => {
    seedApprovedPersonal({ createdByUid: 'admin-1' });
    seedPendingReimbursement({ createdByUid: 'admin-1' });

    await expect(payReimbursement('e1', { paymentMethod: 'CASH', paidByUid: 'admin-1' }))
      .rejects.toThrow(/no puede pagar su propio reembolso/i);
    expect(mockDb.writes).toHaveLength(0);
  });

  test('createdByUid !== paidByUid: permitido', async () => {
    seedApprovedPersonal({ createdByUid: 'u1' });
    seedPendingReimbursement({ createdByUid: 'u1' });

    await payReimbursement('e1', { paymentMethod: 'CASH', paidByUid: 'admin-2' });

    expect(mockDb.data.reimbursements.e1).toMatchObject({ status: 'PAID', paidByUid: 'admin-2' });
  });
});

describe('payReimbursement — aislamiento (FASE E6.2 §15)', () => {
  test('no crea cashCollections ni cashClosings ni financials, no modifica payrollSettlements', async () => {
    seedApprovedPersonal();
    seedPendingReimbursement();
    mockDb.data.financials = { 'expense-e1': { type: 'expense', amount: 500 } };

    await payReimbursement('e1', { paymentMethod: 'CASH', paidByUid: 'admin-1' });

    expect(mockDb.data.cashCollections).toBeUndefined();
    expect(mockDb.data.cashClosings).toBeUndefined();
    expect(mockDb.data.payrollSettlements).toBeUndefined();
    // el financial ya existente (de la aprobación) sigue exactamente igual
    expect(mockDb.data.financials['expense-e1']).toEqual({ type: 'expense', amount: 500 });
  });
});

describe('getCashOutflow', () => {
  test('devuelve null si no existe', async () => {
    expect(await getCashOutflow('e1')).toBeNull();
  });

  test('devuelve el documento con su id', async () => {
    seedApprovedPersonal();
    seedPendingReimbursement();
    await payReimbursement('e1', { paymentMethod: 'CASH', paidByUid: 'admin-1' });

    const outflow = await getCashOutflow('e1');
    expect(outflow).toMatchObject({ id: 'e1', expenseId: 'e1', amount: 500 });
  });
});
