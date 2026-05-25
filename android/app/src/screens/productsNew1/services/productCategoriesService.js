import { db } from '../../../services/firebase';
import auth from '@react-native-firebase/auth';
import { serverTimestamp } from '@react-native-firebase/firestore';
import { PRODUCT_CATEGORIES, normalizeCategory } from '../constants/productCategories';

const COLLECTION = 'productCategories';
const MAX_DISCOUNT_TIERS = 5;

const VALID_DISCOUNT_TYPES = new Set(['percent', 'amount']);

function normalizeName(value) {
  return normalizeCategory(value).replace(/\s+/g, ' ').trim();
}

function normalizeMinQty(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.max(1, Math.floor(parsed));
}

function normalizeDiscountValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(4)) : 0;
}

function normalizeDiscountType(value) {
  const str = String(value || '').toLowerCase();
  return VALID_DISCOUNT_TYPES.has(str) ? str : 'percent';
}

/** Normaliza y depura el array de discount tiers; máximo MAX_DISCOUNT_TIERS */
function sanitizeDiscountTiers(tiers = []) {
  if (!Array.isArray(tiers)) return [];

  const uniqueByQty = new Map();
  tiers.forEach((tier) => {
    const minQty = normalizeMinQty(tier?.minQty);
    if (!minQty) return;
    uniqueByQty.set(minQty, {
      minQty,
      discountType: normalizeDiscountType(tier?.discountType),
      discountValue: normalizeDiscountValue(tier?.discountValue),
      active: tier?.active !== false,
    });
  });

  return Array.from(uniqueByQty.values())
    .sort((a, b) => a.minQty - b.minQty)
    .slice(0, MAX_DISCOUNT_TIERS);
}

/**
 * Migra activationRules legacy (solo minQty) a discountTiers con valores por defecto.
 * Usado para backward-compat al leer documentos viejos.
 */
function migrateActivationRulesToTiers(rules = []) {
  if (!Array.isArray(rules)) return [];
  return rules
    .map((rule) => ({
      minQty: normalizeMinQty(rule?.minQty),
      discountType: normalizeDiscountType(rule?.discountType),
      discountValue: normalizeDiscountValue(rule?.discountValue),
      active: rule?.active !== false,
    }))
    .filter((t) => t.minQty > 0);
}

function buildDiscountTiersPayload(input = {}) {
  // Prioridad: discountTiers nuevo → activationRules legacy → campo raíz de compatibilidad
  let tiers = [];
  if (Array.isArray(input?.discountTiers) && input.discountTiers.length > 0) {
    tiers = sanitizeDiscountTiers(input.discountTiers);
  } else if (Array.isArray(input?.activationRules) && input.activationRules.length > 0) {
    tiers = sanitizeDiscountTiers(migrateActivationRulesToTiers(input.activationRules));
  }
  return {
    discountTiers: tiers,
    // Mantener activationRules sincronizados para backward-compat con componentes no migrados
    activationRules: tiers.map(({ minQty, active }) => ({ minQty, active })),
    hasActivationRules: tiers.length > 0,
  };
}

export function sanitizeCategoryRow(row = {}) {
  const name = normalizeName(row?.name);
  // Leer discountTiers primero; si no existe, migrar desde activationRules
  const rawTiers = Array.isArray(row?.discountTiers) && row.discountTiers.length > 0
    ? row.discountTiers
    : migrateActivationRulesToTiers(row?.activationRules || []);

  const discountTiers = sanitizeDiscountTiers(rawTiers);

  return {
    ...row,
    name,
    discountTiers,
    // Backward compat
    activationRules: discountTiers.map(({ minQty, active }) => ({ minQty, active })),
    hasActivationRules: discountTiers.length > 0,
    active: row?.active !== false,
  };
}

function isPermissionDeniedError(err) {
  const code = String(err?.code || '').toLowerCase();
  const message = String(err?.message || '').toLowerCase();
  return code.includes('permission-denied') || message.includes('permission-denied');
}

async function seedDefaultCategoriesIfEmpty() {
  const snap = await db.collection(COLLECTION).limit(1).get();
  if (!snap.empty) return;

  const batch = db.batch();
  PRODUCT_CATEGORIES.forEach((name) => {
    const normalized = normalizeName(name);
    if (!normalized) return;
    const ref = db.collection(COLLECTION).doc();
    batch.set(ref, {
      name: normalized,
      name_lower: normalized.toLowerCase(),
      active: true,
      discountTiers: [],
      activationRules: [],
      hasActivationRules: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function createOrActivateCategory(name, options = {}) {
  const normalized = normalizeName(name);
  if (!normalized) throw new Error('Nombre de categoria requerido');

  const lower = normalized.toLowerCase();
  const tiersPayload = buildDiscountTiersPayload(options);
  const snap = await db.collection(COLLECTION).where('name_lower', '==', lower).limit(1).get();

  if (!snap.empty) {
    const doc = snap.docs[0];
    await doc.ref.update({
      name: normalized,
      active: true,
      ...tiersPayload,
      updatedAt: serverTimestamp(),
    });
    return doc.id;
  }

  const ref = db.collection(COLLECTION).doc();
  await ref.set({
    name: normalized,
    name_lower: lower,
    active: true,
    ...tiersPayload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCategory(categoryId, updates = {}) {
  if (!categoryId) throw new Error('categoryId requerido');

  const payload = { updatedAt: serverTimestamp() };

  if (Object.prototype.hasOwnProperty.call(updates, 'name')) {
    const normalized = normalizeName(updates.name);
    if (!normalized) throw new Error('Nombre de categoria requerido');
    payload.name = normalized;
    payload.name_lower = normalized.toLowerCase();
  }

  const hasDiscountUpdate =
    Object.prototype.hasOwnProperty.call(updates, 'discountTiers') ||
    Object.prototype.hasOwnProperty.call(updates, 'activationRules');

  if (hasDiscountUpdate) {
    Object.assign(payload, buildDiscountTiersPayload(updates));
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'active')) {
    payload.active = !!updates.active;
  }

  await db.collection(COLLECTION).doc(categoryId).update(payload);
}

export async function setCategoryActive(categoryId, active) {
  if (!categoryId) throw new Error('categoryId requerido');
  await db.collection(COLLECTION).doc(categoryId).update({
    active: !!active,
    updatedAt: serverTimestamp(),
  });
}

export async function deactivateCategory(categoryId) {
  return setCategoryActive(categoryId, false);
}

export async function deleteCategory(categoryId) {
  if (!categoryId) throw new Error('categoryId requerido');
  await db.collection(COLLECTION).doc(categoryId).delete();
}

export async function listCategories({ activeOnly = false } = {}) {
  try {
    await seedDefaultCategoriesIfEmpty();
  } catch (err) {
    if (!isPermissionDeniedError(err)) throw err;
  }

  let query = db.collection(COLLECTION);
  if (activeOnly) query = query.where('active', '==', true);

  const snap = await query.get();
  return snap.docs
    .map((doc) => sanitizeCategoryRow({ id: doc.id, ...doc.data() }))
    .filter((item) => !!item?.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listActiveCategories() {
  return listCategories({ activeOnly: true });
}

export function subscribeCategories(onUpdate, { activeOnly = false } = {}) {
  let unsubscribe = () => {};
  let permissionDeniedLogged = false;

  const stopSubscription = () => { unsubscribe(); unsubscribe = () => {}; };

  const startSubscription = () => {
    let query = db.collection(COLLECTION);
    if (activeOnly) query = query.where('active', '==', true);

    unsubscribe = query.onSnapshot(
      (snapshot) => {
        permissionDeniedLogged = false;
        const rows = snapshot.docs
          .map((doc) => sanitizeCategoryRow({ id: doc.id, ...doc.data() }))
          .filter((item) => !!item?.name)
          .sort((a, b) => a.name.localeCompare(b.name));
        onUpdate(rows);
      },
      (err) => {
        if (isPermissionDeniedError(err)) {
          if (!permissionDeniedLogged) {
            permissionDeniedLogged = true;
            console.warn('subscribeCategories permission denied:', err?.code || err?.message);
          }
        } else {
          console.error('subscribeCategories error:', err);
        }
        onUpdate([], err);
      }
    );
  };

  const authUnsubscribe = auth().onAuthStateChanged((user) => {
    stopSubscription();
    if (!user) { onUpdate([]); return; }
    seedDefaultCategoriesIfEmpty()
      .catch((err) => { if (!isPermissionDeniedError(err)) console.error('seedDefaultCategoriesIfEmpty error:', err); })
      .finally(() => { startSubscription(); });
  });

  return () => { stopSubscription(); authUnsubscribe(); };
}

export function subscribeActiveCategories(onUpdate) {
  return subscribeCategories(onUpdate, { activeOnly: true });
}

export default {
  createOrActivateCategory,
  updateCategory,
  setCategoryActive,
  deactivateCategory,
  deleteCategory,
  listCategories,
  listActiveCategories,
  subscribeCategories,
  subscribeActiveCategories,
};
