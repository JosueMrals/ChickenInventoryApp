/**
 * expenseService — operaciones que tocan Firestore (createExpense,
 * cancelExpense, reviewExpense). Un mock en memoria modela la colección
 * `expenses`, igual patrón que receptionServiceTransaction.test.js.
 */

const mockDb = { data: { expenses: {} }, writes: [] };

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

  // Ref "real" (fuera de transacción): expone get/set/update directos,
  // igual que el SDK real, para createExpense() que escribe con ref.set(...).
  const makeRef = (collection, id) => {
    const ref = { collection, id: id != null ? id : `auto-${++autoId}` };
    ref.get = () => doGet(ref);
    ref.set = (payload) => doSet(ref, payload);
    ref.update = (payload) => doUpdate(ref, payload);
    return ref;
  };

  const txApi = { get: doGet, set: doSet, update: doUpdate };

  const firestore = () => ({
    collection: (name) => ({
      doc: (id) => makeRef(name, id),
      where: (field) => ({
        get: async () => {
          const coll = mockDb.data[name] || {};
          const docs = Object.entries(coll)
            .filter(([, v]) => v && v[field] !== undefined)
            .map(([id, v]) => ({ id, data: () => v }));
          return { docs };
        },
      }),
    }),
    runTransaction: async (fn) => fn(txApi),
  });
  firestore.FieldValue = { serverTimestamp: () => 'ts' };
  return firestore;
});

const {
  createExpense,
  cancelExpense,
  reviewExpense,
} = require('../../android/app/src/screens/expenses/services/expenseService');

const resetDb = () => {
  mockDb.data = { expenses: {} };
  mockDb.writes = [];
};

const validReceipt = { url: 'https://mock/r.jpg', path: 'expenseReceipts/u1_1.jpg' };

beforeEach(resetDb);

describe('createExpense', () => {
  test('crea un gasto CASH: PENDING, sin cierre, sin reimbursement', async () => {
    const id = await createExpense({
      amount: 500, category: 'FUEL', paymentMethod: 'CASH', receipt: validReceipt, createdByUid: 'u1',
    });

    const doc = mockDb.data.expenses[id];
    expect(doc).toMatchObject({
      amount: 500, category: 'FUEL', paymentMethod: 'CASH', status: 'PENDING',
      createdByUid: 'u1', cashClosingId: null, reviewedByUid: null, reimbursement: null,
    });
  });

  test('crea un gasto PERSONAL con obligación de reembolso pendiente', async () => {
    const id = await createExpense({
      amount: 300, category: 'FOOD', paymentMethod: 'PERSONAL', receipt: validReceipt, createdByUid: 'u1',
    });

    expect(mockDb.data.expenses[id].reimbursement).toEqual({ status: 'PENDING', amount: 300, paidAt: null });
  });

  test('rechaza un borrador inválido antes de escribir (sin comprobante)', async () => {
    await expect(
      createExpense({ amount: 500, category: 'FUEL', paymentMethod: 'CASH', createdByUid: 'u1' })
    ).rejects.toThrow(/comprobante/i);
    expect(mockDb.writes).toHaveLength(0);
  });

  test('exige createdByUid', async () => {
    await expect(
      createExpense({ amount: 500, category: 'FUEL', paymentMethod: 'CASH', receipt: validReceipt })
    ).rejects.toThrow(/usuario inválido/i);
  });
});

describe('cancelExpense', () => {
  test('el creador cancela su PENDING sin cierre asignado', async () => {
    mockDb.data.expenses.e1 = { createdByUid: 'u1', status: 'PENDING', cashClosingId: null };
    await cancelExpense('e1', 'u1');
    expect(mockDb.data.expenses.e1.status).toBe('CANCELLED');
  });

  test('otro usuario no puede cancelarlo', async () => {
    mockDb.data.expenses.e1 = { createdByUid: 'u1', status: 'PENDING', cashClosingId: null };
    await expect(cancelExpense('e1', 'u2')).rejects.toThrow(/ya no se puede cancelar/i);
    expect(mockDb.data.expenses.e1.status).toBe('PENDING');
  });

  test('no se puede cancelar un gasto ya vinculado a un cierre', async () => {
    mockDb.data.expenses.e1 = { createdByUid: 'u1', status: 'PENDING', cashClosingId: 'c1' };
    await expect(cancelExpense('e1', 'u1')).rejects.toThrow(/ya no se puede cancelar/i);
  });

  test('no se puede cancelar un gasto ya APPROVED', async () => {
    mockDb.data.expenses.e1 = { createdByUid: 'u1', status: 'APPROVED', cashClosingId: null };
    await expect(cancelExpense('e1', 'u1')).rejects.toThrow(/ya no se puede cancelar/i);
  });

  test('gasto inexistente lanza error claro', async () => {
    await expect(cancelExpense('nope', 'u1')).rejects.toThrow(/ya no existe/i);
  });
});

describe('reviewExpense', () => {
  test('admin aprueba un PENDING', async () => {
    mockDb.data.expenses.e1 = { createdByUid: 'u1', status: 'PENDING' };
    await reviewExpense('e1', 'APPROVED', 'admin-1');
    expect(mockDb.data.expenses.e1).toMatchObject({ status: 'APPROVED', reviewedByUid: 'admin-1' });
  });

  test('admin rechaza un PENDING', async () => {
    mockDb.data.expenses.e1 = { createdByUid: 'u1', status: 'PENDING' };
    await reviewExpense('e1', 'REJECTED', 'admin-1');
    expect(mockDb.data.expenses.e1.status).toBe('REJECTED');
  });

  // FASE E6.3.1: APPROVED ya no es terminal para REJECTED (rechazo
  // posterior) — pero sigue siéndolo para APPROVED (no se re-aprueba). El
  // detalle completo de APPROVED→REJECTED vive en su propio describe abajo.
  test('APPROVED no vuelve a aprobarse', async () => {
    mockDb.data.expenses.e1 = { createdByUid: 'u1', status: 'APPROVED', paymentMethod: 'CASH', amount: 100 };
    await expect(reviewExpense('e1', 'APPROVED', 'admin-1')).rejects.toThrow(/ya fue revisado/i);
  });

  test('REJECTED no vuelve a revisarse', async () => {
    mockDb.data.expenses.e1 = { createdByUid: 'u1', status: 'REJECTED' };
    await expect(reviewExpense('e1', 'APPROVED', 'admin-1')).rejects.toThrow(/ya fue revisado/i);
  });

  test('rechaza una decisión que no sea APPROVED/REJECTED', async () => {
    mockDb.data.expenses.e1 = { createdByUid: 'u1', status: 'PENDING' };
    await expect(reviewExpense('e1', 'MAYBE', 'admin-1')).rejects.toThrow(/decisión de revisión inválida/i);
  });

  // FASE E3 — rechazo posterior a un gasto CASH ya liquidado.
  describe('compensación post-cierre (FASE E3)', () => {
    test('CASH ya liquidado + reject → crea exactamente una compensación en deliveryShortages', async () => {
      mockDb.data.expenses.e1 = {
        createdByUid: 'u1', status: 'PENDING', paymentMethod: 'CASH',
        cashClosingId: 'closing-1', amount: 500,
      };

      await reviewExpense('e1', 'REJECTED', 'admin-1');

      expect(mockDb.data.expenses.e1.status).toBe('REJECTED');
      const shortage = mockDb.data.deliveryShortages['expense-rejected-e1'];
      expect(shortage).toMatchObject({
        expenseId: 'e1',
        cashClosingId: 'closing-1',
        reason: 'expense_rejected_post_close',
        entregadorId: 'u1',
        totalMissingValue: 500,
        status: 'pending',
      });
    });

    test('el Cash Closing histórico no se toca al rechazar (solo se escribe el expense y la compensación)', async () => {
      mockDb.data.expenses.e1 = {
        createdByUid: 'u1', status: 'PENDING', paymentMethod: 'CASH', cashClosingId: 'closing-1', amount: 500,
      };
      mockDb.data.cashClosings = { 'closing-1': { status: 'complete', expectedAmount: 4500 } };

      await reviewExpense('e1', 'REJECTED', 'admin-1');

      expect(mockDb.data.cashClosings['closing-1']).toEqual({ status: 'complete', expectedAmount: 4500 });
    });

    test('reintentar el mismo rechazo no genera una segunda compensación (idempotente)', async () => {
      mockDb.data.expenses.e1 = {
        createdByUid: 'u1', status: 'PENDING', paymentMethod: 'CASH', cashClosingId: 'closing-1', amount: 500,
      };
      await reviewExpense('e1', 'REJECTED', 'admin-1');

      // Un segundo intento de "revisar" ya no es posible (ya no está PENDING),
      // pero si el escritor determinístico se invocara de nuevo con el mismo
      // expenseId, el id fijo `expense-rejected-e1` evita un duplicado real.
      await expect(reviewExpense('e1', 'REJECTED', 'admin-1')).rejects.toThrow(/ya fue revisado/i);
      expect(Object.keys(mockDb.data.deliveryShortages)).toHaveLength(1);
    });

    test('CASH sin liquidar (cashClosingId null) + reject → NO crea compensación', async () => {
      mockDb.data.expenses.e1 = {
        createdByUid: 'u1', status: 'PENDING', paymentMethod: 'CASH', cashClosingId: null, amount: 500,
      };

      await reviewExpense('e1', 'REJECTED', 'admin-1');

      expect(Object.keys(mockDb.data.deliveryShortages || {})).toHaveLength(0);
    });

    test('aprobar (no rechazar) un gasto ya liquidado NO crea compensación', async () => {
      mockDb.data.expenses.e1 = {
        createdByUid: 'u1', status: 'PENDING', paymentMethod: 'CASH', cashClosingId: 'closing-1', amount: 500,
      };

      await reviewExpense('e1', 'APPROVED', 'admin-1');

      expect(Object.keys(mockDb.data.deliveryShortages || {})).toHaveLength(0);
    });
  });

  // FASE E4 — espejo en financials, solo al aprobar.
  describe('mirror en financials (FASE E4)', () => {
    const seed = (overrides = {}) => {
      mockDb.data.expenses.e1 = {
        createdByUid: 'u1', status: 'PENDING', amount: 500,
        category: 'FUEL', description: null, cashClosingId: null,
        ...overrides,
      };
    };

    test.each(['CASH', 'PERSONAL', 'CARD', 'TRANSFER'])(
      '%s APPROVED crea exactamente un financial',
      async (paymentMethod) => {
        seed({ paymentMethod });
        await reviewExpense('e1', 'APPROVED', 'admin-1');
        expect(Object.keys(mockDb.data.financials)).toEqual(['expense-e1']);
      }
    );

    test.each(['CASH', 'PERSONAL', 'CARD', 'TRANSFER'])(
      '%s REJECTED no crea ningún financial',
      async (paymentMethod) => {
        seed({ paymentMethod });
        await reviewExpense('e1', 'REJECTED', 'admin-1');
        expect(Object.keys(mockDb.data.financials || {})).toHaveLength(0);
      }
    );

    test('CANCELLED (vía cancelExpense) no crea ningún financial', async () => {
      seed({ paymentMethod: 'CASH' });
      await cancelExpense('e1', 'u1');
      expect(mockDb.data.expenses.e1.status).toBe('CANCELLED');
      expect(Object.keys(mockDb.data.financials || {})).toHaveLength(0);
    });

    test('id determinístico: expense-{expenseId}', async () => {
      seed({ paymentMethod: 'CASH' });
      await reviewExpense('e1', 'APPROVED', 'admin-1');
      expect(mockDb.data.financials['expense-e1']).toBeTruthy();
    });

    test('contenido correcto: amount, type, category, paymentMethod, expenseId, description/concept', async () => {
      seed({ paymentMethod: 'CASH', category: 'FUEL', description: 'Gasolina ruta norte' });
      await reviewExpense('e1', 'APPROVED', 'admin-1');

      expect(mockDb.data.financials['expense-e1']).toMatchObject({
        type: 'expense',
        amount: 500,
        category: 'FUEL',
        paymentMethod: 'CASH',
        expenseId: 'e1',
        description: 'Gasolina ruta norte',
        concept: 'Gasolina ruta norte',
        createdAt: 'ts',
      });
    });

    // FASE E5.1 — el financial debe representar a quien REGISTRÓ el gasto,
    // no a quien lo aprobó.
    describe('createdByUid en el mirror (FASE E5.1)', () => {
      test('el financial creado toma createdByUid del Expense, no del reviewer', async () => {
        seed({ paymentMethod: 'CASH', createdByUid: 'u1' });
        await reviewExpense('e1', 'APPROVED', 'admin-1');

        expect(mockDb.data.financials['expense-e1'].createdByUid).toBe('u1');
      });

      test('createdByUid del financial coincide con Expense.createdByUid', async () => {
        seed({ paymentMethod: 'PERSONAL', createdByUid: 'entregador-7' });
        await reviewExpense('e1', 'APPROVED', 'admin-1');

        expect(mockDb.data.financials['expense-e1'].createdByUid)
          .toBe(mockDb.data.expenses.e1.createdByUid);
      });

      test('createdByUid del financial NUNCA es el reviewerUid cuando difieren', async () => {
        seed({ paymentMethod: 'CARD', createdByUid: 'u1' });
        await reviewExpense('e1', 'APPROVED', 'admin-distinto');

        expect(mockDb.data.financials['expense-e1'].createdByUid).toBe('u1');
        expect(mockDb.data.financials['expense-e1'].createdByUid).not.toBe('admin-distinto');
      });
    });

    test('sin descripción, usa la etiqueta de la categoría', async () => {
      seed({ paymentMethod: 'CASH', category: 'FUEL', description: null });
      await reviewExpense('e1', 'APPROVED', 'admin-1');

      expect(mockDb.data.financials['expense-e1']).toMatchObject({
        description: 'Combustible',
        concept: 'Combustible',
      });
    });

    test('PERSONAL aprobado crea financial pero NO toca el reimbursement', async () => {
      seed({ paymentMethod: 'PERSONAL', reimbursement: { status: 'PENDING', amount: 500, paidAt: null } });
      await reviewExpense('e1', 'APPROVED', 'admin-1');

      expect(mockDb.data.financials['expense-e1']).toMatchObject({ type: 'expense', amount: 500 });
      expect(mockDb.data.expenses.e1.reimbursement).toEqual({ status: 'PENDING', amount: 500, paidAt: null });
    });

    test('idempotencia: reintentar la aprobación no es posible, pero un solo financial existe', async () => {
      seed({ paymentMethod: 'CASH' });
      await reviewExpense('e1', 'APPROVED', 'admin-1');

      // canReviewExpense ya bloquea una segunda revisión — la propia máquina
      // de estados impide el reintento antes de llegar al financial.
      await expect(reviewExpense('e1', 'APPROVED', 'admin-1')).rejects.toThrow(/ya fue revisado/i);
      expect(Object.keys(mockDb.data.financials)).toHaveLength(1);
    });

    test('atomicidad: si la revisión falla (gasto ya no existe), no queda financial huérfano', async () => {
      await expect(reviewExpense('no-existe', 'APPROVED', 'admin-1')).rejects.toThrow(/ya no existe/i);
      expect(Object.keys(mockDb.data.financials || {})).toHaveLength(0);
    });

    test('CASH liquidado y luego rechazado: ningún financial, sí la compensación de E3', async () => {
      seed({ paymentMethod: 'CASH', cashClosingId: 'closing-1' });
      await reviewExpense('e1', 'REJECTED', 'admin-1');

      expect(Object.keys(mockDb.data.financials || {})).toHaveLength(0);
      expect(mockDb.data.deliveryShortages['expense-rejected-e1']).toBeTruthy();
    });
  });

  // FASE E6.1 — reimbursements/{expenseId}, gobernado por reviewExpense().
  describe('reimbursements (FASE E6.1)', () => {
    const seed = (overrides = {}) => {
      mockDb.data.expenses.e1 = {
        createdByUid: 'u1', status: 'PENDING', amount: 500,
        category: 'FUEL', description: null, cashClosingId: null,
        ...overrides,
      };
    };

    test('PERSONAL + APPROVED crea el reimbursement en PENDING', async () => {
      seed({ paymentMethod: 'PERSONAL' });
      await reviewExpense('e1', 'APPROVED', 'admin-1');

      expect(mockDb.data.reimbursements.e1).toMatchObject({
        expenseId: 'e1',
        createdByUid: 'u1',
        amount: 500,
        status: 'PENDING',
        paidAt: null,
        paidByUid: null,
        cancelledAt: null,
        cancelledByUid: null,
        paymentMethod: null,
        notes: null,
        createdAt: 'ts',
      });
    });

    test.each(['CASH', 'CARD', 'TRANSFER'])(
      '%s + APPROVED NO crea ningún reimbursement',
      async (paymentMethod) => {
        seed({ paymentMethod });
        await reviewExpense('e1', 'APPROVED', 'admin-1');
        expect(mockDb.data.reimbursements || {}).toEqual({});
      }
    );

    test('id determinístico: reimbursements/{expenseId}, igual al id del Expense', async () => {
      seed({ paymentMethod: 'PERSONAL' });
      await reviewExpense('e1', 'APPROVED', 'admin-1');
      expect(Object.keys(mockDb.data.reimbursements)).toEqual(['e1']);
    });

    test('idempotencia: no es posible re-aprobar, un solo reimbursement existe', async () => {
      seed({ paymentMethod: 'PERSONAL' });
      await reviewExpense('e1', 'APPROVED', 'admin-1');
      await expect(reviewExpense('e1', 'APPROVED', 'admin-1')).rejects.toThrow(/ya fue revisado/i);
      expect(Object.keys(mockDb.data.reimbursements)).toHaveLength(1);
    });

    test('PERSONAL + REJECTED (nunca aprobado): no hay reimbursement que cancelar, no-op', async () => {
      seed({ paymentMethod: 'PERSONAL' });
      await reviewExpense('e1', 'REJECTED', 'admin-1');
      expect(mockDb.data.reimbursements || {}).toEqual({});
    });

    test('PERSONAL + APPROVED, luego el Expense se rechaza más tarde (E6.1 solo prepara el terreno, no revierte aquí): el reimbursement PENDING existente no se toca por otra vía que no sea reviewExpense', async () => {
      seed({ paymentMethod: 'PERSONAL' });
      await reviewExpense('e1', 'APPROVED', 'admin-1');
      // canReviewExpense ya bloquea revisar de nuevo (ver test de idempotencia);
      // este caso documenta que un reimbursement PENDING solo cambia dentro
      // de reviewExpense(), nunca por otro camino de escritura.
      expect(mockDb.data.reimbursements.e1.status).toBe('PENDING');
    });

    test('reimbursement PENDING + REJECTED del Expense (rechazo directo desde PENDING, vía un segundo expense): se cancela automáticamente', async () => {
      // Simula un Expense PERSONAL PENDING con un reimbursement PENDING ya
      // existente de una corrida previa (estado que solo puede darse si algo
      // externo lo sembró) — confirma la transición PENDING→CANCELLED.
      seed({ paymentMethod: 'PERSONAL' });
      mockDb.data.reimbursements = { e1: { expenseId: 'e1', createdByUid: 'u1', amount: 500, status: 'PENDING' } };

      await reviewExpense('e1', 'REJECTED', 'admin-2');

      expect(mockDb.data.reimbursements.e1).toMatchObject({
        status: 'CANCELLED',
        cancelledByUid: 'admin-2',
        cancelledAt: 'ts',
      });
    });

    test('reimbursement ya CANCELLED + REJECTED: no-op, sigue CANCELLED', async () => {
      seed({ paymentMethod: 'PERSONAL' });
      mockDb.data.reimbursements = {
        e1: { expenseId: 'e1', createdByUid: 'u1', amount: 500, status: 'CANCELLED', cancelledByUid: 'admin-1' },
      };

      await reviewExpense('e1', 'REJECTED', 'admin-2');

      expect(mockDb.data.reimbursements.e1).toMatchObject({ status: 'CANCELLED', cancelledByUid: 'admin-1' });
    });

    test('reimbursement ya PAID + REJECTED: NO se modifica el reimbursement (queda como PAID)', async () => {
      seed({ paymentMethod: 'PERSONAL' });
      mockDb.data.reimbursements = {
        e1: { expenseId: 'e1', createdByUid: 'u1', amount: 500, status: 'PAID', paidByUid: 'admin-1', paidAt: 'ts' },
      };

      await reviewExpense('e1', 'REJECTED', 'admin-2');

      expect(mockDb.data.reimbursements.e1).toMatchObject({ status: 'PAID', paidByUid: 'admin-1' });
      expect(mockDb.data.expenses.e1.status).toBe('REJECTED');
    });

    test('CASH/CARD/TRANSFER + REJECTED: nunca tocan reimbursements (no aplica)', async () => {
      seed({ paymentMethod: 'CASH' });
      await reviewExpense('e1', 'REJECTED', 'admin-1');
      expect(mockDb.data.reimbursements || {}).toEqual({});
    });
  });

  // FASE E6.2 — compensación cuando el reimbursement ya fue PAID y el Expense
  // se rechaza después (decisión del propietario: no revertir el pago).
  describe('compensación post-rechazo de un reimbursement PAID (FASE E6.2/E6.3.1)', () => {
    // FASE E6.3.1: antes de esta fase, `status: 'PENDING'` aquí sembraba un
    // estado imposible (un reimbursement PAID solo puede existir si el
    // Expense ya está APPROVED) — E6.3.0 lo detectó como "falsa cobertura".
    // Ahora se siembra el único estado que el flujo real puede producir.
    const seedPaid = () => {
      mockDb.data.expenses.e1 = {
        createdByUid: 'u1', status: 'APPROVED', amount: 500, paymentMethod: 'PERSONAL',
        category: 'FUEL', description: null, cashClosingId: null,
      };
      mockDb.data.reimbursements = {
        e1: { expenseId: 'e1', createdByUid: 'u1', amount: 500, status: 'PAID', paidByUid: 'admin-1', paidAt: 'ts' },
      };
    };

    test('APPROVED+PAID → REJECTED: crea deliveryShortages/reimbursement-rejected-{id}', async () => {
      seedPaid();
      await reviewExpense('e1', 'REJECTED', 'admin-2');

      expect(mockDb.data.deliveryShortages['reimbursement-rejected-e1']).toMatchObject({
        expenseId: 'e1',
        reason: 'reimbursement_rejected_post_paid',
        entregadorId: 'u1',
        totalMissingValue: 500,
        status: 'pending',
      });
    });

    test('el reimbursement permanece exactamente PAID (no se revierte)', async () => {
      seedPaid();
      await reviewExpense('e1', 'REJECTED', 'admin-2');
      expect(mockDb.data.reimbursements.e1.status).toBe('PAID');
    });

    test('un cashOutflow y un financial ya existentes no se tocan', async () => {
      seedPaid();
      mockDb.data.cashOutflows = { e1: { expenseId: 'e1', amount: 500, paymentMethod: 'CASH' } };
      mockDb.data.financials = { 'expense-e1': { type: 'expense', amount: 500 } };

      await reviewExpense('e1', 'REJECTED', 'admin-2');

      expect(mockDb.data.cashOutflows.e1).toEqual({ expenseId: 'e1', amount: 500, paymentMethod: 'CASH' });
      expect(mockDb.data.financials['expense-e1']).toEqual({ type: 'expense', amount: 500 });
    });

    // FASE E6.3.1: seed realista — un reimbursement PENDING solo existe si el
    // Expense ya está APPROVED (nace en esa misma aprobación, E6.1).
    test('APPROVED + reimbursement todavía PENDING + REJECTED: NO crea la compensación de PAID (se cancela, Caso A)', async () => {
      mockDb.data.expenses.e1 = {
        createdByUid: 'u1', status: 'APPROVED', amount: 500, paymentMethod: 'PERSONAL',
        category: 'FUEL', description: null, cashClosingId: null,
      };
      mockDb.data.reimbursements = { e1: { expenseId: 'e1', createdByUid: 'u1', amount: 500, status: 'PENDING' } };

      await reviewExpense('e1', 'REJECTED', 'admin-2');

      expect(mockDb.data.deliveryShortages || {}).toEqual({});
      expect(mockDb.data.reimbursements.e1.status).toBe('CANCELLED');
    });

    // Caso C del propietario: un reimbursement CANCELLED en un Expense
    // APPROVED es una combinación que el propio flujo nunca produce (nace
    // CANCELLED solo en la misma transacción que rechaza) — si aparece por
    // datos inconsistentes, no se inventa deuda ni se toca nada.
    test('APPROVED + reimbursement ya CANCELLED (inconsistencia) + REJECTED: NO crea deuda, no falla', async () => {
      mockDb.data.expenses.e1 = {
        createdByUid: 'u1', status: 'APPROVED', amount: 500, paymentMethod: 'PERSONAL',
        category: 'FUEL', description: null, cashClosingId: null,
      };
      mockDb.data.reimbursements = {
        e1: { expenseId: 'e1', createdByUid: 'u1', amount: 500, status: 'CANCELLED' },
      };

      await expect(reviewExpense('e1', 'REJECTED', 'admin-2')).resolves.not.toThrow();

      expect(mockDb.data.deliveryShortages || {}).toEqual({});
      expect(mockDb.data.reimbursements.e1.status).toBe('CANCELLED'); // sin tocar
      expect(mockDb.data.expenses.e1.status).toBe('REJECTED'); // el rechazo del Expense sí se completa
    });

    test('idempotente: no es posible re-rechazar (canReviewExpense ya lo bloquea), un solo deliveryShortage existe', async () => {
      seedPaid();
      await reviewExpense('e1', 'REJECTED', 'admin-2');

      await expect(reviewExpense('e1', 'REJECTED', 'admin-2')).rejects.toThrow(/ya fue revisado/i);
      expect(Object.keys(mockDb.data.deliveryShortages)).toHaveLength(1);
    });
  });

  // FASE E6.3.1 — APPROVED → REJECTED, incluyendo CASH ya vinculado a un
  // cierre (Casos D/E del propietario). El código de compensación ya existía
  // desde E3/E6.2; lo único que cambia es que ahora es alcanzable.
  describe('APPROVED → REJECTED (FASE E6.3.1)', () => {
    test('CASH APPROVED sin cierre + REJECTED: sin shortage, sin impacto de Cash Closing', async () => {
      mockDb.data.expenses.e1 = {
        createdByUid: 'u1', status: 'APPROVED', amount: 500, paymentMethod: 'CASH', cashClosingId: null,
      };
      await reviewExpense('e1', 'REJECTED', 'admin-1');

      expect(mockDb.data.expenses.e1.status).toBe('REJECTED');
      expect(mockDb.data.deliveryShortages || {}).toEqual({});
    });

    test('CASH APPROVED con cierre ya asignado + REJECTED: crea expense-rejected-{id}, el cierre no se toca', async () => {
      mockDb.data.expenses.e1 = {
        createdByUid: 'u1', status: 'APPROVED', amount: 500, paymentMethod: 'CASH', cashClosingId: 'closing-1',
      };
      mockDb.data.cashClosings = { 'closing-1': { status: 'complete', expectedAmount: 4500 } };

      await reviewExpense('e1', 'REJECTED', 'admin-1');

      expect(mockDb.data.expenses.e1.status).toBe('REJECTED');
      expect(mockDb.data.deliveryShortages['expense-rejected-e1']).toMatchObject({
        expenseId: 'e1', cashClosingId: 'closing-1', reason: 'expense_rejected_post_close',
        entregadorId: 'u1', totalMissingValue: 500, status: 'pending',
      });
      expect(mockDb.data.cashClosings['closing-1']).toEqual({ status: 'complete', expectedAmount: 4500 });
    });

    test('reintentar el rechazo (ya REJECTED) falla y no duplica el shortage', async () => {
      mockDb.data.expenses.e1 = {
        createdByUid: 'u1', status: 'APPROVED', amount: 500, paymentMethod: 'CASH', cashClosingId: 'closing-1',
      };
      await reviewExpense('e1', 'REJECTED', 'admin-1');

      await expect(reviewExpense('e1', 'REJECTED', 'admin-1')).rejects.toThrow(/ya fue revisado/i);
      expect(Object.keys(mockDb.data.deliveryShortages)).toHaveLength(1);
    });

    // Transiciones explícitamente prohibidas por el propietario.
    test('APPROVED → CANCELLED: no existe (reviewExpense solo acepta APPROVED/REJECTED)', async () => {
      mockDb.data.expenses.e1 = { createdByUid: 'u1', status: 'APPROVED', amount: 500, paymentMethod: 'CASH' };
      await expect(reviewExpense('e1', 'CANCELLED', 'admin-1')).rejects.toThrow(/decisión de revisión inválida/i);
    });

    test('APPROVED → APPROVED: falla (no se re-aprueba)', async () => {
      mockDb.data.expenses.e1 = { createdByUid: 'u1', status: 'APPROVED', amount: 500, paymentMethod: 'CASH' };
      await expect(reviewExpense('e1', 'APPROVED', 'admin-1')).rejects.toThrow(/ya fue revisado/i);
    });

    test('REJECTED → APPROVED: falla (terminal)', async () => {
      mockDb.data.expenses.e1 = { createdByUid: 'u1', status: 'REJECTED', amount: 500, paymentMethod: 'CASH' };
      await expect(reviewExpense('e1', 'APPROVED', 'admin-1')).rejects.toThrow(/ya fue revisado/i);
    });

    test('REJECTED → REJECTED: falla (terminal)', async () => {
      mockDb.data.expenses.e1 = { createdByUid: 'u1', status: 'REJECTED', amount: 500, paymentMethod: 'CASH' };
      await expect(reviewExpense('e1', 'REJECTED', 'admin-1')).rejects.toThrow(/ya fue revisado/i);
    });

    test('CANCELLED → REJECTED: falla (terminal)', async () => {
      mockDb.data.expenses.e1 = { createdByUid: 'u1', status: 'CANCELLED', amount: 500, paymentMethod: 'CASH' };
      await expect(reviewExpense('e1', 'REJECTED', 'admin-1')).rejects.toThrow(/ya fue revisado/i);
    });

    test('CANCELLED → APPROVED: falla (terminal)', async () => {
      mockDb.data.expenses.e1 = { createdByUid: 'u1', status: 'CANCELLED', amount: 500, paymentMethod: 'CASH' };
      await expect(reviewExpense('e1', 'APPROVED', 'admin-1')).rejects.toThrow(/ya fue revisado/i);
    });
  });
});
