// src/utils/warehouseUtils.js

function normalizeCategoryName(value) {
  const text = String(value || '').trim();
  return text || 'Sin categoria';
}

function resolveCategoryName(item, productCategoryById = {}) {
  const directCategory =
    item?.category ||
    item?.productCategory ||
    item?.categoryName ||
    item?.product?.category;

  if (String(directCategory || '').trim()) {
    return normalizeCategoryName(directCategory);
  }

  const productId = item?.productId || item?.id || item?.product?.id;
  if (!productId) return 'Sin categoria';

  return normalizeCategoryName(productCategoryById[productId]);
}

/**
 * Agrupa los items de las órdenes por producto, separando cantidades regulares y bonificaciones (regalos).
 * @param {Array} preSales - Lista de órdenes de preventa
 * @param {string} filterStatus - (Opcional) Estado específico del ITEM para filtrar ('pending', 'preparing', 'ready')
 * @param {Object} productCategoryById - (Opcional) Mapa productId -> category para fallback legacy
 * @returns {Array} Lista de productos agrupados { name, category, regularQty, bonusQty, totalQty }
 */
export const groupItemsByProduct = (preSales, filterStatus = null, productCategoryById = {}) => {
  const totals = {};

  preSales.forEach(sale => {
    // Si la orden ya está finalizada o cancelada, la ignoramos para el flujo de trabajo activo (opcional, dependiendo de requerimientos)
    // Pero aqui nos interesa filtrar por el estado del ITEM.

    // Unir items normales y bonificaciones legacy/nuevo
    let itemsToProcess = [];

    // 1. Items en el arreglo principal 'items'
    if (sale.items && Array.isArray(sale.items)) {
        itemsToProcess = itemsToProcess.concat(sale.items);
    }

    // 2. Bonificaciones en el arreglo 'bonuses' (si existe en la orden)
    if (sale.bonuses && Array.isArray(sale.bonuses)) {
        // Asegurar que tengan flag isBonus
        const bonuses = sale.bonuses.map(b => ({ ...b, isBonus: true }));
        itemsToProcess = itemsToProcess.concat(bonuses);
    }

    itemsToProcess.forEach(item => {
      // Verificar estado individual del item
      // Si no tiene estado, se asume 'pending'
      const itemStatus = item.status || 'pending';

      // Si se especificó un filtro de estado y no coincide, saltamos este item
      if (filterStatus && itemStatus !== filterStatus) return;

      // Normalizar nombre
      const productName = item.name || item.productName || item.product?.name || 'Item Desconocido';
      const categoryName = resolveCategoryName(item, productCategoryById);
      const isBonus = !!(item.isBonus || (item.unitPrice === 0 && item.total === 0));
      const productKey = `${categoryName}::${productName}`;

      if (!totals[productKey]) {
        totals[productKey] = {
          key: productKey,
          name: productName,
          category: categoryName,
          regularQty: 0,
          bonusQty: 0,
          totalQty: 0
        };
      }

      const qty = Number(item.quantity) || 0;

      if (isBonus) {
        totals[productKey].bonusQty += qty;
      } else {
        totals[productKey].regularQty += qty;
      }
      totals[productKey].totalQty += qty;
    });
  });

  // Convertir a array y ordenar por cantidad total descendente
  return Object.values(totals).sort((a, b) => b.totalQty - a.totalQty);
};

/**
 * Reagrupa productos agregados por su categoría para renderizar secciones en la UI.
 */
export const groupAggregatedProductsByCategory = (products = []) => {
  const grouped = products.reduce((acc, item) => {
    const category = normalizeCategoryName(item?.category);
    if (!acc[category]) {
      acc[category] = {
        category,
        products: [],
        totalQty: 0,
      };
    }

    acc[category].products.push(item);
    acc[category].totalQty += Number(item?.totalQty || 0);
    return acc;
  }, {});

  return Object.values(grouped)
    .map((section) => ({
      ...section,
      products: section.products.sort((a, b) => b.totalQty - a.totalQty),
    }))
    .sort((a, b) => b.totalQty - a.totalQty);
};
