import React, { createContext, useState, useCallback, useEffect } from "react";
import { calcPriceForProduct } from "../../sales/hooks/useSalePricing";
import { 
  savePreSaleToFirestore, 
  getPreSalesFromFirestore,
  updatePreSaleInFirestore,
} from "../../../services/preSaleService";
import { getProducts } from "../../products/services/productService";
import { useRoute } from "../../../context/RouteContext";

export const PreSaleContext = createContext();

export function PreSaleProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [editCart, setEditCart] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [preSales, setPreSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingPreSale, setEditingPreSale] = useState(null);

  // Obtener la ruta seleccionada del contexto global
  const { selectedRoute } = useRoute();

  const applyBonuses = useCallback((currentCart) => {
    let newCart = [...currentCart].filter(item => !item.isBonus);
    currentCart.forEach(item => {
      if (item.isBonus) return;
      const product = item.product;
      const { bonusEnabled, bonusThreshold, bonusQuantity } = product || {};
      if (bonusEnabled && bonusThreshold > 0 && bonusQuantity > 0) {
        const numberOfBonuses = Math.floor(item.quantity / bonusThreshold);
        if (numberOfBonuses > 0) {
          newCart.push({
            id: `${item.id}_bonus`,
            product: product,
            quantity: numberOfBonuses * bonusQuantity,
            unitPrice: 0,
            discount: 0,
            total: 0,
            isBonus: true,
            linkedTo: item.id,
          });
        }
      }
    });
    return newCart;
  }, []);

  const loadPreSales = useCallback(async () => {
    setLoading(true);
    try {
      // Aplicar filtro por ruta si existe
      const filters = {};
      if (selectedRoute && selectedRoute.id) {
        filters.routeId = selectedRoute.id;
      }

      const salesFromDb = await getPreSalesFromFirestore(filters);
      setPreSales(salesFromDb);
    } finally {
      setLoading(false);
    }
  }, [selectedRoute]); // Recargar si cambia la ruta

  // Efecto para recargar las ventas cuando cambia la ruta
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
      const updatedCart = prev.map((p) => {
        if (p.id !== id || p.isBonus) return p;
        const pendingUpdate = { ...p, ...data };
        if (data.quantity !== undefined && data.unitPrice === undefined) {
          const { priceToUse } = calcPriceForProduct({ product: p.product, qty: data.quantity, customer });
          pendingUpdate.unitPrice = priceToUse;
        }
        if (pendingUpdate.discountType === 'percent' && pendingUpdate.discountValue > 0) {
          const productTotal = pendingUpdate.quantity * pendingUpdate.unitPrice;
          pendingUpdate.discount = (productTotal * pendingUpdate.discountValue) / 100;
        }
        pendingUpdate.total = pendingUpdate.quantity * pendingUpdate.unitPrice - pendingUpdate.discount;
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

  const updateEditCart = (id, data) => {
    setEditCart(prev => {
      const updatedCart = prev.map((p) => {
        if (p.id !== id || p.isBonus) return p;
        const pendingUpdate = { ...p, ...data };
        if (data.quantity !== undefined && data.unitPrice === undefined) {
          const { priceToUse } = calcPriceForProduct({ product: p.product, qty: data.quantity, customer });
          pendingUpdate.unitPrice = priceToUse;
        }
        if (pendingUpdate.discountType === 'percent' && pendingUpdate.discountValue > 0) {
          const productTotal = pendingUpdate.quantity * pendingUpdate.unitPrice;
          pendingUpdate.discount = (productTotal * pendingUpdate.discountValue) / 100;
        }
        pendingUpdate.total = pendingUpdate.quantity * pendingUpdate.unitPrice - pendingUpdate.discount;
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
      const totalDiscount = soldItems.reduce((sum, item) => sum + item.discount, 0);
      const total = subtotal - totalDiscount;

      // Vinculamos la ruta seleccionada
      const preSalePayload = {
        customer,
        cart: cartToSubmit,
        subtotal,
        totalDiscount,
        total,
        route: selectedRoute || null, // Guardamos el objeto completo de la ruta
        routeId: selectedRoute?.id || null // Aseguramos que routeId se pase explícitamente para el servicio
      };

      if (editingPreSale) {
        await updatePreSaleInFirestore(editingPreSale.id, editingPreSale, preSalePayload);
      } else {
        await savePreSaleToFirestore(preSalePayload);
      }
      await loadPreSales(); // Recargar la lista después de guardar
    } finally {
      setLoading(false);
    }
  };

  const loadPreSaleForEditing = async (preSale) => {
    setLoading(true);
    try {
        const allProducts = await getProducts();
        const productsMap = allProducts.reduce((map, p) => {
            map[p.id] = p;
            return map;
        }, {});

        setEditingPreSale(preSale);
        setCustomer(preSale.customer);

        const cartItems = preSale.cart || preSale.items || [];
        const reconstructedCart = cartItems
            .map(item => {
                const fullProduct = productsMap[item.productId || item.id];
                if (!fullProduct) {
                    console.warn(`Product with ID ${item.productId || item.id} not found.`);
                    return {
                        ...item,
                        product: { id: item.productId || item.id, name: item.productName || 'Producto no encontrado' },
                    };
                }
                return {
                    ...item,
                    product: fullProduct,
                };
            })
            .filter(Boolean);
        
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
