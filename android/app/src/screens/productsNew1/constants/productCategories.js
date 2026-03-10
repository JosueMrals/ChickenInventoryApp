export const PRODUCT_CATEGORIES = [
  'Pollo',
  'Huevos',
  'Carnes',
  'Lacteos',
  'Bebidas',
  'Abarrotes',
  'Otros',
];

export const DEFAULT_CATEGORY_LABEL = 'Sin categoria';

export function normalizeCategory(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export function getCategoryLabel(product) {
  const normalized = normalizeCategory(product?.category);
  return normalized || DEFAULT_CATEGORY_LABEL;
}

