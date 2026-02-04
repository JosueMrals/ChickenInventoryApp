import { create } from 'zustand';

export const useQuickCartStore = create((set, get) => ({
  items: [],

  // AGREGAR
  add(product, qty = 1) {
    set(state => {
      const items = [...state.items];
      const idx = items.findIndex(i => i.productId === product.id);

      if (idx >= 0) {
        items[idx].qty += qty;
        items[idx].subtotal = items[idx].qty * items[idx].price;
      } else {
        const price = product.salePrice ?? product.price ?? 0;
        items.push({
          productId: product.id,
          product,
          qty,
          price,
          subtotal: price * qty,
        });
      }

      return { items };
    });
  },

  // ACTUALIZAR CANTIDAD
  updateQty(productId, qty) {
    set(state => ({
      items: state.items.map(i =>
        i.productId === productId
          ? { ...i, qty, subtotal: i.price * qty }
          : i
      ),
    }));
  },

  // REMOVER
  remove(productId) {
    set(state => ({
      items: state.items.filter(i => i.productId !== productId),
    }));
  },

  // LIMPIAR
  clear() {
    set({ items: [] });
  },

  // SELECTORES REACTIVOS
  subtotal: () => {
    const items = get().items;
    return items.reduce((sum, i) => sum + i.subtotal, 0);
  },

  totalAmount: () => {
    const items = get().items;
    return items.reduce((sum, i) => sum + i.subtotal, 0);
  },

  totalItems: () => {
    const items = get().items;
    return items.reduce((sum, i) => sum + i.qty, 0);
  },
}));
