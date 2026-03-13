import React, { createContext, useState, useCallback, useEffect } from "react";
import { calcPriceForProduct } from "../../sales/hooks/useSalePricing";
import { 
  savePreSaleToFirestore, 
  getPreSalesFromFirestore,
  updatePreSaleInFirestore,
  deletePreSaleInFirestore,
} from "../../../services/preSaleService";
import { getProducts } from "../../productsNew1/services/productsService";
import { useRoute } from "../../../context/RouteContext";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { subscribeActiveCategories } from "../../productsNew1/services/productCategoriesService";
import { normalizeCategory } from "../../productsNew1/constants/productCategories";

export const PreSaleContext = createContext();

function getCategoryActivationMap(rows = []) {
  return rows.reduce((acc, row) => {
    const key = normalizeCategory(row?.name).toLowerCase();
    if (!key || !row?.active) return acc;

    const directMinQty = Math.max(1, Math.floor(Number(row?.activationMinQty || 0)));
    const activationRules = Array.isArray(row?.activationRules)
      ? row.activationRules
          .map((rule) => ({
            minQty: Math.max(1, Math.floor(Number(rule?.minQty || 0))),
            active: rule?.active !== false,
          }))
          .filter((rule) => rule.active && rule.minQty > 0)
          .sort((a, b) => a.minQty - b.minQty)
      : [];

    const activationMinQty = directMinQty || activationRules[0]?.minQty || 0;
    if (!activationMinQty) return acc;

    acc[key] = {
      activationMinQty,
      activationRules,
      hasActivationRules: true,
    };
    return acc;
  }, {});
}

function roundTo2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function getPricingFields(pricing = {}, quantity = 0) {
  const safeQuantity = Number(quantity) || 0;
  const fields = {
    baseUnitPrice: Number(pricing.basePrice || 0),
    pricingSource: pricing.pricingSource || 'regular',
    autoDiscountPerUnit: Number(pricing.autoDiscountPerUnit || 0),
    autoDiscountTotal: Number(pricing.autoDiscountTotal || 0),
  };

  if (fields.pricingSource === 'category') {
    fields.categoryDiscountType = pricing.appliedDiscountType || null;
    fields.categoryDiscountValue = Number(pricing.appliedDiscountValue || 0);
    fields.categoryDiscountMinQty = Number(pricing.appliedCategoryMinQty || 0) || null;
  }

  if (fields.pricingSource === 'customer') {
    fields.customerDiscountPercent = Number(pricing.appliedDiscountValue || 0);
  }

  if (fields.pricingSource === 'wholesale') {
    fields.usedWholesale = true;
  }

  fields.lineBaseTotal = Number((fields.baseUnitPrice * safeQuantity).toFixed(2));

  return fields;
}

export function PreSaleProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [editCart, setEditCart] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [preSales, setPreSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingPreSale, setEditingPreSale] = useState(null);
  const [customersById, setCustomersById] = useState({});
  const [categoryDiscountMap, setCategoryDiscountMap] = useState({});

  const { selectedRoute } = useRoute();

  useEffect(() => {
    const unsubscribe = subscribeActiveCategories((rows) => {
      setCategoryDiscountMap(getCategoryActivationMap(rows));
    });
    return () => unsubscribe();
  }, []);

  const getCategoryActivationForProduct = useCallback((product) => {
    const categoryKey = normalizeCategory(product?.category).toLowerCase();
    if (!categoryKey) return null;
    return categoryDiscountMap[categoryKey] || null;
  }, [categoryDiscountMap]);

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

  const recalculateSoldItems = useCallback((items = []) => {
    const soldItems = items.filter((item) => !item.isBonus);

    // Cuenta ítems distintos por categoría (no unidades).
    const categoryQtyMap = soldItems.reduce((acc, item) => {
      const categoryKey = normalizeCategory(item?.product?.category).toLowerCase();
      if (!categoryKey) return acc;
      acc[categoryKey] = (acc[categoryKey] || 0) + 1;
      return acc;
    }, {});

    return soldItems.map((item) => {
      const categoryKey = normalizeCategory(item?.product?.category).toLowerCase();
      const categoryQty = categoryQtyMap[categoryKey] || 0;
      const manualDiscount = Math.max(0, Number(item.discount || 0));
      const hasManualDiscount = manualDiscount > 0;

      const pricing = calcPriceForProduct({
        product: item.product,
        qty: item.quantity,
        customer,
        enableCategoryDiscount: !hasManualDiscount,
        categoryActivation: getCategoryActivationForProduct(item.product),
        categoryQty,
      });

      const lineTotal = roundTo2(Number(item.quantity || 0) * Number(pricing.priceToUse || 0));
      const safeDiscount = Math.min(manualDiscount, lineTotal);
      const isCategoryDiscountActive = !hasManualDiscount && pricing.pricingSource === 'category';

      return {
        ...item,
        unitPrice: pricing.priceToUse,
        discount: safeDiscount,
        ...getPricingFields(pricing, item.quantity),
        categoryQtyApplied: categoryQty,
        isCategoryDiscountActive,
        categoryDiscountBadge: isCategoryDiscountActive
          ? `Categoria activa ${pricing.appliedCategoryMinQty}+`
          : null,
        pricingSource: hasManualDiscount ? 'manual' : (pricing.pricingSource || 'regular'),
        total: roundTo2(lineTotal - safeDiscount),
      };
    });
  }, [customer, getCategoryActivationForProduct]);

  const recalculateFullCart = useCallback((items = []) => {
    const soldItems = recalculateSoldItems(items);
    return applyBonuses(soldItems);
  }, [applyBonuses, recalculateSoldItems]);

  useEffect(() => {
    setCart((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;
      return recalculateFullCart(prev);
    });

    setEditCart((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;
      return recalculateFullCart(prev);
    });
  }, [recalculateFullCart]);

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
    setCart((prevCart) => {
      const soldItems = prevCart.filter((item) => !item.isBonus);
      const exists = soldItems.find((item) => item.id === product.id);

      const nextSoldItems = exists
        ? soldItems.map((item) => (
            item.id === product.id
              ? { ...item, quantity: (Number(item.quantity) || 0) + qty }
              : item
          ))
        : [
            ...soldItems,
            {
              id: product.id,
              product,
              quantity: qty,
              unitPrice: Number(product.salePrice ?? product.price ?? 0) || 0,
              discount: 0,
              total: 0,
              isBonus: false,
            },
          ];

      return recalculateFullCart(nextSoldItems);
    });
  };

  const updateCart = (id, data) => {
    setCart((prev) => {
      const soldItems = prev.filter((item) => !item.isBonus);
      const nextSoldItems = soldItems.map((item) => {
        if (item.id !== id) return item;
        return { ...item, ...data };
      }).filter((item) => (Number(item.quantity) || 0) > 0);

      return recalculateFullCart(nextSoldItems);
    });
  };

  const removeFromCart = (id) => setCart((prev) => {
    const soldItems = prev.filter((item) => !item.isBonus && item.id !== id);
    return recalculateFullCart(soldItems);
  });

  const addItemToEditCart = (product, qty = 1) => {
    setEditCart((prevCart) => {
      const soldItems = prevCart.filter((item) => !item.isBonus);
      const exists = soldItems.find((item) => item.id === product.id);

      const nextSoldItems = exists
        ? soldItems.map((item) => (
            item.id === product.id
              ? { ...item, quantity: (Number(item.quantity) || 0) + qty }
              : item
          ))
        : [
            ...soldItems,
            {
              id: product.id,
              product,
              quantity: qty,
              unitPrice: Number(product.salePrice ?? product.price ?? 0) || 0,
              discount: 0,
              total: 0,
              isBonus: false,
            },
          ];

      return recalculateFullCart(nextSoldItems);
    });
  };

  const updateEditCart = (id, data) => {
    setEditCart((prev) => {
      const soldItems = prev.filter((item) => !item.isBonus);
      const nextSoldItems = soldItems.map((item) => {
        if (item.id !== id) return item;
        return { ...item, ...data };
      }).filter((item) => (Number(item.quantity) || 0) > 0);

      return recalculateFullCart(nextSoldItems);
    });
  };

  const removeFromEditCart = (id) => setEditCart((prev) => {
    const soldItems = prev.filter((item) => !item.isBonus && item.id !== id);
    return recalculateFullCart(soldItems);
  });

  const resetPreSale = () => {
    setCart([]);
    setEditCart([]);
    setCustomer(null);
    setEditingPreSale(null);
  };
  
  const submitPreSale = async (options = {}) => {
    setLoading(true);
    try {
      const cartToSubmit = editingPreSale ? editCart : cart;
      const soldItems = cartToSubmit.filter(i => !i.isBonus);
      const subtotal = soldItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const totalDiscount = soldItems.reduce((sum, item) => sum + (item.discount || 0), 0);
      const total = subtotal - totalDiscount;
      const categoryDiscountTotalByCategory = soldItems.reduce((acc, item) => {
        if (item.pricingSource !== 'category') return acc;
        const categoryKey = normalizeCategory(item?.product?.category).toLowerCase() || '__no_category__';
        acc[categoryKey] = (acc[categoryKey] || 0) + Number(item.autoDiscountTotal || 0);
        return acc;
      }, {});

      const categoryDiscountTotal = Object.values(categoryDiscountTotalByCategory)
        .reduce((sum, value) => sum + roundTo2(value), 0);
      const paymentMethod = options.paymentMethod || editingPreSale?.paymentMethod || 'cash';

      const preSalePayload = {
        customer, cart: cartToSubmit, subtotal, totalDiscount, total,
        categoryDiscountTotal,
        paymentMethod,
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
        
        setEditCart(recalculateFullCart(reconstructedCart));
        setCart([]);
    } catch (error) {
        console.error("Error loading pre-sale for editing:", error);
    } finally {
        setLoading(false);
    }
  };

  const deletePreSale = async ({ preSaleId, reason }) => {
    setLoading(true);
    try {
      await deletePreSaleInFirestore({ preSaleId, reason });
      await loadPreSales();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let customersUnsub = null;
    const authUnsub = auth().onAuthStateChanged((user) => {
      if (customersUnsub) {
        customersUnsub();
        customersUnsub = null;
      }

      if (!user) {
        setCustomersById({});
        return;
      }

      customersUnsub = firestore()
        .collection("customers")
        .onSnapshot(
          (snapshot) => {
            if (!snapshot) {
              setCustomersById({});
              return;
            }
            const map = snapshot.docs.reduce((acc, doc) => {
              acc[doc.id] = { id: doc.id, ...doc.data() };
              return acc;
            }, {});
            setCustomersById(map);
          },
          (error) => {
            console.error("Firestore customers snapshot error:", error);
            setCustomersById({});
          }
        );
    });

    return () => {
      if (customersUnsub) {
        customersUnsub();
      }
      if (authUnsub) {
        authUnsub();
      }
    };
  }, []);

  return (
    <PreSaleContext.Provider
      value={{ 
        cart, customer, setCustomer, addItem, updateCart, removeFromCart, resetPreSale,
        preSales, loading, loadPreSales, submitPreSale,
        editingPreSale, loadPreSaleForEditing,
        editCart, addItemToEditCart, updateEditCart, removeFromEditCart,
        customersById,
        deletePreSale,
      }}
    >
      {children}
    </PreSaleContext.Provider>
  );
}
