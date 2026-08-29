import { formatCurrency, formatNumber } from '../formatMoney';

describe('formatMoney', () => {
  it('agrupa miles y fija 2 decimales', () => {
    expect(formatCurrency(1234567.5)).toBe('C$1,234,567.50');
    expect(formatCurrency(0)).toBe('C$0.00');
    expect(formatCurrency(null)).toBe('C$0.00');
  });

  it('agrupa miles sin decimales', () => {
    expect(formatNumber(12345)).toBe('12,345');
    expect(formatNumber(undefined)).toBe('0');
  });
});
