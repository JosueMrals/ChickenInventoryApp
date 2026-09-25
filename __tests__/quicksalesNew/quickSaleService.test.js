/**
 * quickSaleService.registerQuickSaleFull — tests reales (sin mockear la función).
 * Un mock de Firestore modela el store (products, sales, inventoryMovements, credits,
 * counters) y soporta tanto batch() (implementación previa) como runTransaction()
 * (implementación objetivo de FASE 21), para poder correr esta misma suite antes y
 * después del fix y comparar honestamente.
 */

const mockDb = {
  data: { products: {}, counters: {}, sales: {}, inventoryMovements: {}, credits: {} },
  writes: [],
};

jest.mock('@react-native-firebase/firestore', () => {
  let autoId = 0;
  const makeRef = (collection, id) => ({ collection, id: id != null ? id : `auto-${++autoId}` });

  const resolveIncrements = (ref, payload) => {
    const coll = mockDb.data[ref.collection] || {};
    const current = coll[ref.id] || {};
    const resolved = {};
    Object.entries(payload).forEach(([k, v]) => {
      if (v && typeof v === 'object' && '__increment' in v) {
        resolved[k] = (Number(current[k]) || 0) + v.__increment;
      } else {
        resolved[k] = v;
      }
    });
    return resolved;
  };

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
    const resolved = resolveIncrements(ref, payload);
    coll[ref.id] = { ...(coll[ref.id] || {}), ...resolved };
    mockDb.writes.push({ op: 'update', collection: ref.collection, id: ref.id, payload });
  };

  const txApi = { get: doGet, set: doSet, update: doUpdate };

  const makeBatch = () => {
    const ops = [];
    return {
      set: (ref, payload) => ops.push(() => doSet(ref, payload)),
      update: (ref, payload) => ops.push(() => doUpdate(ref, payload)),
      commit: async () => { ops.forEach((op) => op()); },
    };
  };

  const firestore = () => ({
    collection: (name) => ({
      doc: (id) => makeRef(name, id),
      where: (field, op, value) => ({
        get: async () => {
          if (op !== 'in') return { forEach: () => {} };
          const coll = mockDb.data[name] || {};
          const docs = value.filter((id) => coll[id]).map((id) => ({ id, data: () => coll[id] }));
          return { forEach: (cb) => docs.forEach(cb) };
        },
      }),
    }),
    runTransaction: async (fn) => fn(txApi),
    batch: () => makeBatch(),
  });
  firestore.FieldValue = {
    serverTimestamp: () => 'ts',
    increment: (n) => ({ __increment: n }),
  };
  firestore.FieldPath = { documentId: () => '__name__' };
  return firestore;
});

jest.mock('@react-native-firebase/auth', () => () => ({
  currentUser: { uid: 'vendedor-1', email: 'vendedor@test.com' },
}));

const { registerQuickSaleFull } = require('../../android/app/src/screens/quicksalesNew/services/quickSaleService');

const resetDb = () => {
  mockDb.data = { products: {}, counters: {}, sales: {}, inventoryMovements: {}, credits: {} };
  mockDb.writes = [];
};

const movementsWritten = () => mockDb.writes.filter((w) => w.collection === 'inventoryMovements');
const salesWritten = () => mockDb.writes.filter((w) => w.collection === 'sales');

const cartItem = (overrides = {}) => ({
  id: overrides.id ?? 'p1',
  product: { id: 'p1', name: 'Pollo entero', purchasePrice: 5, ...overrides.product },
  quantity: overrides.quantity ?? 4,
  unitPrice: overrides.unitPrice ?? 10,
  discount: overrides.discount ?? 0,
  total: overrides.total ?? (overrides.quantity ?? 4) * (overrides.unitPrice ?? 10),
  isBonus: false,
  ...overrides,
});

beforeEach(resetDb);

describe('registerQuickSaleFull', () => {
  test('Test A — stock suficiente: crea la venta y descuenta el stock exacto', async () => {
    mockDb.data.products = { p1: { name: 'Pollo entero', stock: 10, purchasePrice: 5 } };

    const saleId = await registerQuickSaleFull({
      cart: [cartItem({ quantity: 4 })],
      subtotal: 40,
      total: 40,
      paymentMethod: 'cash',
      amountPaid: 40,
      change: 0,
    });

    expect(saleId).toBeTruthy();
    expect(mockDb.data.products.p1.stock).toBe(6);
    expect(salesWritten()).toHaveLength(1);
  });

  test('Test B — stock exactamente igual a la cantidad: venta permitida, stock queda en 0', async () => {
    mockDb.data.products = { p1: { name: 'Pollo entero', stock: 4, purchasePrice: 5 } };

    await registerQuickSaleFull({
      cart: [cartItem({ quantity: 4 })],
      subtotal: 40,
      total: 40,
      paymentMethod: 'cash',
      amountPaid: 40,
      change: 0,
    });

    expect(mockDb.data.products.p1.stock).toBe(0);
  });

  test('Test C — stock insuficiente: la operación debe rechazarse por completo', async () => {
    mockDb.data.products = { p1: { name: 'Pollo entero', stock: 4, purchasePrice: 5 } };

    await expect(
      registerQuickSaleFull({
        cart: [cartItem({ quantity: 5 })],
        subtotal: 50,
        total: 50,
        paymentMethod: 'cash',
        amountPaid: 50,
        change: 0,
      })
    ).rejects.toThrow(/stock insuficiente/i);

    // No debe quedar stock negativo, ni venta, ni movimiento, ni crédito.
    expect(mockDb.data.products.p1.stock).toBe(4);
    expect(salesWritten()).toHaveLength(0);
    expect(movementsWritten()).toHaveLength(0);
    expect(Object.keys(mockDb.data.credits)).toHaveLength(0);
  });

  test('Test D — venta normal genera inventoryMovements con type "sale"', async () => {
    mockDb.data.products = { p1: { name: 'Pollo entero', stock: 10, purchasePrice: 5 } };

    const saleId = await registerQuickSaleFull({
      cart: [cartItem({ quantity: 4 })],
      subtotal: 40,
      total: 40,
      paymentMethod: 'cash',
      amountPaid: 40,
      change: 0,
    });

    const saleMovements = movementsWritten().filter((m) => m.payload.type === 'sale');
    expect(saleMovements).toHaveLength(1);
    expect(saleMovements[0].payload).toMatchObject({
      productId: 'p1',
      quantity: 4,
      relatedSaleId: saleId,
    });
  });

  test('Test E — bonus: sigue generando inventoryMovements con type "BONUS_OUT" sin cambios', async () => {
    mockDb.data.products = {
      p1: { name: 'Pollo entero', stock: 20, purchasePrice: 5, bonusEnabled: true },
    };

    const bonusItem = cartItem({
      id: 'p1_bonus',
      quantity: 2,
      unitPrice: 0,
      discount: 0,
      total: 0,
      isBonus: true,
    });

    await registerQuickSaleFull({
      cart: [cartItem({ quantity: 8 }), bonusItem],
      subtotal: 80,
      total: 80,
      paymentMethod: 'cash',
      amountPaid: 80,
      change: 0,
    });

    const bonusMovements = movementsWritten().filter((m) => m.payload.type === 'BONUS_OUT');
    expect(bonusMovements).toHaveLength(1);
    expect(bonusMovements[0].payload).toMatchObject({
      productId: 'p1',
      quantity: 2,
      reason: 'Bonificación comercial',
    });
    // 8 de venta normal + 2 de bono = 10 unidades descontadas del mismo producto.
    expect(mockDb.data.products.p1.stock).toBe(10);
  });

  test('Test F — atomicidad: si la validación de stock falla, no queda ningún efecto parcial', async () => {
    mockDb.data.products = {
      p1: { name: 'Pollo entero', stock: 10, purchasePrice: 5 },
      p2: { name: 'Pechuga', stock: 1, purchasePrice: 3 },
    };

    await expect(
      registerQuickSaleFull({
        cart: [
          cartItem({ id: 'p1', product: { id: 'p1', name: 'Pollo entero' }, quantity: 3 }),
          cartItem({ id: 'p2', product: { id: 'p2', name: 'Pechuga' }, quantity: 5 }), // insuficiente
        ],
        subtotal: 80,
        total: 80,
        paymentMethod: 'cash',
        amountPaid: 80,
        change: 0,
      })
    ).rejects.toThrow(/stock insuficiente/i);

    // p1 tenía stock de sobra pero NO debió tocarse: todo o nada.
    expect(mockDb.data.products.p1.stock).toBe(10);
    expect(mockDb.data.products.p2.stock).toBe(1);
    expect(salesWritten()).toHaveLength(0);
    expect(movementsWritten()).toHaveLength(0);
  });

  test.skip('Concurrencia real (stock=5, dos ventas de 4 simultáneas) — requiere Firebase Emulator', () => {
    // El mock de Firestore de este archivo ejecuta runTransaction() de forma
    // secuencial e inmediata: no reproduce el mecanismo real de Firestore de
    // detección de conflictos + reintento automático de la transacción, que es
    // lo que de verdad evita el stock negativo bajo concurrencia real. Escribir
    // un test aquí con este mock daría una falsa sensación de cobertura (una
    // "simulación falsa"), así que se deja documentado en vez de inventarlo.
    //
    // Lo que SÍ queda cubierto y es determinista con este mock: la lógica de
    // validación en sí (Test C, Test F) — dado un stock leído correctamente
    // dentro de la transacción, la operación se rechaza si no alcanza. Esa es
    // la pieza que controla el código de la app; la serialización real de
    // transacciones concurrentes la garantiza el servidor de Firestore y debe
    // verificarse con Firebase Emulator Suite en una fase posterior (no
    // configurado todavía en este repo).
  });
});
