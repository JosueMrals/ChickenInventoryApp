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
