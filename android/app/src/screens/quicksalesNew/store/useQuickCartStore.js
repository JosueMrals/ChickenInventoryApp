import { create } from "zustand";

export const useQuickCartStore = create((set, get) => ({
  items: [],
  subtotal: 0,

  addItem: (product, qty = 1) =>
    set((state) => {
      const price = product.salePrice ?? product.price ?? 0;
      const existing = state.items.find((i) => i.productId === product.id);

      let newItems;
      if (existing) {
        newItems = state.items.map((i) =>
          i.productId === product.id
            ? { ...i, qty: i.qty + qty, subtotal: (i.qty + qty) * i.price }
            : i
        );
      } else {
        newItems = [
          ...state.items,
          {
            productId: product.id,
            product,
            price,
            qty,
            subtotal: price * qty,
          },
        ];
      }

      return {
        items: newItems,
        subtotal: newItems.reduce((acc, i) => acc + i.subtotal, 0),
      };
    }),

  updateQty: (productId, qty) =>
    set((state) => {
      const newItems = state.items.map((i) =>
        i.productId === productId
          ? { ...i, qty, subtotal: qty * i.price }
          : i
      );
      return {
        items: newItems,
        subtotal: newItems.reduce((a, b) => a + b.subtotal, 0),
      };
    }),

  removeItem: (productId) =>
    set((state) => {
      const newItems = state.items.filter((i) => i.productId !== productId);
      return {
        items: newItems,
        subtotal: newItems.reduce((a, b) => a + b.subtotal, 0),
      };
    }),

  clearCart: () => set({ items: [], subtotal: 0 }),
}));
