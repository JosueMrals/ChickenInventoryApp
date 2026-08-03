// El costo de una línea decide el margen de TODO reporte histórico. La regla:
// si la venta guardó su propio purchasePrice, ese manda; el catálogo es solo
// fallback para documentos anteriores a que se denormalizara.
import { lineCost } from '../../android/app/src/screens/reports/services/reportsService';

describe('lineCost', () => {
  it('usa el costo guardado en la línea', () => {
    expect(lineCost({ purchasePrice: 42.5 })).toBe(42.5);
  });

  it('devuelve null si la línea no trae costo (documento legacy)', () => {
    expect(lineCost({})).toBeNull();
    expect(lineCost({ purchasePrice: null })).toBeNull();
    expect(lineCost({ purchasePrice: undefined })).toBeNull();
  });

  it('trata 0 y valores no numéricos como ausentes, para no reportar margen del 100%', () => {
    expect(lineCost({ purchasePrice: 0 })).toBeNull();
    expect(lineCost({ purchasePrice: 'abc' })).toBeNull();
    expect(lineCost({ purchasePrice: NaN })).toBeNull();
  });

  it('acepta el costo llegando como string numérico', () => {
    expect(lineCost({ purchasePrice: '15.75' })).toBe(15.75);
  });

  // La preferencia tal como la aplica el reporte.
  const resolve = (it, catalogo) => lineCost(it) ?? catalogo ?? 0;

  it('el costo guardado gana sobre el del catálogo actual', () => {
    // La venta se hizo cuando costaba 10; hoy el catálogo dice 30.
    expect(resolve({ purchasePrice: 10 }, 30)).toBe(10);
  });

  it('cae al catálogo solo cuando la línea no guardó costo', () => {
    expect(resolve({}, 30)).toBe(30);
  });

  it('sin costo guardado ni catálogo, el costo es 0', () => {
    expect(resolve({}, undefined)).toBe(0);
  });
});
