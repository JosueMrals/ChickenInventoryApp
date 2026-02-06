import React, { createContext, useState, useCallback, useEffect } from "react";
import { calcPriceForProduct } from "../../sales/hooks/useSalePricing";
import { 
  savePreSaleToFirestore, 
  getPreSalesFromFirestore,
  updatePreSaleInFirestore,
} from "../../../services/preSaleService";
import { getProducts } from "../../productsNew1/services/productsService";
import { useRoute } from "../../../context/RouteContext";

export const PreSaleContext = createContext();

export function PreSaleProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [editCart, setEditCart] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [preSales, setPreSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingPreSale, setEditingPreSale] = useState(null);

  const { selectedRoute } = useRoute();

  const applyBonuses = useCallback((currentCart) => {
    // 1. Empezar solo con los items que no son bonificaciones
    // Usamos filter sobre currentCart para asegurar que iteramos sobre la base limpia si vinieran mezclados,
    // pero idealmente 'newCart' son solo los productos de venta.
    const cartItems = currentCart.filter(item => !item.isBonus);
    let newCart = [...cartItems];

    // 2. Iterar sobre los items regulares para calcular sus bonificaciones
    cartItems.forEach(item => {
      const product = item.product;

      // Obtener arreglo de bonificaciones: Prioriza 'bonuses' array, fallback a 'bonus' objeto legacy
      const bonusesConfig = (product.bonuses && Array.isArray(product.bonuses))
          ? product.bonuses
          : (product.bonus && product.bonus.enabled ? [product.bonus] : []);

      bonusesConfig.forEach((bonusInfo, idx) => {
        if (bonusInfo?.enabled && bonusInfo.threshold > 0 && bonusInfo.bonusQuantity > 0 && bonusInfo.bonusProductId) {
            const numberOfBonuses = Math.floor(item.quantity / bonusInfo.threshold);

            if (numberOfBonuses > 0) {
              newCart.push({
                id: `${item.id}_bonus_${idx}_${bonusInfo.bonusProductId}`, // ID único compuesto
                product: {
                    id: bonusInfo.bonusProductId,
                    name: bonusInfo.bonusProductName || 'Producto de regalo',
                },
                quantity: numberOfBonuses * bonusInfo.bonusQuantity,
                unitPrice: 0,
                discount: 0,
                total: 0,
                isBonus: true,
                linkedTo: item.id, // Enlazar al producto que genera la bonificación
                linkedToName: product.name // Nombre del producto padre para visualización
              });
            }
          }
      });
    });
    return newCart;
  }, []);

  const loadPreSales = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {};
      if (selectedRoute?.id) {
        filters.routeId = selectedRoute.id;
      }
      const salesFromDb = await getPreSalesFromFirestore(filters);
      setPreSales(salesFromDb);
    } finally {
      setLoading(false);
    }
  }, [selectedRoute]);

  useEffect(() => {
    loadPreSales();
  }, [loadPreSales]);
  
  const addItem = (product, qty = 1) => {
    setCart(prevCart => {
      const exists = prevCart.find(p => p.id === product.id && !p.isBonus);
      const totalQty = (exists ? exists.quantity : 0) + qty;
      const { priceToUse } = calcPriceForProduct({ product, qty: totalQty, customer });
      
      let updatedCart;
      if (exists) {
        updatedCart = prevCart.map(p =>
          p.id === product.id && !p.isBonus
            ? { ...p, quantity: totalQty, unitPrice: priceToUse, total: totalQty * priceToUse - (p.discount || 0) }
            : p
        );
      } else {
        updatedCart = [...prevCart, {
          id: product.id, product, quantity: qty, unitPrice: priceToUse, discount: 0, total: qty * priceToUse, isBonus: false,
        }];
      }
      return applyBonuses(updatedCart);
    });
  };

  const updateCart = (id, data) => {
    setCart(prev => {
      const updatedCart = prev.map((p) => {
        if (p.id !== id || p.isBonus) return p;
        const pendingUpdate = { ...p, ...data };
        if (data.quantity !== undefined) {
          const { priceToUse } = calcPriceForProduct({ product: p.product, qty: data.quantity, customer });
          pendingUpdate.unitPrice = priceToUse;
        }
        pendingUpdate.total = (pendingUpdate.quantity * pendingUpdate.unitPrice) - (pendingUpdate.discount || 0);
        return pendingUpdate;
      });
      return applyBonuses(updatedCart);
    });
  };
  
  const removeFromCart = (id) => setCart(prev => applyBonuses(prev.filter(p => p.id !== id)));
  
  const addItemToEditCart = (product, qty = 1) => {
    setEditCart(prevCart => {
        const exists = prevCart.find(p => p.id === product.id && !p.isBonus);
        const totalQty = (exists ? exists.quantity : 0) + qty;
        const { priceToUse } = calcPriceForProduct({ product, qty: totalQty, customer });
        
        let updatedCart;
        if (exists) {
            updatedCart = prevCart.map(p =>
              p.id === product.id && !p.isBonus
                ? { ...p, quantity: totalQty, unitPrice: priceToUse, total: totalQty * priceToUse - (p.discount || 0) }
                : p
            );
        } else {
            updatedCart = [...prevCart, {
              id: product.id, product, quantity: qty, unitPrice: priceToUse, discount: 0, total: qty * priceToUse, isBonus: false,
            }];
        }
        return applyBonuses(updatedCart);
    });
  };

  const updateEditCart = (id, data) => {
    setEditCart(prev => {
      const updatedCart = prev.map((p) => {
        if (p.id !== id || p.isBonus) return p;
        const pendingUpdate = { ...p, ...data };
        if (data.quantity !== undefined) {
          const { priceToUse } = calcPriceForProduct({ product: p.product, qty: data.quantity, customer });
          pendingUpdate.unitPrice = priceToUse;
        }
        pendingUpdate.total = (pendingUpdate.quantity * pendingUpdate.unitPrice) - (pendingUpdate.discount || 0);
        return pendingUpdate;
      });
      return applyBonuses(updatedCart);
    });
  };

  const removeFromEditCart = (id) => setEditCart(prev => applyBonuses(prev.filter(p => p.id !== id)));

  const resetPreSale = () => {
    setCart([]);
    setEditCart([]);
    setCustomer(null);
    setEditingPreSale(null);
  };
  
  const submitPreSale = async () => {
    setLoading(true);
    try {
      const cartToSubmit = editingPreSale ? editCart : cart;
      const soldItems = cartToSubmit.filter(i => !i.isBonus);
      const subtotal = soldItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const totalDiscount = soldItems.reduce((sum, item) => sum + (item.discount || 0), 0);
      const total = subtotal - totalDiscount;

      const preSalePayload = {
        customer, cart: cartToSubmit, subtotal, totalDiscount, total,
        route: editingPreSale?.route || selectedRoute || null,
        routeId: editingPreSale?.routeId || selectedRoute?.id || null
      };

      if (editingPreSale) {
        await updatePreSaleInFirestore(editingPreSale.id, editingPreSale, preSalePayload);
      } else {
        await savePreSaleToFirestore(preSalePayload);
      }
      await loadPreSales();
    } finally {
      setLoading(false);
    }
  };

  const loadPreSaleForEditing = async (preSale) => {
    setLoading(true);
    try {
        const allProducts = await getProducts();
        const productsMap = allProducts.reduce((map, p) => ({ ...map, [p.id]: p }), {});

        setEditingPreSale(preSale);
        setCustomer(preSale.customer);

        const cartItems = preSale.items || [];
        const bonusItems = (preSale.bonuses || []).map(b => ({ ...b, isBonus: true }));
        const allItems = [...cartItems, ...bonusItems];

        const reconstructedCart = allItems.map(item => {
            const fullProduct = productsMap[item.productId || item.id];
            return fullProduct ? { ...item, product: fullProduct } : { ...item, product: { id: item.productId, name: item.productName || 'Producto no encontrado' } };
        }).filter(Boolean);
        
        setEditCart(reconstructedCart);
        setCart([]);
    } catch (error) {
        console.error("Error loading pre-sale for editing:", error);
    } finally {
        setLoading(false);
    }
  };

  return (
    <PreSaleContext.Provider
      value={{ 
        cart, customer, setCustomer, addItem, updateCart, removeFromCart, resetPreSale,
        preSales, loading, loadPreSales, submitPreSale,
        editingPreSale, loadPreSaleForEditing,
        editCart, addItemToEditCart, updateEditCart, removeFromEditCart
      }}
    >
      {children}
    </PreSaleContext.Provider>
  );
}
