/**
 * migrateCategoryDiscounts.js
 *
 * Migración: mueve los descuentos por categoría DESDE los productos (campo `categoryDiscountRules`)
 * HACIA las categorías (campo `discountTiers`).
 *
 * Estrategia:
 *  - Para cada categoría, recoge los `categoryDiscountRules` de todos sus productos.
 *  - Construye los discountTiers usando el consenso: para cada minQty que aparezca,
 *    toma el valor de descuento más frecuente (moda); en caso de empate, usa el mayor.
 *  - Actualiza el documento de la categoría con los discountTiers resultantes.
 *  - No borra los datos del producto (backward compat), solo agrega `categoryDiscountRulesMigrated: true`.
 *
 * Uso (se llama desde un AdminScreen o un script Node.js):
 *   import { runMigration } from './migrateCategoryDiscounts';
 *   const result = await runMigration({ dryRun: true });   // solo reporta, no escribe
 *   const result = await runMigration({ dryRun: false });  // aplica cambios
 */

import firestore from '@react-native-firebase/firestore';

const PRODUCTS_COLLECTION = 'products';
const CATEGORIES_COLLECTION = 'productCategories';

function normalizeCategory(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeMinQty(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.max(1, Math.floor(n)) : 0;
}

function normalizeDiscountType(value) {
  const s = String(value || '').toLowerCase();
  return ['percent', 'amount'].includes(s) ? s : 'percent';
}

function normalizeDiscountValue(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Number(n.toFixed(4)) : 0;
}

/**
 * Dado un array de {discountType, discountValue} para el mismo minQty,
 * devuelve el valor más frecuente (moda); en empate, el mayor.
 */
function consensusDiscount(entries = []) {
  if (!entries.length) return null;

  const freq = {};
  entries.forEach(({ discountType, discountValue }) => {
    const key = `${discountType}:${discountValue}`;
    freq[key] = (freq[key] || 0) + 1;
  });

  let maxFreq = 0;
  let winner = null;

  Object.entries(freq).forEach(([key, count]) => {
    const [discountType, discountValueStr] = key.split(':');
    const discountValue = Number(discountValueStr);
    if (
      count > maxFreq ||
      (count === maxFreq && winner && discountValue > winner.discountValue)
    ) {
      maxFreq = count;
      winner = { discountType, discountValue };
    }
  });

  return winner;
}

export async function runMigration({ dryRun = true } = {}) {
  console.log(`[Migration] Iniciando${dryRun ? ' (DRY RUN)' : ''}...`);

  // 1. Leer todos los productos
  const productsSnap = await firestore().collection(PRODUCTS_COLLECTION).get();
  const products = productsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  console.log(`[Migration] ${products.length} productos encontrados.`);

  // 2. Leer todas las categorías
  const categoriesSnap = await firestore().collection(CATEGORIES_COLLECTION).get();
  const categoryByName = {};
  categoriesSnap.docs.forEach((doc) => {
    const data = doc.data();
    const key = normalizeCategory(data.name).toLowerCase();
    if (key) categoryByName[key] = { id: doc.id, ...data };
  });
  console.log(`[Migration] ${Object.keys(categoryByName).length} categorías encontradas.`);

  // 3. Agrupar reglas de descuento por categoría
  // { categoryKey: { minQty: [{ discountType, discountValue }] } }
  const rulesByCategoryAndQty = {};

  products.forEach((product) => {
    const categoryKey = normalizeCategory(product.category).toLowerCase();
    if (!categoryKey) return;

    const rules = Array.isArray(product.categoryDiscountRules) ? product.categoryDiscountRules : [];
    if (!rules.length) return;

    if (!rulesByCategoryAndQty[categoryKey]) rulesByCategoryAndQty[categoryKey] = {};

    rules.forEach((rule) => {
      const minQty = normalizeMinQty(rule?.minQty);
      const discountType = normalizeDiscountType(rule?.discountType);
      const discountValue = normalizeDiscountValue(rule?.discountValue);
      if (!minQty || !discountValue) return;

      if (!rulesByCategoryAndQty[categoryKey][minQty]) {
        rulesByCategoryAndQty[categoryKey][minQty] = [];
      }
      rulesByCategoryAndQty[categoryKey][minQty].push({ discountType, discountValue });
    });
  });

  // 4. Construir discountTiers por categoría usando consenso
  const migrationPlan = [];

  Object.entries(rulesByCategoryAndQty).forEach(([categoryKey, qtyMap]) => {
    const category = categoryByName[categoryKey];
    if (!category) {
      console.warn(`[Migration] Categoría no encontrada en Firestore: "${categoryKey}" — se omite.`);
      return;
    }

    // Si la categoría ya tiene discountTiers con valores, no sobreescribir
    const existingTiers = Array.isArray(category.discountTiers)
      ? category.discountTiers.filter((t) => Number(t?.discountValue || 0) > 0)
      : [];

    if (existingTiers.length > 0) {
      console.log(`[Migration] Categoría "${categoryKey}" ya tiene discountTiers — se omite.`);
      return;
    }

    const discountTiers = Object.entries(qtyMap)
      .map(([minQtyStr, entries]) => {
        const minQty = Number(minQtyStr);
        const consensus = consensusDiscount(entries);
        if (!consensus) return null;
        return {
          minQty,
          discountType: consensus.discountType,
          discountValue: consensus.discountValue,
          active: true,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.minQty - b.minQty)
      .slice(0, 5);

    if (discountTiers.length > 0) {
      migrationPlan.push({
        categoryId: category.id,
        categoryName: category.name,
        discountTiers,
      });
    }
  });

  console.log(`[Migration] ${migrationPlan.length} categoría(s) a actualizar:`);
  migrationPlan.forEach((plan) => {
    console.log(
      `  → ${plan.categoryName}: ${plan.discountTiers.map(
        (t) => `${t.minQty}+(${t.discountType === 'percent' ? t.discountValue + '%' : 'C$' + t.discountValue})`
      ).join(', ')}`
    );
  });

  if (dryRun) {
    console.log('[Migration] DRY RUN — no se realizaron cambios.');
    return { migrated: 0, plan: migrationPlan, dryRun: true };
  }

  // 5. Aplicar cambios
  const batch = firestore().batch();
  const now = firestore.FieldValue.serverTimestamp();

  migrationPlan.forEach(({ categoryId, discountTiers }) => {
    const ref = firestore().collection(CATEGORIES_COLLECTION).doc(categoryId);
    batch.update(ref, {
      discountTiers,
      // Mantener activationRules sincronizados
      activationRules: discountTiers.map(({ minQty, active }) => ({ minQty, active })),
      hasActivationRules: true,
      updatedAt: now,
      migratedFrom: 'productCategoryDiscountRules',
    });
  });

  // Marcar productos migrados (no borrar datos, solo flag)
  products.forEach((product) => {
    const categoryKey = normalizeCategory(product.category).toLowerCase();
    const rules = Array.isArray(product.categoryDiscountRules) ? product.categoryDiscountRules : [];
    if (!rules.length || !categoryKey) return;
    if (!rulesByCategoryAndQty[categoryKey]) return;

    const productRef = firestore().collection(PRODUCTS_COLLECTION).doc(product.id);
    batch.update(productRef, { categoryDiscountRulesMigrated: true });
  });

  await batch.commit();

  console.log(`[Migration] ✅ Completada. ${migrationPlan.length} categoría(s) actualizadas.`);
  return { migrated: migrationPlan.length, plan: migrationPlan, dryRun: false };
}

