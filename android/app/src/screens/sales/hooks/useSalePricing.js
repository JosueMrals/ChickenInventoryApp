/**
 * Encapsula la lógica de precio por producto considerando:
 * - price/salePrice
 * - wholesale threshold & wholesalePrice
 * - discount del cliente (porcentaje)
 *
 * devuelve: { priceToUse, usedWholesale }
 */
export function calcPriceForProduct({ product, qty = 1, customer = null }) {
  if (!product) return { priceToUse: 0, usedWholesale: false };

  const threshold = product.wholesaleThreshold || 0;
  const wholesalePrice = product.wholesalePrice || 0;
  const regularPrice = product.salePrice ?? product.price ?? 0;

  let usedWholesale = threshold > 0 && qty >= threshold;
  let priceToUse = usedWholesale ? wholesalePrice || regularPrice : regularPrice;

  // aplicar descuento por tipo de cliente si existe
  const discount = (customer && customer.discount) ? Number(customer.discount) : 0;
  if (discount > 0) {
    priceToUse = priceToUse * (1 - discount / 100);
  }

  // Round to 2 decimals
  priceToUse = Math.round((priceToUse + Number.EPSILON) * 100) / 100;

  return { priceToUse, usedWholesale };
}
