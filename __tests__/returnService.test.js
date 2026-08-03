/**
 * applyReturnToPresale: recálculo de la factura al aprobar una devolución.
 * Cubre lo que el entregador ve en su historial: cantidades, totales y el
 * resumen compacto de lo devuelto.
 */

jest.mock('@react-native-firebase/firestore', () => {
  const firestore = () => ({ collection: () => ({ doc: jest.fn() }) });
  firestore.FieldValue = { serverTimestamp: jest.fn(), increment: jest.fn() };
  return firestore;
});
jest.mock('@react-native-firebase/auth', () => () => ({ currentUser: null }));

const { applyReturnToPresale } = require('../android/app/src/services/returnService');

// Factura: 10 unidades a C$20 con C$50 de descuento (total 150) + 2 regalos.
const presale = () => ({
  items: [
    { productId: 'p1', productName: 'Pollo entero', quantity: 10, unitPrice: 20, total: 150 },
    { productId: 'p2', productName: 'Pechuga', quantity: 4, unitPrice: 25, total: 100 },
  ],
  bonuses: [{ productId: 'p3', productName: 'Alitas', quantity: 2, unitPrice: 0, total: 0 }],
  subtotal: 300,
  total: 250,
  totalDiscount: 50,
  amountPaid: 250,
});

test('devolución parcial: baja cantidad, subtotal y total al valor neto', () => {
  const res = applyReturnToPresale(presale(), [
    { productId: 'p1', productName: 'Pollo entero', isBonus: false, expectedQty: 4, receivedQty: 4 },
  ]);

  // 4 de 10 unidades: neto 15/u → salen C$60 de un total de C$150 en esa línea.
  expect(res.items).toHaveLength(2);
  expect(res.items[0]).toMatchObject({ productId: 'p1', quantity: 6, total: 90 });
  expect(res.subtotal).toBe(220); // 300 - (4 × 20)
  expect(res.total).toBe(190); // 250 - (4 × 15)
  expect(res.totalDiscount).toBe(30);
  expect(res.status).toBe('partially_returned');
  expect(res.returnedTotal).toBe(60);
  expect(res.returnedSummary).toEqual([
    { productId: 'p1', productName: 'Pollo entero', quantity: 4, unitPrice: 15, total: 60, isBonus: false },
  ]);
  // Cobrado no puede exceder el nuevo total: la diferencia se devolvió al cliente.
  expect(res.amountPaid).toBe(190);
});

test('línea devuelta por completo sale de la factura; el regalo no descuenta dinero', () => {
  const res = applyReturnToPresale(presale(), [
    { productId: 'p2', productName: 'Pechuga', isBonus: false, expectedQty: 4, receivedQty: 4 },
    { productId: 'p3', productName: 'Alitas', isBonus: true, expectedQty: 2, receivedQty: 1 },
  ]);

  expect(res.items.map((i) => i.productId)).toEqual(['p1']);
  expect(res.bonuses).toHaveLength(0);
  expect(res.total).toBe(150); // 250 - 100; el regalo no resta
  expect(res.returnedTotal).toBe(100);
  expect(res.returnedSummary).toHaveLength(2);
  expect(res.returnedSummary[1]).toMatchObject({ productName: 'Alitas', quantity: 2, total: 0, isBonus: true });
  expect(res.status).toBe('partially_returned');
});

test('devoluciones sucesivas acumulan el resumen y vacían la factura', () => {
  const first = applyReturnToPresale(presale(), [
    { productId: 'p1', productName: 'Pollo entero', isBonus: false, expectedQty: 4, receivedQty: 4 },
  ]);

  const second = applyReturnToPresale(
    { ...presale(), ...first },
    [
      { productId: 'p1', productName: 'Pollo entero', isBonus: false, expectedQty: 6, receivedQty: 6 },
      { productId: 'p2', productName: 'Pechuga', isBonus: false, expectedQty: 4, receivedQty: 4 },
      { productId: 'p3', productName: 'Alitas', isBonus: true, expectedQty: 2, receivedQty: 2 },
    ],
  );

  expect(second.items).toHaveLength(0);
  expect(second.bonuses).toHaveLength(0);
  expect(second.status).toBe('returned');
  expect(second.total).toBe(0);
  expect(second.subtotal).toBe(0);
  expect(second.amountPaid).toBe(0);
  // Las 10 unidades de p1 quedan en una sola línea del resumen.
  expect(second.returnedSummary).toHaveLength(3);
  expect(second.returnedSummary[0]).toMatchObject({ productId: 'p1', quantity: 10, total: 150 });
  expect(second.returnedTotal).toBe(250);
});

test('devolver más de lo facturado no deja cantidades ni totales negativos', () => {
  const res = applyReturnToPresale(presale(), [
    { productId: 'p1', productName: 'Pollo entero', isBonus: false, expectedQty: 99, receivedQty: 99 },
  ]);

  expect(res.items.map((i) => i.productId)).toEqual(['p2']);
  expect(res.returnedSummary[0].quantity).toBe(10);
  expect(res.total).toBe(100);
  expect(res.subtotal).toBe(100);
});
