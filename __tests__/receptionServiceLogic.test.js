/**
 * receptionService — lógica pura del módulo de Recepción de Mercancía.
 * Cubre normalización, totales, validación y cálculo de stock (ingreso/reversión)
 * sin tocar Firestore.
 */

jest.mock('@react-native-firebase/firestore', () => {
  const firestore = () => ({ collection: () => ({ doc: jest.fn() }) });
  firestore.FieldValue = { serverTimestamp: jest.fn(), increment: jest.fn() };
  return firestore;
});
jest.mock('@react-native-firebase/auth', () => () => ({ currentUser: null }));

const {
  round2,
  normalizeReceiptItem,
  computeReceiptTotals,
  validateReceptionDraft,
  computeReceiptStockChanges,
  computeVoidStockChanges,
} = require('../android/app/src/services/receptionService');

describe('round2', () => {
  test('redondea a 2 decimales sin arrastre binario', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(10.005)).toBe(10.01);
    expect(round2('abc')).toBe(0);
  });
});

describe('normalizeReceiptItem', () => {
  test('acepta forma flexible y calcula lineCost', () => {
    const norm = normalizeReceiptItem({ id: 'p1', name: 'Pollo', qty: 3, cost: 20.5 });
    expect(norm).toMatchObject({
      productId: 'p1', productName: 'Pollo', quantity: 3, unitCost: 20.5, lineCost: 61.5,
    });
  });

  test('prioriza campos canónicos sobre alias', () => {
    const norm = normalizeReceiptItem({ productId: 'p2', quantity: 2, unitCost: 10, id: 'x', qty: 99 });
    expect(norm.productId).toBe('p2');
    expect(norm.quantity).toBe(2);
    expect(norm.lineCost).toBe(20);
  });
});

describe('computeReceiptTotals', () => {
  test('suma unidades y costo de todas las líneas', () => {
    const totals = computeReceiptTotals([
      { productId: 'p1', quantity: 3, unitCost: 20 },
      { productId: 'p2', quantity: 2, unitCost: 15.5 },
    ]);
    expect(totals).toEqual({ itemCount: 2, totalUnits: 5, totalCost: 91 });
  });

  test('lista vacía → todo en cero', () => {
    expect(computeReceiptTotals([])).toEqual({ itemCount: 0, totalUnits: 0, totalCost: 0 });
  });
});

describe('validateReceptionDraft', () => {
  // Base válida a la que cada test le rompe un solo campo.
  const baseDraft = (overrides = {}) => ({
    supplier: 'Granja Sur',
    reference: 'FAC-1',
    items: [{ productId: 'p1', productName: 'Pollo', quantity: 2, unitCost: 5 }],
    ...overrides,
  });

  test('rechaza proveedor vacío', () => {
    const res = validateReceptionDraft(baseDraft({ supplier: '   ' }));
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/proveedor.*obligatorio/i);
  });

  test('rechaza número de factura vacío', () => {
    const res = validateReceptionDraft(baseDraft({ reference: '' }));
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/factura.*obligatorio/i);
  });

  test('rechaza recepción sin líneas', () => {
    const res = validateReceptionDraft(baseDraft({ items: [] }));
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/al menos un producto/i);
  });

  test('rechaza línea sin producto', () => {
    const res = validateReceptionDraft(baseDraft({ items: [{ quantity: 1, unitCost: 1 }] }));
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/sin producto/i);
  });

  test('rechaza cantidad no positiva', () => {
    const res = validateReceptionDraft(baseDraft({ items: [{ productId: 'p1', productName: 'Pollo', quantity: 0, unitCost: 5 }] }));
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/cantidad inválida/i);
  });

  test('rechaza costo negativo', () => {
    const res = validateReceptionDraft(baseDraft({ items: [{ productId: 'p1', productName: 'Pollo', quantity: 2, unitCost: -1 }] }));
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/costo inválido/i);
  });

  test('rechaza producto duplicado', () => {
    const res = validateReceptionDraft(baseDraft({
      items: [
        { productId: 'p1', productName: 'Pollo', quantity: 2, unitCost: 5 },
        { productId: 'p1', productName: 'Pollo', quantity: 1, unitCost: 5 },
      ],
    }));
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/repetido/i);
  });

  test('acepta un borrador válido con proveedor y factura', () => {
    const res = validateReceptionDraft(baseDraft({
      items: [
        { productId: 'p1', productName: 'Pollo', quantity: 2, unitCost: 5 },
        { productId: 'p2', productName: 'Pechuga', quantity: 3, unitCost: 8 },
      ],
    }));
    expect(res.ok).toBe(true);
  });
});

describe('computeReceiptStockChanges', () => {
  test('suma la cantidad al stock previo por producto', () => {
    const changes = computeReceiptStockChanges(
      [
        { productId: 'p1', quantity: 5, unitCost: 10 },
        { productId: 'p2', quantity: 2, unitCost: 4 },
      ],
      { p1: 10, p2: 0 }
    );
    expect(changes[0]).toMatchObject({ productId: 'p1', previousStock: 10, resultingStock: 15 });
    expect(changes[1]).toMatchObject({ productId: 'p2', previousStock: 0, resultingStock: 2 });
  });

  test('stock previo ausente se asume 0', () => {
    const [change] = computeReceiptStockChanges([{ productId: 'p9', quantity: 4, unitCost: 1 }], {});
    expect(change.previousStock).toBe(0);
    expect(change.resultingStock).toBe(4);
  });
});

describe('computeVoidStockChanges', () => {
  test('resta la cantidad recibida del stock actual', () => {
    const { changes, blocked } = computeVoidStockChanges(
      [{ productId: 'p1', productName: 'Pollo', quantity: 5 }],
      { p1: 12 }
    );
    expect(changes[0]).toMatchObject({ previousStock: 12, resultingStock: 7, blocked: false });
    expect(blocked).toHaveLength(0);
  });

  test('marca como bloqueante si dejaría stock negativo', () => {
    const { blocked } = computeVoidStockChanges(
      [{ productId: 'p1', productName: 'Pollo', quantity: 5 }],
      { p1: 3 }
    );
    expect(blocked).toHaveLength(1);
    expect(blocked[0].productId).toBe('p1');
  });
});
