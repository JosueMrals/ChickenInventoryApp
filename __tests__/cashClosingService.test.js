/**
 * Cierre de Caja: suma de cobros, cálculo de faltante, cierre de turno y
 * revisión del admin. Igual que en Nómina, lo que decide es lo RELEÍDO dentro
 * de la transacción, no lo que traía la pantalla (ver payrollService.test.js).
 */

const mockState = { docs: {}, writes: [] };
let mockAutoId = 0;

// Query mínima (solo `==`) para el camino NO transaccional de
// openTurno/ensureOpenTurno: buscan el turno abierto de un uid antes de
// decidir si crean uno nuevo.
const mockQuery = (predicate) => ({
  where: (field, op, value) => mockQuery((doc) => predicate(doc) && doc[field] === value),
  limit: () => mockQuery(predicate),
  get: async () => {
    const docs = Object.entries(mockState.docs)
      .filter(([, data]) => predicate(data))
      .map(([id, data]) => ({ id, data: () => data }));
    return { empty: docs.length === 0, docs };
  },
});

jest.mock('@react-native-firebase/firestore', () => {
  const firestore = () => ({
    collection: () => ({
      doc: (id) => {
        const docId = id || `auto-${++mockAutoId}`;
        return {
          id: docId,
          set: async (payload) => {
            mockState.docs[docId] = { ...payload };
            mockState.writes.push({ id: docId, op: 'set', payload });
          },
        };
      },
      where: (field, op, value) => mockQuery((doc) => doc[field] === value),
    }),
    runTransaction: async (fn) => fn({
      get: async (ref) => ({
        id: ref.id,
        ref,
        exists: () => !!mockState.docs[ref.id],
        data: () => mockState.docs[ref.id],
      }),
      set: (ref, payload) => {
        mockState.docs[ref.id] = { ...payload };
        mockState.writes.push({ id: ref.id, op: 'set', payload });
      },
      update: (ref, payload) => {
        mockState.docs[ref.id] = { ...mockState.docs[ref.id], ...payload };
        mockState.writes.push({ id: ref.id, op: 'update', payload });
      },
    }),
  });
  firestore.FieldValue = { serverTimestamp: () => 'ts' };
  return firestore;
});

jest.mock('@react-native-firebase/auth', () => () => ({
  currentUser: { uid: 'admin-1', email: 'admin@test.com' },
}));

const {
  sumCollections,
  groupAmountsByUid,
  computeReviewOutcome,
  closeTurno,
  reviewTurno,
  openTurno,
  ensureOpenTurno,
} = require('../android/app/src/screens/cashClosing/services/cashClosingService');

beforeEach(() => {
  mockState.docs = {};
  mockState.writes = [];
});

describe('sumCollections', () => {
  test('suma los montos de varios cobros', () => {
    expect(sumCollections([{ amount: 100.1 }, { amount: 50.02 }])).toBe(150.12);
  });

  test('lista vacía o nula da cero', () => {
    expect(sumCollections([])).toBe(0);
    expect(sumCollections(null)).toBe(0);
  });
});

describe('computeReviewOutcome', () => {
  test('sin faltante queda completo', () => {
    const r = computeReviewOutcome(500, 0);
    expect(r).toEqual({ receivedAmount: 500, shortageAmount: 0, isComplete: true });
  });

  test('con faltante calcula lo recibido', () => {
    const r = computeReviewOutcome(500, 120);
    expect(r).toEqual({ receivedAmount: 380, shortageAmount: 120, isComplete: false });
  });

  test('un faltante mayor al esperado se recorta al total esperado', () => {
    const r = computeReviewOutcome(200, 9999);
    expect(r).toEqual({ receivedAmount: 0, shortageAmount: 200, isComplete: false });
  });
});

describe('closeTurno', () => {
  const seedTurno = (overrides = {}) => {
    mockState.docs['turno-1'] = { uid: 'u1', userName: 'Ana', status: 'open', ...overrides };
  };

  test('reclama los cobros vigentes y calcula el total esperado', async () => {
    seedTurno();
    mockState.docs.c1 = { uid: 'u1', amount: 100, turnoId: null };
    mockState.docs.c2 = { uid: 'u1', amount: 50, turnoId: null };

    const result = await closeTurno({ id: 'turno-1' }, ['c1', 'c2']);

    expect(result.expectedAmount).toBe(150);
    expect(mockState.docs['turno-1'].status).toBe('pending_review');
    expect(mockState.docs['turno-1'].collectionIds).toEqual(['c1', 'c2']);
    expect(mockState.docs.c1.turnoId).toBe('turno-1');
    expect(mockState.docs.c2.turnoId).toBe('turno-1');
  });

  test('ignora un cobro que ya fue reclamado por otro turno mientras tanto', async () => {
    seedTurno();
    mockState.docs.c1 = { uid: 'u1', amount: 100, turnoId: null };
    mockState.docs.c2 = { uid: 'u1', amount: 50, turnoId: 'otro-turno' };

    const result = await closeTurno({ id: 'turno-1' }, ['c1', 'c2']);

    expect(result.expectedAmount).toBe(100);
    expect(mockState.docs['turno-1'].collectionIds).toEqual(['c1']);
    expect(mockState.docs.c2.turnoId).toBe('otro-turno'); // sin tocar
  });

  test('rechaza cerrar un turno que ya no está abierto', async () => {
    seedTurno({ status: 'pending_review' });
    await expect(closeTurno({ id: 'turno-1' }, [])).rejects.toThrow(/ya fue cerrado/);
  });

  test('rechaza cerrar un turno inexistente', async () => {
    await expect(closeTurno({ id: 'no-existe' }, [])).rejects.toThrow(/ya no existe/);
  });

  // FASE E3 — gastos CASH liquidados en el mismo cierre.
  describe('con gastos CASH (FASE E3)', () => {
    test('sin gastos: expected = collections (Caso 1)', async () => {
      seedTurno();
      mockState.docs.c1 = { uid: 'u1', amount: 5000, turnoId: null };

      const result = await closeTurno({ id: 'turno-1', uid: 'u1' }, ['c1'], []);

      expect(result.expectedAmount).toBe(5000);
      expect(mockState.docs['turno-1'].cashExpensesTotal).toBe(0);
    });

    test('CASH PENDING descuenta del esperado (Caso 2)', async () => {
      seedTurno();
      mockState.docs.c1 = { uid: 'u1', amount: 5000, turnoId: null };
      mockState.docs.e1 = { createdByUid: 'u1', amount: 500, paymentMethod: 'CASH', status: 'PENDING', cashClosingId: null };

      const result = await closeTurno({ id: 'turno-1', uid: 'u1' }, ['c1'], ['e1']);

      expect(result.expectedAmount).toBe(4500);
      expect(result.cashExpensesTotal).toBe(500);
      expect(mockState.docs['turno-1'].cashExpensesTotal).toBe(500);
      expect(mockState.docs.e1.cashClosingId).toBe('turno-1');
      expect(mockState.docs.e1.status).toBe('PENDING'); // entrar al cierre no aprueba el gasto
    });

    test('CASH APPROVED también descuenta (Caso 3 — Modelo A, E1.1)', async () => {
      seedTurno();
      mockState.docs.c1 = { uid: 'u1', amount: 5000, turnoId: null };
      mockState.docs.e1 = { createdByUid: 'u1', amount: 500, paymentMethod: 'CASH', status: 'APPROVED', cashClosingId: null };

      const result = await closeTurno({ id: 'turno-1', uid: 'u1' }, ['c1'], ['e1']);

      expect(result.expectedAmount).toBe(4500);
      expect(mockState.docs.e1.cashClosingId).toBe('turno-1');
    });

    test('CASH REJECTED no descuenta ni se liquida (Caso 4)', async () => {
      seedTurno();
      mockState.docs.c1 = { uid: 'u1', amount: 5000, turnoId: null };
      mockState.docs.e1 = { createdByUid: 'u1', amount: 500, paymentMethod: 'CASH', status: 'REJECTED', cashClosingId: null };

      const result = await closeTurno({ id: 'turno-1', uid: 'u1' }, ['c1'], ['e1']);

      expect(result.expectedAmount).toBe(5000);
      expect(mockState.docs.e1.cashClosingId).toBeNull();
    });

    test('CASH CANCELLED no descuenta ni se liquida (Caso 5)', async () => {
      seedTurno();
      mockState.docs.c1 = { uid: 'u1', amount: 5000, turnoId: null };
      mockState.docs.e1 = { createdByUid: 'u1', amount: 500, paymentMethod: 'CASH', status: 'CANCELLED', cashClosingId: null };

      const result = await closeTurno({ id: 'turno-1', uid: 'u1' }, ['c1'], ['e1']);

      expect(result.expectedAmount).toBe(5000);
      expect(mockState.docs.e1.cashClosingId).toBeNull();
    });

    test('PERSONAL nunca se liquida ni afecta el esperado (Caso 5 del enunciado)', async () => {
      seedTurno();
      mockState.docs.c1 = { uid: 'u1', amount: 5000, turnoId: null };
      mockState.docs.e1 = { createdByUid: 'u1', amount: 500, paymentMethod: 'PERSONAL', status: 'PENDING', cashClosingId: null };

      const result = await closeTurno({ id: 'turno-1', uid: 'u1' }, ['c1'], ['e1']);

      expect(result.expectedAmount).toBe(5000);
      expect(mockState.docs.e1.cashClosingId).toBeNull();
    });

    test('CARD nunca se liquida ni afecta el esperado (Caso 6)', async () => {
      seedTurno();
      mockState.docs.c1 = { uid: 'u1', amount: 5000, turnoId: null };
      mockState.docs.e1 = { createdByUid: 'u1', amount: 500, paymentMethod: 'CARD', status: 'PENDING', cashClosingId: null };

      const result = await closeTurno({ id: 'turno-1', uid: 'u1' }, ['c1'], ['e1']);

      expect(result.expectedAmount).toBe(5000);
      expect(mockState.docs.e1.cashClosingId).toBeNull();
    });

    test('TRANSFER nunca se liquida ni afecta el esperado (Caso 7)', async () => {
      seedTurno();
      mockState.docs.c1 = { uid: 'u1', amount: 5000, turnoId: null };
      mockState.docs.e1 = { createdByUid: 'u1', amount: 500, paymentMethod: 'TRANSFER', status: 'PENDING', cashClosingId: null };

      const result = await closeTurno({ id: 'turno-1', uid: 'u1' }, ['c1'], ['e1']);

      expect(result.expectedAmount).toBe(5000);
      expect(mockState.docs.e1.cashClosingId).toBeNull();
    });

    test('dos gastos CASH suman correctamente', async () => {
      seedTurno();
      mockState.docs.c1 = { uid: 'u1', amount: 5000, turnoId: null };
      mockState.docs.e1 = { createdByUid: 'u1', amount: 500, paymentMethod: 'CASH', status: 'PENDING', cashClosingId: null };
      mockState.docs.e2 = { createdByUid: 'u1', amount: 300, paymentMethod: 'CASH', status: 'APPROVED', cashClosingId: null };

      const result = await closeTurno({ id: 'turno-1', uid: 'u1' }, ['c1'], ['e1', 'e2']);

      expect(result.expectedAmount).toBe(4200);
      expect(result.cashExpensesTotal).toBe(800);
    });

    test('un gasto ya liquidado en otro cierre no se incluye de nuevo (evita doble liquidación)', async () => {
      seedTurno();
      mockState.docs.c1 = { uid: 'u1', amount: 5000, turnoId: null };
      mockState.docs.e1 = { createdByUid: 'u1', amount: 500, paymentMethod: 'CASH', status: 'PENDING', cashClosingId: 'otro-cierre' };

      const result = await closeTurno({ id: 'turno-1', uid: 'u1' }, ['c1'], ['e1']);

      expect(result.expectedAmount).toBe(5000); // no se descontó
      expect(mockState.docs.e1.cashClosingId).toBe('otro-cierre'); // intacto
    });

    test('un gasto de otro usuario no se incluye (aislamiento por uid)', async () => {
      seedTurno();
      mockState.docs.c1 = { uid: 'u1', amount: 5000, turnoId: null };
      mockState.docs.e1 = { createdByUid: 'otro-usuario', amount: 500, paymentMethod: 'CASH', status: 'PENDING', cashClosingId: null };

      const result = await closeTurno({ id: 'turno-1', uid: 'u1' }, ['c1'], ['e1']);

      expect(result.expectedAmount).toBe(5000);
      expect(mockState.docs.e1.cashClosingId).toBeNull();
    });

    test('un gasto creado durante el cierre (no listado como candidato) queda para el siguiente', async () => {
      seedTurno();
      mockState.docs.c1 = { uid: 'u1', amount: 5000, turnoId: null };
      // e1 existe pero closeTurno() nunca lo recibió como candidato (llegó
      // después de que la pantalla reunió la lista) — comportamiento
      // determinista: simplemente no se lee ni se toca.
      mockState.docs.e1 = { createdByUid: 'u1', amount: 500, paymentMethod: 'CASH', status: 'PENDING', cashClosingId: null };

      const result = await closeTurno({ id: 'turno-1', uid: 'u1' }, ['c1'], []);

      expect(result.expectedAmount).toBe(5000);
      expect(mockState.docs.e1.cashClosingId).toBeNull(); // sigue disponible para el próximo cierre
    });
  });
});

describe('reviewTurno', () => {
  const seedPending = (overrides = {}) => {
    mockState.docs['turno-1'] = {
      uid: 'u1', userName: 'Ana', status: 'pending_review', expectedAmount: 300, ...overrides,
    };
  };

  test('dinero completo marca el turno como complete', async () => {
    seedPending();
    const result = await reviewTurno({ id: 'turno-1' }, 0);

    expect(result.status).toBe('complete');
    expect(mockState.docs['turno-1'].status).toBe('complete');
    expect(mockState.docs['turno-1'].receivedAmount).toBe(300);
    expect(mockState.docs['turno-1'].shortageId).toBeNull();
  });

  test('un faltante crea el deliveryShortages que Nómina descuenta después', async () => {
    seedPending();
    const result = await reviewTurno({ id: 'turno-1' }, 80);

    expect(result.status).toBe('shortage');
    expect(mockState.docs['turno-1'].shortageAmount).toBe(80);
    const shortageId = mockState.docs['turno-1'].shortageId;
    expect(shortageId).toBeTruthy();
    expect(mockState.docs[shortageId]).toEqual({
      entregadorId: 'u1',
      customerName: 'Cierre de caja · Ana',
      totalMissingValue: 80,
      status: 'pending',
      recordedAt: 'ts',
    });
  });

  test('rechaza revisar un turno que ya fue revisado', async () => {
    seedPending({ status: 'complete' });
    await expect(reviewTurno({ id: 'turno-1' }, 0)).rejects.toThrow(/ya fue revisado/);
  });
});

describe('openTurno', () => {
  test('abre un turno nuevo si no hay ninguno abierto', async () => {
    const id = await openTurno({ uid: 'u1', userName: 'Ana', role: 'vendedor' });
    expect(mockState.docs[id]).toMatchObject({ uid: 'u1', userName: 'Ana', role: 'vendedor', status: 'open' });
  });

  test('rechaza abrir un segundo turno mientras el primero sigue abierto', async () => {
    mockState.docs['turno-existente'] = { uid: 'u1', status: 'open' };
    await expect(openTurno({ uid: 'u1', userName: 'Ana', role: 'vendedor' })).rejects.toThrow(/ya tienes un turno abierto/i);
  });
});

describe('ensureOpenTurno', () => {
  test('sin uid no hace nada', async () => {
    const id = await ensureOpenTurno({ uid: null, userName: 'Ana' });
    expect(id).toBeNull();
    expect(mockState.writes).toHaveLength(0);
  });

  test('reutiliza el turno abierto si ya existe, sin crear otro', async () => {
    mockState.docs['turno-existente'] = { uid: 'u1', status: 'open' };
    const id = await ensureOpenTurno({ uid: 'u1', userName: 'Ana', role: 'vendedor' });
    expect(id).toBe('turno-existente');
    expect(mockState.writes).toHaveLength(0);
  });

  test('abre uno nuevo cuando el primer cobro del día llega sin turno abierto', async () => {
    const id = await ensureOpenTurno({ uid: 'u1', userName: 'Ana', role: 'entregador' });
    expect(mockState.docs[id]).toMatchObject({ uid: 'u1', userName: 'Ana', role: 'entregador', status: 'open' });
  });

  test('no confunde el turno abierto de otro usuario con el propio', async () => {
    mockState.docs['turno-otro'] = { uid: 'otro-uid', status: 'open' };
    const id = await ensureOpenTurno({ uid: 'u1', userName: 'Ana', role: 'vendedor' });
    expect(id).not.toBe('turno-otro');
    expect(mockState.docs[id].uid).toBe('u1');
  });
});

// ── FASE CC1 ────────────────────────────────────────────────────────────────
// Apertura automática atómica (puntero `cashSessions/{uid}`) y cálculo neto
// Opción B (ingresos - egresos). Ver audit-reports/fase-cash-closing-final.md.

describe('CC1 — puntero cashSessions y apertura automática', () => {
  test('el turno nace con monto inicial 0 y sin cobros reclamados', async () => {
    const id = await ensureOpenTurno({ uid: 'u9', userName: 'Ana', role: 'vendedor' });
    expect(mockState.docs[id]).toMatchObject({
      uid: 'u9', status: 'open', expectedAmount: 0, cashExpensesTotal: 0, collectionIds: [],
    });
  });

  test('deja el puntero apuntando al turno que acaba de abrir', async () => {
    const id = await ensureOpenTurno({ uid: 'u9', userName: 'Ana' });
    expect(mockState.docs.u9).toEqual({ openTurnoId: id });
  });

  test('un segundo cobro reutiliza el turno del puntero y no crea otro', async () => {
    const first = await ensureOpenTurno({ uid: 'u9', userName: 'Ana' });
    const creados = mockState.writes.filter((w) => w.payload?.status === 'open').length;

    const second = await ensureOpenTurno({ uid: 'u9', userName: 'Ana' });

    expect(second).toBe(first);
    expect(mockState.writes.filter((w) => w.payload?.status === 'open')).toHaveLength(creados);
  });

  test('un puntero que apunta a un turno ya cerrado no bloquea el siguiente turno', async () => {
    const first = await ensureOpenTurno({ uid: 'u9', userName: 'Ana' });
    mockState.docs[first].status = 'pending_review';

    const second = await ensureOpenTurno({ uid: 'u9', userName: 'Ana' });

    expect(second).not.toBe(first);
    expect(mockState.docs.u9).toEqual({ openTurnoId: second });
  });

  test('cerrar el turno libera el puntero', async () => {
    const id = await ensureOpenTurno({ uid: 'u9', userName: 'Ana' });

    await closeTurno({ id, uid: 'u9' }, [], []);

    expect(mockState.docs.u9).toEqual({ openTurnoId: null });
  });
});

describe('CC1 — neto del turno (Opción B: ingresos - egresos)', () => {
  const seedOpen = (uid = 'u1') => {
    mockState.docs['turno-n'] = { uid, userName: 'Ana', status: 'open' };
  };
  const seedIngreso = (id, amount, uid = 'u1', extra = {}) => {
    mockState.docs[id] = { uid, amount, turnoId: null, sourceType: 'creditAbono', ...extra };
  };
  const seedGasto = (id, amount, uid = 'u1') => {
    mockState.docs[id] = {
      createdByUid: uid, amount, paymentMethod: 'CASH', status: 'PENDING', cashClosingId: null,
    };
  };

  test('un abono de 500 da ingresos 500', async () => {
    seedOpen();
    seedIngreso('i1', 500);
    const r = await closeTurno({ id: 'turno-n' }, ['i1'], []);
    expect(r.expectedAmount).toBe(500);
    expect(r.cashExpensesTotal).toBe(0);
  });

  test('un gasto de 100 da egresos 100', async () => {
    seedOpen();
    seedGasto('g1', 100);
    const r = await closeTurno({ id: 'turno-n' }, [], ['g1']);
    expect(r.cashExpensesTotal).toBe(100);
  });

  test('500 de ingreso menos 100 de gasto da 400 neto', async () => {
    seedOpen();
    seedIngreso('i1', 500);
    seedGasto('g1', 100);
    const r = await closeTurno({ id: 'turno-n' }, ['i1'], ['g1']);
    expect(r.expectedAmount).toBe(400);
  });

  test('varios movimientos: 500 + 300 - 100 - 50 = 650', async () => {
    seedOpen();
    seedIngreso('i1', 500);
    seedIngreso('i2', 300, 'u1', { sourceType: 'presale' });
    seedGasto('g1', 100);
    seedGasto('g2', 50);
    const r = await closeTurno({ id: 'turno-n' }, ['i1', 'i2'], ['g1', 'g2']);
    expect(r.expectedAmount).toBe(650);
  });

  test('el cobro de OTRO usuario no entra en esta caja aunque la pantalla lo mande', async () => {
    seedOpen('u1');
    seedIngreso('mio', 500, 'u1');
    seedIngreso('ajeno', 999, 'u2');

    const r = await closeTurno({ id: 'turno-n' }, ['mio', 'ajeno'], []);

    expect(r.expectedAmount).toBe(500);
    expect(mockState.docs['turno-n'].collectionIds).toEqual(['mio']);
    expect(mockState.docs.ajeno.turnoId).toBeNull();
  });

  test('sin movimientos monetarios el turno cierra en 0 (una preventa no genera cobro)', async () => {
    seedOpen();
    const r = await closeTurno({ id: 'turno-n' }, [], []);
    expect(r.expectedAmount).toBe(0);
  });
});

// ── FASE CC3 ────────────────────────────────────────────────────────────────
// El admin ve el monto en vivo de cada caja abierta. En vez de seguir la caja
// de cada trabajador por separado, se traen todos los movimientos sin liquidar
// y se reparten por dueño en cliente.

describe('CC3 — groupAmountsByUid', () => {
  test('reparte cobros por dueño con sus ids y su suma', () => {
    const r = groupAmountsByUid([
      { id: 'c1', uid: 'u1', amount: 500 },
      { id: 'c2', uid: 'u1', amount: 300 },
      { id: 'c3', uid: 'u2', amount: 120 },
    ], 'uid');

    expect(r.u1).toEqual({ ids: ['c1', 'c2'], total: 800 });
    expect(r.u2).toEqual({ ids: ['c3'], total: 120 });
  });

  test('sirve igual para gastos, que llevan el dueño en createdByUid', () => {
    const r = groupAmountsByUid([
      { id: 'g1', createdByUid: 'u1', amount: 100 },
      { id: 'g2', createdByUid: 'u1', amount: 50 },
    ], 'createdByUid');

    expect(r.u1).toEqual({ ids: ['g1', 'g2'], total: 150 });
  });

  test('redondea a dos decimales, como el resto de los montos', () => {
    const r = groupAmountsByUid([
      { id: 'c1', uid: 'u1', amount: 100.1 },
      { id: 'c2', uid: 'u1', amount: 50.02 },
    ], 'uid');

    expect(r.u1.total).toBe(150.12);
  });

  test('ignora lo que no tiene dueño y trata como 0 lo que no es número', () => {
    const r = groupAmountsByUid([
      { id: 'c1', uid: null, amount: 999 },
      { id: 'c2', amount: 999 },
      { id: 'c3', uid: 'u1', amount: 'x' },
    ], 'uid');

    expect(Object.keys(r)).toEqual(['u1']);
    expect(r.u1).toEqual({ ids: ['c3'], total: 0 });
  });

  test('lista vacía o nula no rompe', () => {
    expect(groupAmountsByUid([], 'uid')).toEqual({});
    expect(groupAmountsByUid(null, 'uid')).toEqual({});
  });

  test('un usuario sin movimientos simplemente no aparece', () => {
    const r = groupAmountsByUid([{ id: 'c1', uid: 'u1', amount: 500 }], 'uid');
    expect(r.u2).toBeUndefined();
  });
});
