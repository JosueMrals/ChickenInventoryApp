import { useState, useMemo } from "react";

export function useQuickSaleCart() {
  const [cart, setCart] = useState([]);

  // ➕ Añadir producto al carrito
  const addItem = (product, quantity = 1, customPrice = null) => {
    const price = Number(customPrice ?? product.salePrice ?? product.price ?? 0);

    setCart((prev) => {
      const exists = prev.find((i) => i.product.id === product.id);

      if (exists) {
        const newQty = exists.quantity + quantity;
        return prev.map((i) =>
          i.product.id === product.id
            ? {
                ...i,
                quantity: newQty,
                unitPrice: exists.unitPrice,
                total: newQty * exists.unitPrice - exists.discount,
              }
            : i
        );
      }

      return [
        ...prev,
        {
          product,
          quantity,
          unitPrice: price,
          discount: 0,
          total: quantity * price,
        },
      ];
    });
  };

  // ✏️ Editar un item del carrito
  const updateItem = (productId, changes) => {
    setCart((prev) =>
      prev.map((i) =>
        i.product.id === productId
          ? {
              ...i,
              ...changes,
              unitPrice: Number(changes.unitPrice ?? i.unitPrice),
              quantity: Number(changes.quantity ?? i.quantity),
              discount: Number(changes.discount ?? i.discount),
              total:
                (Number(changes.quantity ?? i.quantity) *
                  Number(changes.unitPrice ?? i.unitPrice)) -
                Number(changes.discount ?? i.discount),
            }
          : i
      )
    );
  };

  // 🗑 Quitar item del carrito
  const removeItem = (productId) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  // 🔄 Limpiar el carrito
  const clearCart = () => setCart([]);

  // 🧮 Subtotales
  const subtotal = useMemo(
    () => cart.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0),
    [cart]
  );

  // 🔹 Total menos descuentos individuales
  const totalDiscount = useMemo(
    () => cart.reduce((sum, i) => sum + i.discount, 0),
    [cart]
  );

  const total = subtotal - totalDiscount;

  return {
    cart,
    addItem,
    updateItem,
    removeItem,
    clearCart,
    subtotal,
    total,
    totalDiscount,
  };
}
