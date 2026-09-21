/**
 * Idempotencia en devoluciones: editar, eliminar, rechazar o aprobar una
 * solicitud debe decidir con el estado RELEÍDO del servidor, no con la copia
 * que trajo el listener en vivo (o una escritura encolada offline).
 *
 * El caso más grave: dos aprobaciones de la misma solicitud (doble tap sin
 * red, o dos bodegueros con la misma tarjeta abierta) restauraban el stock
 * DOS veces. Se fija aquí que la segunda aprobación se rechaza y no toca stock.
 */

const mockState = { docs: {}, writes: [], deletes: [] };

jest.mock('@react-native-firebase/firestore', () => {
  const firestore = () => ({
    collection: () => ({
      doc: (id) => ({ id }),
    }),
    runTransaction: async (fn) => fn({
      get: async (ref) => ({
        ref,
        exists: () => !!mockState.docs[ref.id],
        data: () => mockState.docs[ref.id],
      }),
      update: (ref, payload) => {
        const current = mockState.docs[ref.id] || {};
        const resolved = {};
        Object.entries(payload).forEach(([key, value]) => {
          resolved[key] = value && value.__increment != null
            ? (Number(current[key]) || 0) + value.__increment
            : value;
        });
        mockState.docs[ref.id] = { ...current, ...resolved };
        mockState.writes.push({ id: ref.id, payload });
      },
      delete: (ref) => mockState.deletes.push(ref.id),
    }),
  });
  firestore.FieldValue = { serverTimestamp: () => 'ts', increment: (n) => ({ __increment: n }) };
  return firestore;
});

jest.mock('@react-native-firebase/auth', () => () => ({
  currentUser: { uid: 'bodeguero-1', email: 'bodega@test.com' },
}));

const {
  updateReturnRequest,
  deleteReturnRequest,
  rejectReturnRequest,
  approveReturnRequest,
} = require('../android/app/src/services/returnService');

beforeEach(() => {
  mockState.docs = {};
  mockState.writes = [];
  mockState.deletes = [];
});

describe('updateReturnRequest', () => {
  test('rechaza editar una solicitud ya aprobada', async () => {
    mockState.docs.r1 = { status: 'approved' };

    await expect(
      updateReturnRequest({ returnRequestId: 'r1', reason: 'motivo', items: [{ productId: 'p1', quantity: 1 }] })
    ).rejects.toThrow(/aprobada/);
    expect(mockState.writes).toHaveLength(0);
  });

  test('permite editar mientras siga pendiente', async () => {
    mockState.docs.r1 = { status: 'pending_review' };

    await updateReturnRequest({ returnRequestId: 'r1', reason: 'motivo', items: [{ productId: 'p1', quantity: 1 }] });

    expect(mockState.writes[0].payload).toMatchObject({ reason: 'motivo' });
  });
});

describe('deleteReturnRequest', () => {
  test('rechaza eliminar una solicitud ya rechazada', async () => {
    mockState.docs.r1 = { status: 'rejected' };

    await expect(deleteReturnRequest('r1')).rejects.toThrow(/rechazada/);
    expect(mockState.deletes).toHaveLength(0);
  });

  test('elimina mientras siga pendiente', async () => {
    mockState.docs.r1 = { status: 'pending_review' };

    await deleteReturnRequest('r1');

    expect(mockState.deletes).toContain('r1');
  });
});

describe('rejectReturnRequest', () => {
  test('rechaza resolver una solicitud ya aprobada', async () => {
    mockState.docs.r1 = { status: 'approved' };

    await expect(
      rejectReturnRequest({ returnRequestId: 'r1', rejectionNote: 'nota' })
    ).rejects.toThrow(/aprobada/);
    expect(mockState.writes).toHaveLength(0);
  });

  test('rechaza mientras siga pendiente', async () => {
    mockState.docs.r1 = { status: 'pending_review' };

    await rejectReturnRequest({ returnRequestId: 'r1', rejectionNote: 'nota' });

    expect(mockState.docs.r1.status).toBe('rejected');
  });
});

describe('approveReturnRequest', () => {
  // FASE S1.5.1 (S1.5-F0): ya no hay un objeto `returnRequest` de parámetro —
  // approveReturnRequest lee `items`/`bonuses`/`presaleId` del propio doc
  // releído (`mockState.docs.r1`), así que el doc debe traer esos campos como
  // los traería `createReturnRequest` en producción. Sin presaleId no hay
  // pre-venta contra la cual acotar (getAvailableReturnQty devuelve 0), así
  // que se agrega una pre-venta real con la misma cantidad para no romper el
  // caso "aprueba normalmente" con el tope nuevo de S1.5-F1.
  beforeEach(() => {
    mockState.docs.ps1 = {
      items: [{ productId: 'p1', productName: 'Pollo', quantity: 2, unitPrice: 50, total: 100 }],
      bonuses: [], subtotal: 100, total: 100, totalDiscount: 0, status: 'dispatched',
    };
  });

  test('aprueba normalmente desde pending_review y restaura stock una vez', async () => {
    mockState.docs.r1 = {
      status: 'pending_review', presaleId: 'ps1',
      items: [{ productId: 'p1', productName: 'Pollo', quantity: 2, unitPrice: 50 }],
      bonuses: [],
    };
    mockState.docs.p1 = { stock: 10 };

    await approveReturnRequest({ returnRequestId: 'r1' });

    expect(mockState.docs.r1.status).toBe('approved');
    expect(mockState.docs.p1.stock).toBe(12); // 10 + 2, una sola vez
  });

  test('rechaza una segunda aprobación y NO duplica la restauración de stock', async () => {
    // El servidor ya la tiene aprobada (p.ej. otro bodeguero se adelantó); el
    // stock ya se restauró en esa primera aprobación.
    mockState.docs.r1 = {
      status: 'approved', presaleId: 'ps1',
      items: [{ productId: 'p1', productName: 'Pollo', quantity: 2, unitPrice: 50 }],
      bonuses: [],
    };
    mockState.docs.p1 = { stock: 12 };

    await expect(
      approveReturnRequest({ returnRequestId: 'r1' })
    ).rejects.toThrow(/aprobada/);

    expect(mockState.docs.p1.stock).toBe(12); // sin cambio: no se dobló
  });
});
