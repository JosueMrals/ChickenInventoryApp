import React, { createContext, useState } from "react";

export const QuickSaleContext = createContext();

export function QuickSaleProvider({ children }) {

  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(null);

  const addItem = (product) => {
    const exists = cart.find((p) => p.id === product.id);

    if (exists) {
      return updateCart(exists.id, {
        quantity: exists.quantity + 1,
      });
    }

    setCart((prev) => [
      ...prev,
      {
        ...product,
        quantity: 1,
        price: product.salePrice ?? product.price ?? 0,
        discountType: "none",
        discountValue: 0,
      },
    ]);
  };

  const updateCart = (id, data) => {
    setCart((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...data } : p))
    );
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((p) => p.id !== id));
  };

  const clearCart = () => setCart([]);

  const resetQuickSale = () => {
    clearCart();
    setCustomer(null);
  };

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
