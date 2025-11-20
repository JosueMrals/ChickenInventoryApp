import { useCallback, useMemo, useState } from 'react';

export function useQuickCart() {
  const [items, setItems] = useState([]);

  const addItem = useCallback((product, qty = 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.productId === product.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx].qty += qty;
        updated[idx].subtotal =
          updated[idx].qty * updated[idx].price;
        return updated;
      }

      const price = product.salePrice ?? product.price ?? 0;

      return [
        {
          productId: product.id,
          product,
          qty,
          price,
          subtotal: price * qty,
        },
        ...prev,
      ];
    });
  }, []);

  const updateQty = useCallback((productId, qty) => {
    setItems((prev) =>
      prev.map((it) =>
        it.productId === productId
          ? {
              ...it,
              qty,
              subtotal: it.price * qty,
            }
          : it,
      ),
    );
  }, []);

  const removeItem = useCallback((productId) => {
    setItems((prev) => prev.filter((it) => it.productId !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const totals = useMemo(() => {
    const subtotal = items.reduce((acc, it) => acc + it.subtotal, 0);
    return {
      items,
      subtotal,
      total: subtotal,
      count: items.reduce((acc, it) => acc + it.qty, 0),
    };
  }, [items]);

  return { items, addItem, updateQty, removeItem, clear, totals };
}
