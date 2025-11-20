import { useCallback, useMemo, useState } from 'react';

/**
 * Cart item shape:
 * { productId, product, qty, unitPrice, subtotal, priceApplied, usedWholesale }
 */
export function useCart(initialCustomer = null) {
  const [items, setItems] = useState([]);
  const [customer, setCustomer] = useState(initialCustomer);

  const addItem = useCallback((product, qty = 1, pricing) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.productId === product.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx].qty += qty;
        copy[idx].unitPrice = pricing.priceToUse;
        copy[idx].priceApplied = pricing.priceToUse;
        copy[idx].usedWholesale = pricing.usedWholesale;
        copy[idx].subtotal = +(copy[idx].qty * copy[idx].unitPrice).toFixed(2);
        return copy;
      }
      const newItem = {
        productId: product.id,
        product,
        qty,
        unitPrice: pricing.priceToUse,
        priceApplied: pricing.priceToUse,
        usedWholesale: pricing.usedWholesale,
        subtotal: +(qty * pricing.priceToUse).toFixed(2),
      };
      return [newItem, ...prev];
    });
  }, []);

  const updateQty = useCallback((productId, qty, pricingOverride) => {
    setItems((prev) => {
      const copy = prev.map((it) => {
        if (it.productId !== productId) return it;
        const priceToUse = pricingOverride?.priceToUse ?? it.unitPrice;
        const usedWholesale = pricingOverride?.usedWholesale ?? it.usedWholesale;
        return {
          ...it,
          qty,
          unitPrice: priceToUse,
          priceApplied: priceToUse,
          usedWholesale,
          subtotal: +(qty * priceToUse).toFixed(2),
        };
      });
      return copy;
    });
  }, []);

  const removeItem = useCallback((productId) => {
    setItems((prev) => prev.filter((it) => it.productId !== productId));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + (it.subtotal || 0), 0);
    // discount at cart-level is per-customer discount or extra applied later
    return {
      items,
      subtotal: +subtotal.toFixed(2),
      total: +subtotal.toFixed(2),
      count: items.reduce((c, it) => c + it.qty, 0),
    };
  }, [items]);

  return {
    items,
    customer,
    setCustomer,
    addItem,
    updateQty,
    removeItem,
    clear,
    totals,
  };
}
