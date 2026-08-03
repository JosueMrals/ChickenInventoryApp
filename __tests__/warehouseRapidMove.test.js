/**
 * Regresión: en el Panel de Control de bodega, dos toques rápidos sobre el mismo
 * producto (PENDIENTE→EN PROCESO e inmediatamente EN PROCESO→LISTO) perdían el
 * segundo movimiento: su transacción releía el estado ANTERIOR a que el primero
 * confirmara, no encontraba nada en `fromStatus` y se descartaba en silencio.
 * El listener luego reconciliaba la UI y el producto "se regresaba" solo.
 *
 * Contrato fijado aquí:
 *  - las llamadas se confirman EN ORDEN (cola local de escrituras);
 *  - con `candidateIds` (los ids que la pantalla conoce por su listener en vivo)
 *    no se consulta la colección completa;
 *  - la relectura dentro de la transacción sigue descartando órdenes terminales.
 */

const mockState = { docs: {}, writes: [], queries: 0 };

jest.mock('@react-native-firebase/firestore', () => {
  const firestore = () => ({
    collection: () => ({
      doc: (id) => ({ id }),
      where: function () { return this; },
      get: async () => {
        mockState.queries += 1;
        return { docs: [] };
      },
    }),
    runTransaction: async (fn) => fn({
      // Instantánea AL MOMENTO de leer, como el servidor real: una escritura que
      // llegue después de este get no es visible dentro de la transacción.
      get: async (ref) => {
        const raw = mockState.docs[ref.id];
        const snapshot = raw ? JSON.parse(JSON.stringify(raw)) : null;
        // Ventana de carrera: sin la cola, la segunda llamada lee antes de que
        // la primera confirme.
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { ref, exists: () => !!snapshot, data: () => snapshot };
      },
      update: (ref, payload) => {
        mockState.docs[ref.id] = { ...mockState.docs[ref.id], ...payload };
        mockState.writes.push({ id: ref.id, payload });
      },
    }),
  });
  firestore.FieldValue = { serverTimestamp: () => 'ts', increment: (n) => n };
  firestore.Timestamp = { now: () => 'ts' };
  return firestore;
});

jest.mock('@react-native-firebase/auth', () => () => ({
  currentUser: { uid: 'bodeguero-1', email: 'bodega@test.com' },
}));

const { updateAggregateProductStatus } = require('../android/app/src/services/preSaleService');

const orden = (status, itemStatus = 'pending') => ({
  status,
  paymentMethod: 'cash',
  items: [{ productName: 'Pollo entero', quantity: 2, status: itemStatus }],
  bonuses: [],
});

beforeEach(() => {
  mockState.docs = {};
  mockState.writes = [];
  mockState.queries = 0;
});

test('dos movimientos rápidos consecutivos se confirman en orden, sin perder el segundo', async () => {
  mockState.docs = { o1: orden('pending') };

  // Disparadas sin esperar entre sí, como dos toques seguidos en la pantalla.
  const p1 = updateAggregateProductStatus('Pollo entero', 'preparing', 'pending', { candidateIds: ['o1'] });
  const p2 = updateAggregateProductStatus('Pollo entero', 'ready', 'preparing', { candidateIds: ['o1'] });

  expect(await p1).toBe(1);
  expect(await p2).toBe(1);
  expect(mockState.docs.o1.items[0].status).toBe('ready');
  expect(mockState.docs.o1.status).toBe('ready_for_delivery');
});

test('con candidateIds no se consulta la colección de pre-ventas', async () => {
  mockState.docs = { o1: orden('pending') };

  const count = await updateAggregateProductStatus('Pollo entero', 'preparing', 'pending', { candidateIds: ['o1'] });

  expect(count).toBe(1);
  expect(mockState.queries).toBe(0);
});

test('una orden cobrada pasada como candidata no se toca', async () => {
  mockState.docs = { o1: orden('paid', 'ready') };

  const count = await updateAggregateProductStatus('Pollo entero', 'preparing', 'pending', { candidateIds: ['o1'] });

  expect(count).toBe(0);
  expect(mockState.writes).toHaveLength(0);
});
