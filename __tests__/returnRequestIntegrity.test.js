/**
 * FASE S1.5.1 — cierre de S1.5-F0 (CRITICAL) y S1.5-F1 (HIGH), ver
 * `audit-reports/fase-s1-5-0-return-requests-audit.md`.
 *
 * S1.5-F0: approveReturnRequest ya NO acepta un objeto `returnRequest` del
 * caller — no hay ningún parámetro por el que un cliente modificado pueda
 * indicar "aprueba ret-A pero aplica los datos de B". La única prueba posible
 * de ese cierre es demostrar que, aprobando una solicitud real, ninguna OTRA
 * pre-venta/producto resulta tocado — no hay superficie de ataque que simular
 * porque el parámetro que la habilitaba ya no existe.
 *
 * S1.5-F1: la cantidad restaurada a inventario ahora está acotada por
 * `getAvailableReturnQty` contra la pre-venta real releída en la transacción.
 */
const mockState = { docs: {}, writes: [] };

jest.mock('@react-native-firebase/firestore', () => {
  const firestore = () => ({
    collection: (name) => ({
      doc: (id = 'auto') => ({ path: `${name}/${id}`, id }),
      where: () => ({ where: () => ({ get: async () => ({ empty: true }) }) }),
    }),
    runTransaction: async (fn) => fn({
      get: async (ref) => ({
        ref,
        exists: () => !!mockState.docs[ref.path],
        data: () => mockState.docs[ref.path],
      }),
      update: (ref, payload) => {
        const current = mockState.docs[ref.path] || {};
        const resolved = {};
        Object.entries(payload).forEach(([key, value]) => {
          resolved[key] = value && typeof value === 'object' && '__increment' in value
            ? (Number(current[key]) || 0) + value.__increment
            : value;
        });
        mockState.docs[ref.path] = { ...current, ...resolved };
        mockState.writes.push({ path: ref.path, payload });
      },
      set: (ref, payload) => {
        mockState.docs[ref.path] = payload;
        mockState.writes.push({ path: ref.path, payload });
      },
    }),
  });
  firestore.FieldValue = {
    serverTimestamp: () => 'ts',
    increment: (n) => ({ __increment: n }),
  };
  return firestore;
});

jest.mock('@react-native-firebase/auth', () => () => ({
  currentUser: { uid: 'bod-1', email: 'bodega@test.com' },
}));

const { approveReturnRequest } = require('../android/app/src/services/returnService');

beforeEach(() => {
  mockState.docs = {};
  mockState.writes = [];
});

describe('S1.5-F0 — approveReturnRequest ya no acepta datos del caller (cross-document)', () => {
  test('aprobar ret-A solo toca presale-A; presale-B (real, distinta) queda intacta', async () => {
    mockState.docs['returnRequests/ret-A'] = {
      status: 'pending_review', presaleId: 'presale-A',
      items: [{ productId: 'p1', productName: 'Pollo', quantity: 1, unitPrice: 10 }], bonuses: [],
    };
    mockState.docs['presales/presale-A'] = {
      items: [{ productId: 'p1', productName: 'Pollo', quantity: 5, unitPrice: 10, total: 50 }],
      bonuses: [], subtotal: 50, total: 50, totalDiscount: 0, status: 'dispatched',
    };
    mockState.docs['presales/presale-B'] = {
      items: [{ productId: 'p2', productName: 'Res', quantity: 5, unitPrice: 20, total: 100 }],
      bonuses: [], subtotal: 100, total: 100, totalDiscount: 0, status: 'dispatched',
    };
    mockState.docs['products/p1'] = { stock: 0 };
    mockState.docs['products/p2'] = { stock: 0 };

    await approveReturnRequest({ returnRequestId: 'ret-A' });

    // presale-A: 1 de 5 unidades devuelta → total baja de 50 a 40.
    expect(mockState.docs['presales/presale-A'].total).toBe(40);
    // presale-B: ni un solo write — no hay parámetro por el que el caller
    // pudiera haber apuntado la aprobación de ret-A hacia ella.
    expect(mockState.docs['presales/presale-B'].total).toBe(100);
    expect(mockState.writes.some((w) => w.path === 'presales/presale-B')).toBe(false);
    // product de B tampoco se toca — la solicitud real de A nunca lo mencionó.
    expect(mockState.docs['products/p2'].stock).toBe(0);
  });
});

describe('S1.5-F1 — stock acotado contra la pre-venta real', () => {
  test('cantidad inflada (100) se acota a lo realmente facturado (1) — nunca stock += 100', async () => {
    mockState.docs['returnRequests/r1'] = {
      status: 'pending_review', presaleId: 'ps1',
      items: [{ productId: 'p1', productName: 'Pollo', quantity: 1, unitPrice: 10 }], bonuses: [],
    };
    mockState.docs['presales/ps1'] = {
      items: [{ productId: 'p1', productName: 'Pollo', quantity: 1, unitPrice: 10, total: 10 }],
      bonuses: [], subtotal: 10, total: 10, totalDiscount: 0, status: 'dispatched',
    };
    mockState.docs['products/p1'] = { stock: 5 };

    await approveReturnRequest({
      returnRequestId: 'r1',
      verifiedQuantities: { 'item-0-p1': 100 }, // bodega (o un cliente modificado) reporta 100 recibidas
    });

    expect(mockState.docs['products/p1'].stock).toBe(6); // 5 + 1, nunca 5 + 100
  });

  test('producto ajeno a la pre-venta (pB) no incrementa stock aunque la solicitud lo incluya', async () => {
    mockState.docs['returnRequests/r2'] = {
      status: 'pending_review', presaleId: 'ps2',
      items: [{ productId: 'pB', productName: 'Producto ajeno', quantity: 1, unitPrice: 10 }], bonuses: [],
    };
    mockState.docs['presales/ps2'] = {
      items: [{ productId: 'pA', productName: 'Pollo', quantity: 2, unitPrice: 10, total: 20 }],
      bonuses: [], subtotal: 20, total: 20, totalDiscount: 0, status: 'dispatched',
    };
    mockState.docs['products/pB'] = { stock: 5 };

    await approveReturnRequest({ returnRequestId: 'r2' });

    expect(mockState.docs['products/pB'].stock).toBe(5); // intacto
    expect(mockState.writes.some((w) => w.path === 'products/pB')).toBe(false);
  });

  test('cantidad exacta a lo facturado sí se restaura por completo', async () => {
    mockState.docs['returnRequests/r3'] = {
      status: 'pending_review', presaleId: 'ps3',
      items: [{ productId: 'p1', productName: 'Pollo', quantity: 3, unitPrice: 10 }], bonuses: [],
    };
    mockState.docs['presales/ps3'] = {
      items: [{ productId: 'p1', productName: 'Pollo', quantity: 3, unitPrice: 10, total: 30 }],
      bonuses: [], subtotal: 30, total: 30, totalDiscount: 0, status: 'dispatched',
    };
    mockState.docs['products/p1'] = { stock: 0 };

    await approveReturnRequest({ returnRequestId: 'r3' });

    expect(mockState.docs['products/p1'].stock).toBe(3);
  });

  test('entregadorId de un faltante viene del documento real, no de un valor arbitrario', async () => {
    mockState.docs['returnRequests/r4'] = {
      status: 'pending_review', presaleId: 'ps4', entregadorId: 'entregador-real',
      items: [{ productId: 'p1', productName: 'Pollo', quantity: 5, unitPrice: 10 }], bonuses: [],
    };
    mockState.docs['presales/ps4'] = {
      items: [{ productId: 'p1', productName: 'Pollo', quantity: 5, unitPrice: 10, total: 50 }],
      bonuses: [], subtotal: 50, total: 50, totalDiscount: 0, status: 'dispatched',
      entregadorId: 'entregador-real',
    };
    mockState.docs['products/p1'] = { stock: 0 };

    // Bodega verifica que solo llegaron 2 de las 5 esperadas → 3 de faltante.
    await approveReturnRequest({
      returnRequestId: 'r4',
      verifiedQuantities: { 'item-0-p1': 2 },
    });

    const shortageWrite = mockState.writes.find((w) => w.path.startsWith('deliveryShortages/'));
    expect(shortageWrite.payload.entregadorId).toBe('entregador-real');
    expect(shortageWrite.payload.totalMissingQty).toBe(3);
  });
});
