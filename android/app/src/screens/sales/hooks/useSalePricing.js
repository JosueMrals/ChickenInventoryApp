/**
 * Encapsula la logica de precio por producto considerando prioridad:
 * 1) Mayorista
 * 2) Descuento por categoria (umbral de categoria + valor en producto)
 * 3) Descuento de cliente
 */
function getCategoryActivationMinQty(categoryActivation = null) {
  const direct = Math.max(1, Math.floor(Number(categoryActivation?.activationMinQty || 0)));
  if (direct > 0) return direct;

  const rules = Array.isArray(categoryActivation?.activationRules) ? categoryActivation.activationRules : [];
  const normalized = rules
    .map((rule) => Math.max(1, Math.floor(Number(rule?.minQty || 0))))
    .filter((minQty) => minQty > 0)
    .sort((a, b) => a - b);

  return normalized[0] || 0;
}

function getProductCategoryDiscount(product = {}) {
  const type = String(product?.categoryDiscountType || '').toLowerCase();
  const value = Number(product?.categoryDiscountValue || 0);
  if (['percent', 'amount'].includes(type) && value > 0) {
    return { discountType: type, discountValue: value };
  }

  // Compatibilidad con datos previos por reglas.
  const rules = Array.isArray(product?.categoryDiscountRules) ? product.categoryDiscountRules : [];
  const firstRule = rules
    .map((rule) => ({
      discountType: String(rule?.discountType || '').toLowerCase(),
      discountValue: Number(rule?.discountValue || 0),
      minQty: Math.max(1, Math.floor(Number(rule?.minQty || 0))),
      active: rule?.active !== false,
    }))
    .filter((rule) => rule.active && ['percent', 'amount'].includes(rule.discountType) && rule.discountValue > 0)
    .sort((a, b) => a.minQty - b.minQty)[0];

  if (!firstRule) return null;
  return {
    discountType: firstRule.discountType,
    discountValue: firstRule.discountValue,
  };
}

function getActivatedCategoryTier(categoryActivation = null, categoryQty = 0) {
  const safeQty = Number.isFinite(Number(categoryQty)) ? Math.max(Number(categoryQty), 0) : 0;
  if (safeQty <= 0) return null;

  const rules = Array.isArray(categoryActivation?.activationRules) ? categoryActivation.activationRules : [];
  const normalizedRules = rules
    .map((rule) => ({
      minQty: Math.max(1, Math.floor(Number(rule?.minQty || 0))),
      active: rule?.active !== false,
    }))
    .filter((rule) => rule.active && rule.minQty > 0)
    .sort((a, b) => b.minQty - a.minQty);

  if (normalizedRules.length > 0) {
    return normalizedRules.find((rule) => safeQty >= rule.minQty) || null;
  }

  const fallbackMinQty = Math.max(1, Math.floor(Number(categoryActivation?.activationMinQty || 0)));
  if (fallbackMinQty > 0 && safeQty >= fallbackMinQty) {
    return { minQty: fallbackMinQty, active: true };
  }

  return null;
}

function getApplicableProductCategoryDiscountRule(product = {}, activatedMinQty = 0) {
  const rules = Array.isArray(product?.categoryDiscountRules) ? product.categoryDiscountRules : [];
  const normalizedRules = rules
    .map((rule) => ({
      minQty: Math.max(1, Math.floor(Number(rule?.minQty || 0))),
      discountType: String(rule?.discountType || '').toLowerCase(),
      discountValue: Number(rule?.discountValue || 0),
      active: rule?.active !== false,
    }))
    .filter((rule) => rule.active && ['percent', 'amount'].includes(rule.discountType) && rule.discountValue > 0)
    .sort((a, b) => b.minQty - a.minQty);

  if (normalizedRules.length > 0) {
    const exact = normalizedRules.find((rule) => rule.minQty === activatedMinQty);
    if (exact) return exact;
    return normalizedRules.find((rule) => rule.minQty <= activatedMinQty) || null;
  }

  const legacyType = String(product?.categoryDiscountType || '').toLowerCase();
  const legacyValue = Number(product?.categoryDiscountValue || 0);
  if (['percent', 'amount'].includes(legacyType) && legacyValue > 0) {
    return {
      minQty: Math.max(1, activatedMinQty || 1),
      discountType: legacyType,
      discountValue: legacyValue,
      active: true,
    };
  }

  return null;
}

export function calcPriceForProduct({
  product,
  qty = 1,
  customer = null,
  enableCategoryDiscount = false,
  categoryActivation = null,
  categoryQty = 0,
}) {
  if (!product) {
    return {
      priceToUse: 0,
      basePrice: 0,
      usedWholesale: false,
      pricingSource: 'regular',
      autoDiscountPerUnit: 0,
      autoDiscountTotal: 0,
      appliedDiscountType: null,
      appliedDiscountValue: 0,
      appliedCategoryMinQty: null,
    };
  }

  const safeQty = Number.isFinite(Number(qty)) ? Math.max(Number(qty), 1) : 1;
  const regularPrice = Number(product.salePrice ?? product.price ?? 0) || 0;

  let basePrice = regularPrice;
  let usedWholesale = false;
  let pricingSource = 'regular';
  let appliedDiscountType = null;
  let appliedDiscountValue = 0;
  let appliedCategoryMinQty = null;

  if (Array.isArray(product.wholesalePrices) && product.wholesalePrices.length > 0) {
    const applicablePrices = product.wholesalePrices
      .filter((wp) => safeQty >= Number(wp.quantity || 0) && Number(wp.price || 0) > 0)
      .sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0));

    if (applicablePrices.length > 0) {
      basePrice = Number(applicablePrices[0].price) || regularPrice;
      usedWholesale = true;
      pricingSource = 'wholesale';
    }
  } else {
    const threshold = Number(product.wholesaleThreshold || 0);
    const wholesalePrice = Number(product.wholesalePrice || 0);

    if (threshold > 0 && safeQty >= threshold && wholesalePrice > 0) {
      basePrice = wholesalePrice;
      usedWholesale = true;
      pricingSource = 'wholesale';
    }
  }

  let priceToUse = basePrice;

  if (!usedWholesale && enableCategoryDiscount) {
    const activatedTier = getActivatedCategoryTier(categoryActivation, categoryQty);
    const productRule = activatedTier
      ? getApplicableProductCategoryDiscountRule(product, activatedTier.minQty)
      : null;

    if (productRule?.discountType === 'percent') {
      priceToUse = basePrice * (1 - productRule.discountValue / 100);
      pricingSource = 'category';
      appliedDiscountType = 'percent';
      appliedDiscountValue = productRule.discountValue;
      appliedCategoryMinQty = activatedTier.minQty;
    } else if (productRule?.discountType === 'amount') {
      priceToUse = basePrice - productRule.discountValue;
      pricingSource = 'category';
      appliedDiscountType = 'amount';
      appliedDiscountValue = productRule.discountValue;
      appliedCategoryMinQty = activatedTier.minQty;
    }
  }

  if (!usedWholesale && pricingSource !== 'category') {
    const customerDiscount = Number(customer?.discount || 0);
    if (customerDiscount > 0) {
      priceToUse = basePrice * (1 - customerDiscount / 100);
      pricingSource = 'customer';
      appliedDiscountType = 'percent';
      appliedDiscountValue = customerDiscount;
    }
  }

  priceToUse = Math.max(0, priceToUse);
  priceToUse = Math.round((priceToUse + Number.EPSILON) * 100) / 100;
  basePrice = Math.round((basePrice + Number.EPSILON) * 100) / 100;

  const autoDiscountPerUnit = Math.max(0, Number((basePrice - priceToUse).toFixed(4)));
  const autoDiscountTotal = Number((autoDiscountPerUnit * safeQty).toFixed(4));

  return {
    priceToUse,
    basePrice,
    usedWholesale,
    pricingSource,
    autoDiscountPerUnit,
    autoDiscountTotal,
    appliedDiscountType,
    appliedDiscountValue,
    appliedCategoryMinQty,
  };
}
