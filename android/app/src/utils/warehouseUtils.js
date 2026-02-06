// src/utils/warehouseUtils.js

/**
 * Agrupa los items de las órdenes por producto, separando cantidades regulares y bonificaciones (regalos).
 * @param {Array} preSales - Lista de órdenes de preventa
 * @param {string} filterStatus - (Opcional) Estado específico del ITEM para filtrar ('pending', 'preparing', 'ready')
 * @returns {Array} Lista de productos agrupados { name, regularQty, bonusQty, totalQty }
 */
export const groupItemsByProduct = (preSales, filterStatus = null) => {
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
      // Fallback para items antiguos sin isBonus explícito (si precio es 0, asumimos regalo, o si viene de bonuses array)
      const isBonus = !!(item.isBonus || (item.unitPrice === 0 && item.total === 0));

      if (!totals[productName]) {
        totals[productName] = {
          name: productName,
          regularQty: 0,
          bonusQty: 0,
          totalQty: 0
        };
      }

      const qty = Number(item.quantity) || 0;

      if (isBonus) {
        totals[productName].bonusQty += qty;
      } else {
        totals[productName].regularQty += qty;
      }
      totals[productName].totalQty += qty;
    });
  });

  // Convertir a array y ordenar por cantidad total descendente
  return Object.values(totals).sort((a, b) => b.totalQty - a.totalQty);
};
