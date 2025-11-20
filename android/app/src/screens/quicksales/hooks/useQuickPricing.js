export function quickCalcPrice(product, qty) {
  const price = product.salePrice ?? product.price ?? 0;
  return {
    unitPrice: price,
    subtotal: price * qty,
  };
}
