/**
 * receptionService — operaciones transaccionales (createGoodsReceipt / voidGoodsReceipt).
 * Un mock de Firestore modela el store: productos, contador, recepciones y
 * movimientos. Fija el contrato de que la recepción sube stock atómicamente y la
 * anulación lo revierte con guardas.
 */

const mockDb = {
  data: { products: {}, counters: {}, goodsReceipts: {}, inventoryMovements: {} },
  writes: [],
};

jest.mock('@react-native-firebase/firestore', () => {
  let autoId = 0;
  const makeRef = (collection, id) => ({ collection, id: id != null ? id : `auto-${++autoId}` });

  const txApi = {
    get: async (ref) => {
      const coll = mockDb.data[ref.collection] || {};
      const doc = coll[ref.id];
      return { exists: () => !!doc, data: () => doc, id: ref.id, ref };
    },
    set: (ref, payload, opts) => {
      const coll = mockDb.data[ref.collection] || (mockDb.data[ref.collection] = {});
      if (opts && opts.merge && coll[ref.id]) coll[ref.id] = { ...coll[ref.id], ...payload };
      else coll[ref.id] = payload;
      mockDb.writes.push({ op: 'set', collection: ref.collection, id: ref.id, payload });
    },
    update: (ref, payload) => {
      const coll = mockDb.data[ref.collection] || (mockDb.data[ref.collection] = {});
      coll[ref.id] = { ...(coll[ref.id] || {}), ...payload };
      mockDb.writes.push({ op: 'update', collection: ref.collection, id: ref.id, payload });
    },
  };

  const firestore = () => ({
    collection: (name) => ({ doc: (id) => makeRef(name, id) }),
    runTransaction: async (fn) => fn(txApi),
  });
  firestore.FieldValue = { serverTimestamp: () => 'ts', increment: (n) => n };
  return firestore;
});

jest.mock('@react-native-firebase/auth', () => () => ({
  currentUser: { uid: 'bodeguero-1', email: 'bodega@test.com' },
}));

const {
  createGoodsReceipt,
  voidGoodsReceipt,
} = require('../android/app/src/services/receptionService');

const resetDb = () => {
  mockDb.data = { products: {}, counters: {}, goodsReceipts: {}, inventoryMovements: {} };
  mockDb.writes = [];
};

const movementsWritten = () => mockDb.writes.filter((w) => w.collection === 'inventoryMovements');
const receiptWritten = () => mockDb.writes.find((w) => w.collection === 'goodsReceipts');

beforeEach(resetDb);

describe('createGoodsReceipt', () => {
  test('sube el stock, escribe recepción, contador y movimientos', async () => {
    mockDb.data.products = {
      p1: { name: 'Pollo entero', stock: 10, category: 'Pollo' },
      p2: { name: 'Pechuga', stock: 0, category: 'Cortes' },
    };

    const res = await createGoodsReceipt({
      supplier: 'Granja Sur',
      reference: 'FAC-1',
      invoicePhoto: { url: 'https://mock/photo.jpg', path: 'goodsReceipts/1.jpg' },
      role: 'bodeguero',
      items: [
        { productId: 'p1', quantity: 5, unitCost: 10 },
        { productId: 'p2', quantity: 2, unitCost: 4 },
      ],
    });

    // Stock incrementado
    expect(mockDb.data.products.p1.stock).toBe(15);
    expect(mockDb.data.products.p2.stock).toBe(2);

    // Contador consecutivo
    expect(res.receiptNumber).toBe(1);
    expect(mockDb.data.counters.goodsReceiptCounter.currentNumber).toBe(1);

    // Documento de recepción con totales correctos
    const receipt = receiptWritten().payload;
    expect(receipt.status).toBe('completed');
    expect(receipt.totalUnits).toBe(7);
    expect(receipt.totalCost).toBe(58);
    expect(receipt.createdByUid).toBe('bodeguero-1');
    expect(receipt.invoicePhoto).toMatchObject({ path: 'goodsReceipts/1.jpg' });
    expect(receipt.items[0]).toMatchObject({ productId: 'p1', previousStock: 10, resultingStock: 15, lineCost: 50 });

    // Un movimiento por línea
    expect(movementsWritten()).toHaveLength(2);
    expect(movementsWritten().every((m) => m.payload.type === 'reception')).toBe(true);
  });

  test('el segundo consecutivo continúa desde el contador existente', async () => {
    mockDb.data.products = { p1: { name: 'Pollo', stock: 0 } };
    mockDb.data.counters = { goodsReceiptCounter: { currentNumber: 41 } };

    const res = await createGoodsReceipt({ supplier: 'Prov', reference: 'F-2', role: 'bodeguero', items: [{ productId: 'p1', quantity: 1, unitCost: 1 }] });

    expect(res.receiptNumber).toBe(42);
    expect(mockDb.data.counters.goodsReceiptCounter.currentNumber).toBe(42);
  });

  test('aborta si un producto ya no existe (sin tocar stock)', async () => {
    mockDb.data.products = { p1: { name: 'Pollo', stock: 5 } };

    await expect(
      createGoodsReceipt({
        supplier: 'Prov',
        reference: 'F-3',
        role: 'bodeguero',
        items: [
          { productId: 'p1', quantity: 2, unitCost: 3 },
          { productId: 'fantasma', quantity: 1, unitCost: 1 },
        ],
      })
    ).rejects.toThrow(/ya no existe/i);

    // p1 no debió modificarse porque la transacción abortó
    expect(mockDb.data.products.p1.stock).toBe(5);
    expect(receiptWritten()).toBeUndefined();
  });

  test('rechaza un borrador inválido antes de la transacción', async () => {
    await expect(
      createGoodsReceipt({ supplier: 'Prov', reference: 'F', role: 'bodeguero', items: [] })
    ).rejects.toThrow(/al menos un producto/i);
    expect(mockDb.writes).toHaveLength(0);
  });

  test('exige proveedor y número de factura (sin tocar nada)', async () => {
    mockDb.data.products = { p1: { name: 'Pollo', stock: 5 } };

    await expect(
      createGoodsReceipt({ reference: 'F-1', role: 'bodeguero', items: [{ productId: 'p1', quantity: 1, unitCost: 1 }] })
    ).rejects.toThrow(/proveedor.*obligatorio/i);

    await expect(
      createGoodsReceipt({ supplier: 'Prov', role: 'bodeguero', items: [{ productId: 'p1', quantity: 1, unitCost: 1 }] })
    ).rejects.toThrow(/factura.*obligatorio/i);

    expect(mockDb.writes).toHaveLength(0);
    expect(mockDb.data.products.p1.stock).toBe(5);
  });
});

describe('voidGoodsReceipt', () => {
  const seedCompletedReceipt = () => {
    mockDb.data.products = { p1: { name: 'Pollo', stock: 15 }, p2: { name: 'Pechuga', stock: 2 } };
    mockDb.data.goodsReceipts = {
      r1: {
        receiptNumber: 1,
        status: 'completed',
        items: [
          { productId: 'p1', productName: 'Pollo', quantity: 5, previousStock: 10, resultingStock: 15 },
          { productId: 'p2', productName: 'Pechuga', quantity: 2, previousStock: 0, resultingStock: 2 },
        ],
      },
    };
    mockDb.writes = [];
  };

  test('admin anula y revierte el stock', async () => {
    seedCompletedReceipt();

    await voidGoodsReceipt({ receiptId: 'r1', reason: 'Error de captura', role: 'admin' });

    expect(mockDb.data.products.p1.stock).toBe(10);
    expect(mockDb.data.products.p2.stock).toBe(0);
    expect(mockDb.data.goodsReceipts.r1.status).toBe('voided');
    expect(mockDb.data.goodsReceipts.r1.voidReason).toBe('Error de captura');
    // Movimientos inversos
    expect(movementsWritten()).toHaveLength(2);
    expect(movementsWritten().every((m) => m.payload.type === 'reception_void')).toBe(true);
  });

  test('un no-admin no puede anular', async () => {
    seedCompletedReceipt();
    await expect(voidGoodsReceipt({ receiptId: 'r1', reason: 'x', role: 'bodeguero' })).rejects.toThrow(/administrador/i);
    expect(mockDb.data.products.p1.stock).toBe(15);
  });

  test('exige un motivo', async () => {
    seedCompletedReceipt();
    await expect(voidGoodsReceipt({ receiptId: 'r1', reason: '  ', role: 'admin' })).rejects.toThrow(/motivo/i);
  });

  test('no anula dos veces la misma recepción', async () => {
    seedCompletedReceipt();
    mockDb.data.goodsReceipts.r1.status = 'voided';
    await expect(voidGoodsReceipt({ receiptId: 'r1', reason: 'x', role: 'admin' })).rejects.toThrow(/ya fue anulada/i);
  });

  test('bloquea la anulación si el stock ya se consumió', async () => {
    seedCompletedReceipt();
    mockDb.data.products.p1.stock = 3; // ya se vendieron 12 de las 15

    await expect(voidGoodsReceipt({ receiptId: 'r1', reason: 'x', role: 'admin' })).rejects.toThrow(/ya se consumió/i);
    // No debió tocar nada
    expect(mockDb.data.products.p1.stock).toBe(3);
    expect(mockDb.data.goodsReceipts.r1.status).toBe('completed');
  });

  test('recepción inexistente lanza error claro', async () => {
    resetDb();
    await expect(voidGoodsReceipt({ receiptId: 'nope', reason: 'x', role: 'admin' })).rejects.toThrow(/ya no existe/i);
  });
});
