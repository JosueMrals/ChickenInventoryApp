import { getProductByBarcode, getProductByName } from '../services/productsService';

export async function validateNoDuplicates({ name, barcode, currentId = null }) {
  // check barcode
  const byBarcode = await getProductByBarcode(barcode);
  if (byBarcode && byBarcode.id !== currentId) {
    return { ok: false, field: 'barcode', message: 'Codigo de barras ya existe' };
  }
  // check name (exact match). For case-insensitive, maintain a lowercaseName index in docs.
  const byName = await getProductByName(name);
  if (byName && byName.id !== currentId) {
    return { ok: false, field: 'name', message: 'Nombre de producto ya existe' };
  }
  return { ok: true };
}
