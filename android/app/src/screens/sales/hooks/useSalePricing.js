/**
 * Encapsula la lógica de precio por producto considerando:
 * - price/salePrice
 * - wholesalePrices array (multiple levels) OR old single wholesale threshold & wholesalePrice
 * - discount del cliente (porcentaje)
 *
 * devuelve: { priceToUse, usedWholesale }
 */
export function calcPriceForProduct({ product, qty = 1, customer = null }) {
  if (!product) return { priceToUse: 0, usedWholesale: false };

  const regularPrice = product.salePrice ?? product.price ?? 0;
  
  // 1. Determine base price (regular or wholesale)
  let basePrice = regularPrice;
  let usedWholesale = false;

  // New logic: check wholesalePrices array first
  if (Array.isArray(product.wholesalePrices) && product.wholesalePrices.length > 0) {
    // Find the best matching wholesale price (highest quantity threshold that is met)
    // Sort by quantity descending to find the highest threshold first
    const applicablePrices = product.wholesalePrices
      .filter(wp => qty >= wp.quantity)
      .sort((a, b) => b.quantity - a.quantity);
      
    if (applicablePrices.length > 0) {
      basePrice = applicablePrices[0].price;
      usedWholesale = true;
    }
  } 
  // Fallback: Old logic (single wholesale price)
  else {
    const threshold = product.wholesaleThreshold || 0;
    const wholesalePrice = product.wholesalePrice || 0;

    if (threshold > 0 && qty >= threshold && wholesalePrice > 0) {
      basePrice = wholesalePrice;
      usedWholesale = true;
    }
  }

  // 2. Apply customer discount if any
  let priceToUse = basePrice;
  const discount = (customer && customer.discount) ? Number(customer.discount) : 0;
  if (discount > 0) {
    priceToUse = priceToUse * (1 - discount / 100);
  }

  // Round to 2 decimals
  priceToUse = Math.round((priceToUse + Number.EPSILON) * 100) / 100;

  return { priceToUse, usedWholesale };
}
