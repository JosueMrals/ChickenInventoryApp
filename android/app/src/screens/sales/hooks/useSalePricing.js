/**
 * Motor de precios por producto.
 *
 * Prioridades:
 *  0. Precio por ruta (routePrices): reemplaza el precio base cuando la ruta activa
 *     coincide con una entrada configurada en el producto.
 *  1. Se calculan por separado: descuento mayorista y descuento por categoría.
 *  2. Se aplica el que resulte en precio MÁS BAJO (más beneficioso para el cliente).
 *  3. Si ninguno aplica, se aplica el descuento de cliente.
 *
 * Descuento por categoría (tiers acumulativos):
 *  - Todos los tiers cuya `minQty <= totalUnidadesEnCarritoDeEsaCategoria` aplican.
 *  - Los porcentajes de todos los tiers que aplican se SUMAN.
 *  - Los montos fijos de todos los tiers que aplican se SUMAN.
 *  - Fórmula: precio = precioBase * (1 - totalPct/100) - totalMonto  (mín. 0)
 */

const VALID_DISCOUNT_TYPES = new Set(['percent', 'amount']);

/** Retorna el precio de ruta si la ruta activa tiene un precio configurado, o null */
function getRoutePrice(product, activeRouteId) {
  if (!activeRouteId) return null;
  const routePrices = Array.isArray(product?.routePrices) ? product.routePrices : [];
  const entry = routePrices.find((rp) => rp.routeId === activeRouteId);
  if (entry && Number(entry.price) > 0) return Number(entry.price);
  return null;
}

/** Retorna el precio mayorista aplicable según cantidad, o null si no aplica */
function getWholesalePrice(product, qty) {
  const safeQty = Math.max(Number(qty) || 0, 0);
  const regularPrice = Number(product.salePrice ?? product.price ?? 0) || 0;

  if (Array.isArray(product.wholesalePrices) && product.wholesalePrices.length > 0) {
    const applicable = product.wholesalePrices
      .filter((wp) => safeQty >= Number(wp.quantity || 0) && Number(wp.price || 0) > 0)
      .sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0));

    if (applicable.length > 0) {
      return Number(applicable[0].price) || regularPrice;
    }
  }

  // Compat. legacy: wholesaleThreshold + wholesalePrice
  const threshold = Number(product.wholesaleThreshold || 0);
  const wholesalePrice = Number(product.wholesalePrice || 0);
  if (threshold > 0 && safeQty >= threshold && wholesalePrice > 0) {
    return wholesalePrice;
  }

  return null; // No aplica mayorista
}

/**
 * Calcula el descuento acumulado de todos los tiers de categoría que aplican.
 *
 * @param {object} categoryActivation - { discountTiers: [{minQty, discountType, discountValue, active}] }
 * @param {number} categoryQty - total de UNIDADES de esa categoría en el carrito
 * @returns {{ totalPercent, totalAmount, appliedTiers, lowestMinQty }}
 */
function getStackedCategoryDiscount(categoryActivation, categoryQty) {
  const empty = { totalPercent: 0, totalAmount: 0, appliedTiers: [], lowestMinQty: null };
  const safeQty = Math.max(Number(categoryQty) || 0, 0);
  if (safeQty <= 0) return empty;

  const tiers = Array.isArray(categoryActivation?.discountTiers)
    ? categoryActivation.discountTiers
    : [];

  const appliedTiers = tiers.filter(
    (tier) =>
      tier.active !== false &&
      Number(tier.minQty || 0) > 0 &&
      safeQty >= Number(tier.minQty) &&
      Number(tier.discountValue || 0) > 0 &&
      VALID_DISCOUNT_TYPES.has(String(tier.discountType || '').toLowerCase())
  );

  if (appliedTiers.length === 0) return empty;

  const totalPercent = appliedTiers
    .filter((t) => String(t.discountType).toLowerCase() === 'percent')
    .reduce((sum, t) => sum + Number(t.discountValue), 0);

  const totalAmount = appliedTiers
    .filter((t) => String(t.discountType).toLowerCase() === 'amount')
    .reduce((sum, t) => sum + Number(t.discountValue), 0);

  const lowestMinQty = Math.min(...appliedTiers.map((t) => Number(t.minQty)));

  return { totalPercent, totalAmount, appliedTiers, lowestMinQty };
}

/**
 * Aplica descuento acumulado al precio base.
 * Primero los porcentajes (compuestos), luego los montos fijos.
 */
function applyStackedDiscount(basePrice, totalPercent, totalAmount) {
  let price = basePrice;
  if (totalPercent > 0) {
    price = price * (1 - Math.min(totalPercent, 100) / 100);
  }
  if (totalAmount > 0) {
    price = price - totalAmount;
  }
  return Math.max(0, price);
}

export function calcPriceForProduct({
  product,
  qty = 1,
  customer = null,
  enableCategoryDiscount = false,
  categoryActivation = null,
  categoryQty = 0,
  activeRouteId = null,
}) {
  const defaults = {
    priceToUse: 0,
    basePrice: 0,
    usedWholesale: false,
    pricingSource: 'regular',
    autoDiscountPerUnit: 0,
    autoDiscountTotal: 0,
    appliedDiscountType: null,
    appliedDiscountValue: 0,
    appliedCategoryMinQty: null,
    appliedTiersCount: 0,
  };

  if (!product) return defaults;

  const safeQty = Math.max(Number(qty) || 0, 1);
  const regularPrice = Number(product.salePrice ?? product.price ?? 0) || 0;

  // ── 0. Precio por ruta (reemplaza el precio base) ─────────────────────────
  const routeSpecificPrice = getRoutePrice(product, activeRouteId);
  // El "precio efectivo base" es el de ruta si está configurado, si no el regular
  const effectiveBasePrice = routeSpecificPrice !== null ? routeSpecificPrice : regularPrice;

  // ── 1. Calcular precio mayorista (precio fijo, no depende del base) ────────
  const wholesalePriceValue = getWholesalePrice(product, safeQty);
  const hasWholesale = wholesalePriceValue !== null;

  // ── 2. Calcular precio con descuento por categoría (sobre effectiveBasePrice)
  let categoryDiscountedPrice = null;
  let categoryStacked = null;

  if (enableCategoryDiscount && categoryActivation) {
    categoryStacked = getStackedCategoryDiscount(categoryActivation, categoryQty);
    if (categoryStacked.appliedTiers.length > 0) {
      categoryDiscountedPrice = applyStackedDiscount(
        effectiveBasePrice,
        categoryStacked.totalPercent,
        categoryStacked.totalAmount
      );
    }
  }

  // ── 3. Elegir el menor precio (más beneficioso para el cliente) ───────────
  let priceToUse = effectiveBasePrice;
  let usedWholesale = false;
  let pricingSource = routeSpecificPrice !== null ? 'route' : 'regular';
  let appliedDiscountType = null;
  let appliedDiscountValue = 0;
  let appliedCategoryMinQty = null;
  let appliedTiersCount = 0;

  if (hasWholesale && categoryDiscountedPrice !== null) {
    if (wholesalePriceValue <= categoryDiscountedPrice) {
      priceToUse = wholesalePriceValue;
      usedWholesale = true;
      pricingSource = 'wholesale';
    } else {
      priceToUse = categoryDiscountedPrice;
      pricingSource = 'category';
      appliedDiscountType = categoryStacked.totalPercent > 0 ? 'percent' : 'amount';
      appliedDiscountValue = categoryStacked.totalPercent > 0
        ? categoryStacked.totalPercent
        : categoryStacked.totalAmount;
      appliedCategoryMinQty = categoryStacked.lowestMinQty;
      appliedTiersCount = categoryStacked.appliedTiers.length;
    }
  } else if (hasWholesale) {
    priceToUse = wholesalePriceValue;
    usedWholesale = true;
    pricingSource = 'wholesale';
  } else if (categoryDiscountedPrice !== null) {
    priceToUse = categoryDiscountedPrice;
    pricingSource = 'category';
    appliedDiscountType = categoryStacked.totalPercent > 0 ? 'percent' : 'amount';
    appliedDiscountValue = categoryStacked.totalPercent > 0
      ? categoryStacked.totalPercent
      : categoryStacked.totalAmount;
    appliedCategoryMinQty = categoryStacked.lowestMinQty;
    appliedTiersCount = categoryStacked.appliedTiers.length;
  } else if (pricingSource !== 'route') {
    // ── 4. Descuento de cliente (solo si no aplican mayorista/categoría/ruta) ─
    const customerDiscount = Number(customer?.discount || 0);
    if (customerDiscount > 0) {
      priceToUse = effectiveBasePrice * (1 - customerDiscount / 100);
      pricingSource = 'customer';
      appliedDiscountType = 'percent';
      appliedDiscountValue = customerDiscount;
    }
  } else if (pricingSource === 'route') {
    // Ruta activa, sin mayorista ni categoría: intentar descuento de cliente sobre precio de ruta
    const customerDiscount = Number(customer?.discount || 0);
    if (customerDiscount > 0) {
      const customerPrice = effectiveBasePrice * (1 - customerDiscount / 100);
      if (customerPrice < priceToUse) {
        priceToUse = customerPrice;
        pricingSource = 'route+customer';
        appliedDiscountType = 'percent';
        appliedDiscountValue = customerDiscount;
      }
    }
  }

  priceToUse = Math.max(0, Math.round((priceToUse + Number.EPSILON) * 100) / 100);
  const roundedBasePrice = Math.round((effectiveBasePrice + Number.EPSILON) * 100) / 100;

  const autoDiscountPerUnit = Math.max(0, Number((roundedBasePrice - priceToUse).toFixed(4)));
  const autoDiscountTotal = Number((autoDiscountPerUnit * safeQty).toFixed(4));

  return {
    priceToUse,
    basePrice: roundedBasePrice,
    usedWholesale,
    pricingSource,
    autoDiscountPerUnit,
    autoDiscountTotal,
    appliedDiscountType,
    appliedDiscountValue,
    appliedCategoryMinQty,
    appliedTiersCount,
    routePrice: routeSpecificPrice,
  };
}
