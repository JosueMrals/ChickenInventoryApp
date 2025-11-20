import React, { createContext, useState } from "react";

export const QuickSaleContext = createContext();

export function QuickSaleProvider({ children }) {

  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(null);

  // ==========================
  // 👉 addItem(product, qty?)
  // ==========================

  const addItem = (product, qty = 1, customPrice = null) => {
    const price =
      Number(customPrice ?? product.salePrice ?? product.price ?? 0);

    const exists = cart.find((p) => p.id === product.id);

    if (exists) {
      return updateCart(product.id, {
        quantity: exists.quantity + qty,
        total: (exists.quantity + qty) * exists.unitPrice - exists.discount,
      });
    }

    // crear item correcto
    const item = {
      id: product.id,
      product,
      quantity: qty,
      unitPrice: price,
      discount: 0,
      total: qty * price,
    };

    setCart((prev) => [...prev, item]);
  };

  // ==========================
  // 👉 updateCart(id, data)
  // ==========================

  const updateCart = (id, data) => {
    setCart((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;

        const newQuantity = Number(data.quantity ?? p.quantity);
        const newUnit =
          Number(data.unitPrice ?? p.unitPrice);
        const newDiscount = Number(data.discount ?? p.discount);

        return {
          ...p,
          ...data,
          quantity: newQuantity,
          unitPrice: newUnit,
          discount: newDiscount,
          total: newQuantity * newUnit - newDiscount,
        };
      })
    );
  };

  // ==========================
  // 👉 removeFromCart(id)
  // ==========================

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((p) => p.id !== id));
  };

  // ==========================
  // 👉 limpiar
  // ==========================
  const clearCart = () => setCart([]);

  // ==========================
  // 👉 reiniciar venta completa
  // ==========================
  const resetQuickSale = () => {
    clearCart();
    setCustomer(null);
  };

  // ✓ EXPORTAR TODO IGUAL (nombres intactos)
  return (
    <QuickSaleContext.Provider
      value={{
        cart,
        customer,
        setCustomer,
        addItem,
        updateCart,
        removeFromCart,
        clearCart,
        resetQuickSale,
      }}
    >
      {children}
    </QuickSaleContext.Provider>
  );
}
