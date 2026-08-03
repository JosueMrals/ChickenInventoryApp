/**
 * Panel de Control de bodega: movimiento masivo de productos.
 *
 * El botón "mover todo" (etapa completa o una categoría) manda un ARREGLO de
 * nombres. Lo importante es que eso siga siendo una sola pasada sobre las
 * órdenes —no una consulta por producto— y que conserve las mismas guardas que
 * el movimiento individual: no tocar órdenes ya cobradas o devueltas.
 */

const mockState = { docs: {}, writes: [], queries: 0 };

jest.mock('@react-native-firebase/firestore', () => {
  const firestore = () => ({
    collection: () => ({
      doc: (id) => ({ id }),
      where: function () { return this; },
      get: async () => {
        mockState.queries += 1;
        return {
          docs: Object.keys(mockState.docs).map((id) => ({
            ref: { id },
            data: () => mockState.docs[id],
          })),
        };
      },
    }),
    runTransaction: async (fn) => fn({
      get: async (ref) => ({
        ref,
        exists: () => !!mockState.docs[ref.id],
        data: () => mockState.docs[ref.id],
      }),
      update: (ref, payload) => mockState.writes.push({ id: ref.id, payload }),
    }),
  });
  firestore.FieldValue = { serverTimestamp: () => 'ts', increment: (n) => n, delete: () => null };
  firestore.Timestamp = { now: () => 'ts', fromDate: (d) => d };
  return firestore;
});

jest.mock('@react-native-firebase/auth', () => () => ({
  currentUser: { uid: 'bodeguero-1', email: 'bodega@test.com' },
}));

const { updateAggregateProductStatus } = require('../android/app/src/services/preSaleService');
const { groupItemsByProduct } = require('../android/app/src/utils/warehouseUtils');

const orden = (status, items) => ({ status, paymentMethod: 'cash', items, bonuses: [] });
const linea = (productName, quantity = 1, status = 'pending') => ({ productName, quantity, status });

beforeEach(() => {
  mockState.docs = {};
  mockState.writes = [];
  mockState.queries = 0;
});

describe('movimiento masivo de productos', () => {
  test('mueve varios productos en UNA sola consulta', async () => {
    mockState.docs = {
      o1: orden('preparing', [linea('Pollo entero'), linea('Pechuga')]),
      o2: orden('preparing', [linea('Alitas')]),
    };

    const count = await updateAggregateProductStatus(
      ['Pollo entero', 'Pechuga', 'Alitas'], 'ready', 'pending',
    );

    expect(count).toBe(2);            // dos órdenes tocadas
    expect(mockState.queries).toBe(1); // ...con una sola consulta, no una por producto
    const o1 = mockState.writes.find((w) => w.id === 'o1');
    expect(o1.payload.items.every((i) => i.status === 'ready')).toBe(true);
  });

  test('solo mueve los productos indicados, no toda la orden', async () => {
    mockState.docs = { o1: orden('preparing', [linea('Pollo entero'), linea('Pechuga')]) };

    await updateAggregateProductStatus(['Pollo entero'], 'ready', 'pending');

    const { items } = mockState.writes[0].payload;
    expect(items.find((i) => i.productName === 'Pollo entero').status).toBe('ready');
    expect(items.find((i) => i.productName === 'Pechuga').status).toBe('pending');
  });

  test('la guarda de estados terminales sigue aplicando en masa', async () => {
    mockState.docs = {
      activa: orden('preparing', [linea('Pollo entero')]),
      cobrada: orden('paid', [linea('Pollo entero')]),
      devuelta: orden('returned', [linea('Pollo entero')]),
    };

    const count = await updateAggregateProductStatus(['Pollo entero'], 'ready', 'pending');

    expect(count).toBe(1);
    expect(mockState.writes.map((w) => w.id)).toEqual(['activa']);
  });

  test('acepta un nombre suelto (movimiento individual sin cambios)', async () => {
    mockState.docs = { o1: orden('pending', [linea('Pollo entero')]) };

    const count = await updateAggregateProductStatus('Pollo entero', 'preparing', 'pending');

    expect(count).toBe(1);
    expect(mockState.writes[0].payload.items[0].status).toBe('preparing');
  });

  test('una lista vacía no dispara ninguna consulta', async () => {
    mockState.docs = { o1: orden('pending', [linea('Pollo entero')]) };

    const count = await updateAggregateProductStatus([], 'preparing', 'pending');

    expect(count).toBe(0);
    expect(mockState.queries).toBe(0);
    expect(mockState.writes).toHaveLength(0);
  });
});

describe('groupItemsByProduct: en cuántas órdenes aparece cada producto', () => {
  test('cuenta órdenes distintas, no líneas', async () => {
    const preSales = [
      { id: 'o1', items: [linea('Pollo entero', 5)], bonuses: [] },
      { id: 'o2', items: [linea('Pollo entero', 3)], bonuses: [] },
      { id: 'o3', items: [linea('Pechuga', 2)], bonuses: [] },
    ];

    const productos = groupItemsByProduct(preSales, 'pending');
    const pollo = productos.find((p) => p.name === 'Pollo entero');

    expect(pollo.totalQty).toBe(8);
    expect(pollo.orderCount).toBe(2);
    expect(productos.find((p) => p.name === 'Pechuga').orderCount).toBe(1);
  });
});
