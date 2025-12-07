import React, { createContext, useState, useEffect } from "react";
import { calcPriceForProduct } from "../../sales/hooks/useSalePricing";

export const QuickSaleContext = createContext();

export function QuickSaleProvider({ children }) {

  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(null);

  // ==========================
  // 👉 Recalculate prices when customer changes
  // ==========================
  useEffect(() => {
    setCart(prevCart => prevCart.map(item => {
      // Recalculate unit price based on rules (wholesale + customer discount)
      const { priceToUse } = calcPriceForProduct({ 
        product: item.product, 
        qty: item.quantity, 
        customer 
      });
      
      // Keep existing logic: if unitPrice was overridden manually, maybe we should keep it?
      // But usually setting a customer implies re-applying their discount.
      // If we want to strictly follow rules, we update unitPrice.
      
      return {
        ...item,
        unitPrice: priceToUse,
        total: item.quantity * priceToUse - item.discount
      };
    }));
  }, [customer]);

  // ==========================
  // 👉 addItem(product, qty?)
  // ==========================

  const addItem = (product, qty = 1, customPrice = null) => {
    // Check if item exists to calculate total quantity
    const exists = cart.find((p) => p.id === product.id);
    const currentQty = exists ? exists.quantity : 0;
    const totalQty = currentQty + qty;

    // Determine unit price
    let finalPrice;
    if (customPrice !== null) {
      finalPrice = Number(customPrice);
    } else {
      // Use centralized pricing logic
      const { priceToUse } = calcPriceForProduct({ 
        product, 
        qty: totalQty, 
        customer 
      });
      finalPrice = priceToUse;
    }

    if (exists) {
      return updateCart(product.id, {
        quantity: totalQty,
        // Update unit price only if customPrice wasn't set originally? 
        // For simplicity in quick sales, we update to the best price for the new quantity.
        unitPrice: finalPrice,
      });
    }

    // crear item correcto
    const item = {
      id: product.id,
      product,
      quantity: qty,
      unitPrice: finalPrice,
      discount: 0,
      total: qty * finalPrice,
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
        let newUnit = Number(data.unitPrice ?? p.unitPrice);
        
        // If quantity changed and unit price was NOT manually provided in this update,
        // recalculate price based on new quantity (e.g. check wholesale tiers).
        if (data.quantity !== undefined && data.unitPrice === undefined) {
             const { priceToUse } = calcPriceForProduct({ 
                 product: p.product, 
                 qty: newQuantity, 
                 customer 
             });
             newUnit = priceToUse;
        }

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
