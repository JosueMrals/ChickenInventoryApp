/**
 * FASE CC1 — el cobro de preventa en mostrador (convertPreSaleToSale) tiene
 * que llegar a Cierre de Caja. Antes no escribía ningún `cashCollections`:
 * esa era la causa real del C$0.00 del admin (que cobra en mostrador, no en
 * ruta). Ver audit-reports/fase-cash-closing-final.md.
 */
const { computePreSaleCashRetained } = require('../android/app/src/services/preSaleService');

describe('computePreSaleCashRetained', () => {
  test('efectivo: retiene el total, no lo que se recibió con vuelto', () => {
    expect(computePreSaleCashRetained({ paymentMethod: 'cash', amountPaid: 600, total: 500 })).toBe(500);
  });

  test('efectivo justo: retiene el monto pagado', () => {
    expect(computePreSaleCashRetained({ paymentMethod: 'cash', amountPaid: 500, total: 500 })).toBe(500);
  });

  test('tarjeta no toca la caja: ese dinero nunca pasa por las manos del vendedor', () => {
    expect(computePreSaleCashRetained({ paymentMethod: 'card', amountPaid: 500, total: 500 })).toBe(0);
  });

  test('crédito no es cobro: se cobra después como abono', () => {
    expect(computePreSaleCashRetained({ paymentMethod: 'credit', amountPaid: 0, total: 500 })).toBe(0);
  });

  test('valores ausentes o negativos dan cero, nunca un egreso fantasma', () => {
    expect(computePreSaleCashRetained({})).toBe(0);
    expect(computePreSaleCashRetained({ paymentMethod: 'cash', amountPaid: -10, total: 500 })).toBe(0);
    expect(computePreSaleCashRetained({ paymentMethod: 'cash', amountPaid: 100, total: null })).toBe(0);
  });
});
