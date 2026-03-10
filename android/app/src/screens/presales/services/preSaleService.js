import { savePreSaleToFirestore } from "../../../services/preSaleService";
import { buildCustomerName } from "../../../utils/customerUtils";

export async function registerPreSale({
  cart = [],
  subtotal = 0,
  total = 0,
  paymentMethod,
  customer = null,
  route = null,
}) {
  if (!cart.length) throw new Error("El carrito está vacío.");

  // Normalizar el carrito
  const normalizedCart = cart.map((item) => ({
    ...item,
    id: item.id || item.product?.id,
    product: item.product || {
      id: item.id,
      name: item.name || "Producto",
    },
    quantity: Number(item.quantity) || 0,
    unitPrice: Number(item.unitPrice) || 0,
    discount: Number(item.discount) || 0,
    total: Number(item.total) || ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)),
    isBonus: !!item.isBonus,
  }));

  const computedSubtotal = subtotal || normalizedCart
    .filter((item) => !item.isBonus)
    .reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)), 0);

  const totalDiscount = normalizedCart
    .filter((item) => !item.isBonus)
    .reduce((sum, item) => sum + (Number(item.discount) || 0), 0);

  const computedTotal = total || (computedSubtotal - totalDiscount);

  const result = await savePreSaleToFirestore({
    cart: normalizedCart,
    subtotal: computedSubtotal,
    totalDiscount,
    total: computedTotal,
    paymentMethod: paymentMethod || 'cash',
    customer: customer
      ? {
          ...customer,
          displayName: customer.displayName || buildCustomerName(customer, "Preventa"),
        }
      : null,
    route,
  });

  return result.id;
}
