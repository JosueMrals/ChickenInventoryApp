/**
 * Historial de entregas bodega → entregador.
 *
 * El historial se deriva de la propia pre-venta. El punto delicado es que las dos
 * vías de despacho escribían timestamps distintos: la masiva `dispatchedAt` y la
 * individual (Cloud Function) `fechaEntregaRepartidor`. Ahora ambas escriben los
 * dos, pero el historial debe seguir leyendo las órdenes viejas.
 */

const mockState = { docs: [], lastQuery: null };

jest.mock('@react-native-firebase/firestore', () => {
  const chain = {
    where: function (field, op, value) {
      mockState.lastQuery.wheres.push({ field, op, value });
      return this;
    },
    orderBy: function (field, dir) {
      mockState.lastQuery.orderBy = { field, dir };
      return this;
    },
    onSnapshot: function (onNext) {
      onNext({ docs: mockState.docs.map((d) => ({ id: d.id, data: () => d })) });
      return () => {};
    },
  };
  const firestore = () => ({
    collection: (name) => {
      mockState.lastQuery = { collection: name, wheres: [], orderBy: null };
      return chain;
    },
  });
  return firestore;
});

const {
  getHandoverDate,
  subscribeHandovers,
} = require('../android/app/src/screens/Warehouse/services/handoverHistoryService');
const { groupItemsByProduct } = require('../android/app/src/utils/warehouseUtils');

const ts = (iso) => ({ toDate: () => new Date(iso) });

beforeEach(() => {
  mockState.docs = [];
  mockState.lastQuery = null;
});

describe('getHandoverDate', () => {
  test('usa dispatchedAt cuando está presente', () => {
    const date = getHandoverDate({ dispatchedAt: ts('2026-07-20T14:00:00') });
    expect(date.getHours()).toBe(14);
  });

  test('cae a fechaEntregaRepartidor en órdenes despachadas individualmente', () => {
    // Antes de normalizar, la Cloud Function solo escribía este campo.
    const date = getHandoverDate({ fechaEntregaRepartidor: ts('2026-07-20T09:30:00') });
    expect(date.getHours()).toBe(9);
  });

  test('prefiere dispatchedAt si existen ambos', () => {
    const date = getHandoverDate({
      dispatchedAt: ts('2026-07-20T14:00:00'),
      fechaEntregaRepartidor: ts('2026-07-20T09:00:00'),
    });
    expect(date.getHours()).toBe(14);
  });

  test('devuelve null si la orden nunca se entregó', () => {
    expect(getHandoverDate({})).toBeNull();
    expect(getHandoverDate(null)).toBeNull();
  });
});

describe('subscribeHandovers', () => {
  test('acota el rango en el query, no en JS', () => {
    const from = new Date('2026-07-20T00:00:00');
    const to = new Date('2026-07-20T23:59:59');

    subscribeHandovers(from, to, () => {});

    const { collection, wheres, orderBy } = mockState.lastQuery;
    expect(collection).toBe('presales');
    // Rango cerrado sobre el campo canónico: sin esto se descargarían meses de
    // preventas para mostrar un solo día.
    expect(wheres).toEqual([
      { field: 'dispatchedAt', op: '>=', value: from },
      { field: 'dispatchedAt', op: '<=', value: to },
    ]);
    expect(orderBy).toEqual({ field: 'dispatchedAt', dir: 'desc' });
  });

  test('entrega las preventas con su id', () => {
    mockState.docs = [{ id: 'o1', entregadorId: 'e1' }, { id: 'o2', entregadorId: 'e2' }];
    const received = [];

    subscribeHandovers(new Date(), new Date(), (docs) => received.push(...docs));

    expect(received.map((d) => d.id)).toEqual(['o1', 'o2']);
  });

  // Regresión: el historial mostraba entregas de TODAS las rutas sin importar
  // qué ruta tuviera seleccionada el bodeguero — inconsistente con el resto del
  // módulo (WarehouseDashboardScreen, MyDeliveriesScreen), que sí acota por ruta.
  test('con routeId, filtra por ruta ANTES del rango de fecha', () => {
    const from = new Date('2026-07-20T00:00:00');
    const to = new Date('2026-07-20T23:59:59');

    subscribeHandovers(from, to, () => {}, null, 'ruta-1');

    const { wheres } = mockState.lastQuery;
    expect(wheres[0]).toEqual({ field: 'routeId', op: '==', value: 'ruta-1' });
    expect(wheres).toContainEqual({ field: 'dispatchedAt', op: '>=', value: from });
    expect(wheres).toContainEqual({ field: 'dispatchedAt', op: '<=', value: to });
  });

  test('sin routeId (admin), no agrega filtro de ruta', () => {
    subscribeHandovers(new Date(), new Date(), () => {}, null, null);

    const hasRouteFilter = mockState.lastQuery.wheres.some((w) => w.field === 'routeId');
    expect(hasRouteFilter).toBe(false);
  });
});

describe('vista de productos del historial', () => {
  test('agrega productos y regalías de todas las órdenes entregadas', () => {
    const entregas = [
      {
        id: 'o1',
        items: [{ productName: 'Pollo entero', quantity: 5, status: 'ready' }],
        bonuses: [{ productName: 'Alitas', quantity: 1, status: 'ready' }],
      },
      {
        id: 'o2',
        items: [{ productName: 'Pollo entero', quantity: 3, status: 'pending' }],
        bonuses: [],
      },
    ];

    // Sin filtro de estado: en el historial ya todo fue entregado, el estado del
    // ítem al momento del despacho es irrelevante.
    const productos = groupItemsByProduct(entregas, null);
    const pollo = productos.find((p) => p.name === 'Pollo entero');

    expect(pollo.totalQty).toBe(8);
    expect(pollo.orderCount).toBe(2);

    const alitas = productos.find((p) => p.name === 'Alitas');
    expect(alitas.bonusQty).toBe(1);
    expect(alitas.regularQty).toBe(0);
  });
});
