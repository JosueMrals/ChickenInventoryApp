/**
 * Regresión: una preventa ya cobrada (o devuelta) volvía a "pendiente".
 *
 * Causa: bodega escribía con batch.update(), que es una escritura ciega — se
 * arma con los datos leídos antes y no vuelve a comprobar nada al confirmarse.
 * Sin señal, esa escritura quedaba encolada y se reproducía al reconectar,
 * pisando el estado nuevo escrito entretanto por la Cloud Function de cobro o
 * por la aprobación de una devolución.
 *
 * Estos tests fijan el contrato: lo que decide es el estado RELEÍDO dentro de
 * la transacción, no el que se leyó al abrir la pantalla. `mockState.docs`
 * representa el servidor al momento de confirmar.
 */

const mockState = { docs: {}, writes: [], failIds: new Set() };

jest.mock('@react-native-firebase/firestore', () => {
  const firestore = () => ({
    collection: () => ({
      doc: (id) => ({ id }),
      where: function () { return this; },
      // La consulta previa solo aporta candidatos (sin señal sale de caché).
      // Un QueryDocumentSnapshot real expone `ref` y `data()`.
      get: async () => ({
        docs: Object.keys(mockState.docs).map((id) => ({
          ref: { id },
          data: () => mockState.docs[id],
        })),
      }),
    }),
    runTransaction: async (fn) => fn({
      // Un DocumentSnapshot real expone `ref`; el código lo usa para escribir.
      // `failIds` simula contención: la transacción de ese documento se aborta.
      get: async (ref) => {
        if (mockState.failIds.has(ref.id)) throw new Error('aborted: contention');
        return {
          ref,
          exists: () => !!mockState.docs[ref.id],
          data: () => mockState.docs[ref.id],
        };
      },
      update: (ref, payload) => mockState.writes.push({ id: ref.id, payload }),
    }),
  });
  firestore.FieldValue = { serverTimestamp: () => 'ts', increment: (n) => n };
  firestore.Timestamp = { now: () => 'ts' };
  return firestore;
});

jest.mock('@react-native-firebase/auth', () => () => ({
  currentUser: { uid: 'bodeguero-1', email: 'bodega@test.com' },
}));

const {
  updateAggregateProductStatus,
  updatePreSaleStatusGuarded,
  deletePreSaleInFirestore,
  TERMINAL_PRESALE_STATUSES,
} = require('../android/app/src/services/preSaleService');

const setServerDocs = (docs) => { mockState.docs = docs; };

beforeEach(() => {
  mockState.docs = {};
  mockState.writes = [];
  mockState.failIds = new Set();
});

describe('updatePreSaleStatusGuarded', () => {
  test('rechaza devolver a pendiente una preventa ya cobrada', async () => {
    setServerDocs({ v1: { status: 'paid', paymentMethod: 'cash' } });

    await expect(updatePreSaleStatusGuarded('v1', 'pending')).rejects.toThrow(/paid/);
    expect(mockState.writes).toHaveLength(0);
  });

  test('rechaza reescribir una factura con devolución aprobada', async () => {
    setServerDocs({ v1: { status: 'partially_returned', paymentMethod: 'cash' } });

    await expect(updatePreSaleStatusGuarded('v1', 'preparing')).rejects.toThrow(/partially_returned/);
    expect(mockState.writes).toHaveLength(0);
  });

  test('permite el avance normal de bodega', async () => {
    setServerDocs({ v1: { status: 'pending', paymentMethod: 'cash' } });

    await expect(updatePreSaleStatusGuarded('v1', 'preparing')).resolves.toBe('preparing');
    expect(mockState.writes).toHaveLength(1);
    expect(mockState.writes[0].payload).toMatchObject({ status: 'preparing' });
  });

  // Regresión: "Empezar Preparación" / "Marcar Lista" (detalle de la orden) y los
  // swipes del panel movían SOLO el estado de la orden. El Panel de Control agrupa
  // por `items[].status`, así que los productos se quedaban en la pestaña anterior.
  describe('arrastra el estado de los productos', () => {
    const conProductos = (status) => ({
      status,
      paymentMethod: 'cash',
      items: [
        { productName: 'Pollo entero', quantity: 2, status: 'pending' },
        { productName: 'Pechuga', quantity: 1, status: 'pending' },
      ],
      bonuses: [{ productName: 'Alitas', quantity: 1, status: 'pending' }],
    });

    test('Empezar Preparación pasa todos los productos a "preparing"', async () => {
      setServerDocs({ v1: conProductos('pending') });

      await updatePreSaleStatusGuarded('v1', 'preparing');

      const { payload } = mockState.writes[0];
      expect(payload.items.map((i) => i.status)).toEqual(['preparing', 'preparing']);
      expect(payload.bonuses.map((b) => b.status)).toEqual(['preparing']);
      // No debe perder el resto de la línea.
      expect(payload.items[0]).toMatchObject({ productName: 'Pollo entero', quantity: 2 });
    });

    test('Marcar Lista para Entrega pasa los productos a "ready"', async () => {
      setServerDocs({ v1: conProductos('preparing') });

      await updatePreSaleStatusGuarded('v1', 'ready_for_delivery');

      const { payload } = mockState.writes[0];
      expect(payload.items.every((i) => i.status === 'ready')).toBe(true);
      expect(payload.bonuses.every((b) => b.status === 'ready')).toBe(true);
    });

    test('regresar la orden a Pendiente devuelve los productos a "pending"', async () => {
      const doc = conProductos('preparing');
      doc.items = doc.items.map((i) => ({ ...i, status: 'ready' }));
      doc.bonuses = doc.bonuses.map((b) => ({ ...b, status: 'ready' }));
      setServerDocs({ v1: doc });

      await updatePreSaleStatusGuarded('v1', 'pending');

      const { payload } = mockState.writes[0];
      expect(payload.items.every((i) => i.status === 'pending')).toBe(true);
      expect(payload.bonuses.every((b) => b.status === 'pending')).toBe(true);
    });

    test('las órdenes a crédito usan el mismo estado por producto', async () => {
      setServerDocs({ v1: { ...conProductos('credit_pending'), paymentMethod: 'credit' } });

      await updatePreSaleStatusGuarded('v1', 'credit_ready_for_delivery');

      const { payload } = mockState.writes[0];
      expect(payload.status).toBe('credit_ready_for_delivery');
      expect(payload.items.every((i) => i.status === 'ready')).toBe(true);
    });
  });
});

describe('updateAggregateProductStatus', () => {
  const withItem = (status, quantity = 2) => ({
    status,
    paymentMethod: 'cash',
    items: [{ productName: 'Pollo entero', quantity, status: 'pending' }],
    bonuses: [],
  });

  test('no pisa una preventa cobrada entre la lectura y la confirmación', async () => {
    // La caché la traía como 'preparing'; en el servidor ya está cobrada.
    setServerDocs({ v1: withItem('paid') });

    const count = await updateAggregateProductStatus('Pollo entero', 'ready', 'pending');

    expect(count).toBe(0);
    expect(mockState.writes).toHaveLength(0);
  });

  test('no restaura los ítems viejos de una factura ya devuelta', async () => {
    setServerDocs({ v1: withItem('returned', 10) });

    const count = await updateAggregateProductStatus('Pollo entero', 'ready', 'pending');

    expect(count).toBe(0);
    expect(mockState.writes).toHaveLength(0);
  });

  test('sí actualiza las órdenes que siguen activas', async () => {
    setServerDocs({ v1: withItem('preparing') });

    const count = await updateAggregateProductStatus('Pollo entero', 'ready', 'pending');

    expect(count).toBe(1);
    expect(mockState.writes).toHaveLength(1);
    // Todos los ítems listos → la orden pasa a lista para entrega.
    expect(mockState.writes[0].payload).toMatchObject({ status: 'ready_for_delivery' });
    expect(mockState.writes[0].payload.items[0].status).toBe('ready');
  });

  test('una orden activa y una cobrada: solo se escribe la activa', async () => {
    setServerDocs({ activa: withItem('preparing', 1), cobrada: withItem('paid', 1) });

    const count = await updateAggregateProductStatus('Pollo entero', 'ready', 'pending');

    expect(count).toBe(1);
    expect(mockState.writes.map((w) => w.id)).toEqual(['activa']);
  });

  // Regresión de "los productos se devuelven solos": con la transacción única que
  // leía TODAS las órdenes, la contención en UNA abortaba TODAS y la UI revertía.
  // Con transacción por documento, el fallo de una no arrastra a las demás.
  test('si una orden aborta por contención, las otras igual se escriben', async () => {
    setServerDocs({
      o1: withItem('preparing'),
      o2: withItem('preparing'),
      o3: withItem('preparing'),
    });
    mockState.failIds = new Set(['o2']);   // o2 aborta

    const count = await updateAggregateProductStatus('Pollo entero', 'ready', 'pending');

    expect(count).toBe(2);
    expect(mockState.writes.map((w) => w.id).sort()).toEqual(['o1', 'o3']);
  });
});

// Una factura cobrada o con devolución aprobada no puede cancelarse: restauraría
// stock que ya salió del inventario (o que la devolución ya repuso). El guard
// decide con el estado releído en la transacción, aunque la pantalla la mostrara
// como pendiente por caché vieja.
describe('deletePreSaleInFirestore: terminales bloqueados', () => {
  test.each(['paid', 'partially_returned', 'returned'])('rechaza cancelar una preventa en estado %s', async (status) => {
    setServerDocs({ v1: { status, items: [], bonuses: [], inventoryDeducted: true } });

    await expect(
      deletePreSaleInFirestore({ preSaleId: 'v1', reason: 'prueba' })
    ).rejects.toThrow(/No se puede eliminar/);
    expect(mockState.writes).toHaveLength(0);
  });
});

test('el conjunto terminal cubre los estados del reporte', () => {
  ['paid', 'returned', 'partially_returned', 'dispatched', 'credit_dispatched', 'cancelled', 'delivered']
    .forEach((s) => expect(TERMINAL_PRESALE_STATUSES.has(s)).toBe(true));

  // Bodega debe seguir pudiendo trabajar sus estados.
  ['pending', 'preparing', 'ready_for_delivery', 'credit_pending', 'credit_preparing']
    .forEach((s) => expect(TERMINAL_PRESALE_STATUSES.has(s)).toBe(false));
});
