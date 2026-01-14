import React, { createContext, useState, useEffect, useCallback } from "react";
import { calcPriceForProduct } from "../../sales/hooks/useSalePricing";

export const QuickSaleContext = createContext();

export function QuickSaleProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(null);

  // Helper para recalcular bonificaciones
  const applyBonuses = useCallback((currentCart) => {
    let newCart = [...currentCart];
    
    // 1. Eliminar bonificaciones existentes para recalcularlas
    newCart = newCart.filter(item => !item.isBonus);

    // 2. Iterar sobre los productos normales y aplicar bonificaciones
    currentCart.forEach(item => {
      if (item.isBonus) return; // No bonificar sobre bonificaciones

      const product = item.product;
      const { bonusEnabled, bonusThreshold, bonusQuantity } = product;
      
      if (bonusEnabled && bonusThreshold > 0 && bonusQuantity > 0) {
        const quantitySold = item.quantity;
        const numberOfBonuses = Math.floor(quantitySold / bonusThreshold);

        if (numberOfBonuses > 0) {
          const bonusAmount = numberOfBonuses * bonusQuantity;
          const bonusItem = {
            id: `${product.id}_bonus`, // ID único para el item de bonificación
            product: product,
            quantity: bonusAmount,
            unitPrice: 0, // Las bonificaciones no tienen precio de venta
            discount: 0,
            total: 0,
            isBonus: true, // Flag para identificarlo
            linkedTo: product.id, // Para saber qué producto lo generó
          };
          
          // Verificar si ya existe un item de bonificación para este producto
          const existingBonus = newCart.find(b => b.id === bonusItem.id);
          if (existingBonus) {
            existingBonus.quantity = bonusAmount;
            existingBonus.total = 0;
          } else {
            newCart.push(bonusItem);
          }
        }
      }
    });

    return newCart;
  }, []);

  useEffect(() => {
    let newCart = cart.map(item => {
      if (item.isBonus) return item;
      const { priceToUse } = calcPriceForProduct({ product: item.product, qty: item.quantity, customer });
      return { ...item, unitPrice: priceToUse, total: item.quantity * priceToUse - item.discount };
    });
    const finalCart = applyBonuses(newCart);
    setCart(finalCart);
  }, [customer, applyBonuses]);

  const addItem = (product, qty = 1, customPrice = null) => {
    setCart(prevCart => {
      const exists = prevCart.find((p) => p.id === product.id && !p.isBonus);
      const currentQty = exists ? exists.quantity : 0;
      const totalQty = currentQty + qty;
      let finalPrice;
      if (customPrice !== null) {
        finalPrice = Number(customPrice);
      } else {
        const { priceToUse } = calcPriceForProduct({ product, qty: totalQty, customer });
        finalPrice = priceToUse;
      }
      
      let updatedCart;
      if (exists) {
        updatedCart = prevCart.map(p => {
          if (p.id === product.id && !p.isBonus) {
            return { ...p, quantity: totalQty, unitPrice: finalPrice, total: totalQty * finalPrice - p.discount };
          }
          return p;
        });
      } else {
        const item = {
          id: product.id,
          product,
          quantity: qty,
          unitPrice: finalPrice,
          discount: 0,
          total: qty * finalPrice,
          isBonus: false,
        };
        updatedCart = [...prevCart, item];
      }
      
      return applyBonuses(updatedCart);
    });
  };

  const updateCart = (id, data) => {
    setCart(prev => {
      const updatedCart = prev.map((p) => {
        if (p.id !== id || p.isBonus) return p;
        const newQuantity = Number(data.quantity ?? p.quantity);
        let newUnit = Number(data.unitPrice ?? p.unitPrice);
        if (data.quantity !== undefined && data.unitPrice === undefined) {
          const { priceToUse } = calcPriceForProduct({ product: p.product, qty: newQuantity, customer });
          newUnit = priceToUse;
        }
        const newDiscount = Number(data.discount ?? p.discount);
        return { ...p, ...data, quantity: newQuantity, unitPrice: newUnit, discount: newDiscount, total: newQuantity * newUnit - newDiscount };
      });
      return applyBonuses(updatedCart);
    });
  };

  const removeFromCart = (id) => {
    setCart(prev => {
      // Si se elimina un item normal, su bonificación también se irá en el recálculo
      const updatedCart = prev.filter((p) => p.id !== id);
      return applyBonuses(updatedCart);
    });
  };
  
  const clearCart = () => setCart([]);
  
  const resetQuickSale = () => {
    clearCart();
    setCustomer(null);
  };

  return (
    <QuickSaleContext.Provider
      value={{ cart, customer, setCustomer, addItem, updateCart, removeFromCart, clearCart, resetQuickSale }}
    >
      {children}
    </QuickSaleContext.Provider>
  );
}