import React, { createContext, useState, useEffect, useCallback } from "react";
import { calcPriceForProduct } from "../../sales/hooks/useSalePricing";
import { 
  savePreSaleToFirestore, 
  getPreSalesFromFirestore,
  processPreSalePayment
} from "../../../services/preSaleService";

export const PreSaleContext = createContext();

export function PreSaleProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [preSales, setPreSales] = useState([]);
  const [loading, setLoading] = useState(false);

  const applyBonuses = useCallback((currentCart) => {
    let newCart = [...currentCart].filter(item => !item.isBonus);
    currentCart.forEach(item => {
      if (item.isBonus) return;
      const product = item.product;
      const { bonusEnabled, bonusThreshold, bonusQuantity } = product;
      if (bonusEnabled && bonusThreshold > 0 && bonusQuantity > 0) {
        const numberOfBonuses = Math.floor(item.quantity / bonusThreshold);
        if (numberOfBonuses > 0) {
          newCart.push({
            id: `${product.id}_bonus`,
            product: product,
            quantity: numberOfBonuses * bonusQuantity,
            unitPrice: 0,
            discount: 0,
            total: 0,
            isBonus: true,
            linkedTo: product.id,
          });
        }
      }
    });
    return newCart;
  }, []);

  const loadPreSales = async () => {
    setLoading(true);
    try {
      const salesFromDb = await getPreSalesFromFirestore();
      setPreSales(salesFromDb);
    } finally {
      setLoading(false);
    }
  };
  
  const addItem = (product, qty = 1) => {
    setCart(prevCart => {
      const exists = prevCart.find(p => p.id === product.id && !p.isBonus);
      const totalQty = (exists ? exists.quantity : 0) + qty;
      const { priceToUse } = calcPriceForProduct({ product, qty: totalQty, customer });
      
      let updatedCart;
      if (exists) {
        updatedCart = prevCart.map(p => {
          if (p.id === product.id && !p.isBonus) {
            return { ...p, quantity: totalQty, unitPrice: priceToUse, total: totalQty * priceToUse - p.discount };
          }
          return p;
        });
      } else {
        updatedCart = [...prevCart, {
          id: product.id,
          product,
          quantity: qty,
          unitPrice: priceToUse,
          discount: 0,
          total: qty * priceToUse,
          isBonus: false,
        }];
      }
      return applyBonuses(updatedCart);
    });
  };

  const updateCart = (id, data) => {
    setCart(prev => {
      const updatedCart = prev.map(p => {
        if (p.id !== id || p.isBonus) return p;
        const updated = { ...p, ...data };
        if (data.quantity && !data.unitPrice) {
            const { priceToUse } = calcPriceForProduct({ product: p.product, qty: updated.quantity, customer });
            updated.unitPrice = priceToUse;
        }
        updated.total = updated.quantity * updated.unitPrice - updated.discount;
        return updated;
      });
      return applyBonuses(updatedCart);
    });
  };
  
  const removeFromCart = (id) => setCart(prev => applyBonuses(prev.filter(p => p.id !== id)));
  
  const resetPreSale = () => {
    setCart([]);
    setCustomer(null);
  };
  
  const savePreSale = async () => {
    setLoading(true);
    try {
      const soldItems = cart.filter(i => !i.isBonus);
      const subtotal = soldItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const totalDiscount = soldItems.reduce((sum, item) => sum + item.discount, 0);
      const total = subtotal - totalDiscount;
      await savePreSaleToFirestore({ customer, cart, subtotal, totalDiscount, total });
      await loadPreSales();
    } finally {
      setLoading(false);
    }
  };

  const payPreSale = async (preSale) => {
    setLoading(true);
    try {
      // --- FIX: Reconstruct cart from `items` and `bonuses` arrays ---
      const fullCart = [
        ...(preSale.items || []), 
        ...(preSale.bonuses || [])
      ];
      await processPreSalePayment(preSale.id, fullCart);
      await loadPreSales(); // Refresh the list
    } catch (error) {
        console.error("Failed to process payment", error);
        throw error;
    } finally {
        setLoading(false);
    }
  };
  
  return (
    <PreSaleContext.Provider
      value={{ cart, customer, setCustomer, addItem, updateCart, removeFromCart, resetPreSale, preSales, loading, loadPreSales, savePreSale, payPreSale }}
    >
      {children}
    </PreSaleContext.Provider>
  );
}