import { db } from '../../../services/firebase';
import auth from '@react-native-firebase/auth';
import { serverTimestamp } from '@react-native-firebase/firestore';
import { PRODUCT_CATEGORIES, normalizeCategory } from '../constants/productCategories';

const COLLECTION = 'productCategories';
const MAX_ACTIVATION_RULES = 5;

function normalizeName(value) {
  return normalizeCategory(value).replace(/\s+/g, ' ').trim();
}

function normalizeMinQty(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.max(1, Math.floor(parsed));
}

function sanitizeActivationRules(rules = []) {
  if (!Array.isArray(rules)) return [];

  const uniqueByQty = new Map();
  rules.forEach((rule) => {
    const minQty = normalizeMinQty(rule?.minQty);
    if (!minQty) return;
    uniqueByQty.set(minQty, {
      minQty,
      active: rule?.active !== false,
    });
  });

  return Array.from(uniqueByQty.values())
    .sort((a, b) => a.minQty - b.minQty)
    .slice(0, MAX_ACTIVATION_RULES);
}

function buildLegacyActivationRules(input = {}) {
  const discountRules = Array.isArray(input?.discountRules) ? input.discountRules : [];
  const fromRules = discountRules
    .map((rule) => ({ minQty: normalizeMinQty(rule?.minQty), active: rule?.active !== false }))
    .filter((rule) => rule.minQty > 0);

  if (fromRules.length > 0) {
    return sanitizeActivationRules(fromRules);
  }

  const hasLegacySingleDiscount = Number(input?.discountValue || 0) > 0;
  if (hasLegacySingleDiscount) {
    return [{ minQty: 1, active: true }];
  }

  return [];
}

function buildActivationPayload(input = {}) {
  const activationRules = sanitizeActivationRules(input.activationRules);
  const normalizedRules = activationRules.length > 0 ? activationRules : buildLegacyActivationRules(input);
  return {
    activationRules: normalizedRules,
    hasActivationRules: normalizedRules.length > 0,
  };
}

function sanitizeCategoryRow(row = {}) {
  const name = normalizeName(row?.name);
  const activationRules = sanitizeActivationRules(row?.activationRules);
  const normalizedRules = activationRules.length > 0 ? activationRules : buildLegacyActivationRules(row);

  return {
    ...row,
    name,
    activationRules: normalizedRules,
    hasActivationRules: normalizedRules.length > 0,
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
  const activationPayload = buildActivationPayload(options);
  const snap = await db.collection(COLLECTION).where('name_lower', '==', lower).limit(1).get();

  if (!snap.empty) {
    const doc = snap.docs[0];
    await doc.ref.update({
      name: normalized,
      active: true,
      ...activationPayload,
      updatedAt: serverTimestamp(),
    });
    return doc.id;
  }

  const ref = db.collection(COLLECTION).doc();
  await ref.set({
    name: normalized,
    name_lower: lower,
    active: true,
    ...activationPayload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCategory(categoryId, updates = {}) {
  if (!categoryId) throw new Error('categoryId requerido');

  const payload = {
    updatedAt: serverTimestamp(),
  };

  if (Object.prototype.hasOwnProperty.call(updates, 'name')) {
    const normalized = normalizeName(updates.name);
    if (!normalized) throw new Error('Nombre de categoria requerido');
    payload.name = normalized;
    payload.name_lower = normalized.toLowerCase();
  }

  if (
    Object.prototype.hasOwnProperty.call(updates, 'activationRules') ||
    Object.prototype.hasOwnProperty.call(updates, 'discountRules') ||
    Object.prototype.hasOwnProperty.call(updates, 'discountType') ||
    Object.prototype.hasOwnProperty.call(updates, 'discountValue')
  ) {
    Object.assign(payload, buildActivationPayload(updates));
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
    if (!isPermissionDeniedError(err)) {
      throw err;
    }
  }

  let query = db.collection(COLLECTION);
  if (activeOnly) {
    query = query.where('active', '==', true);
  }

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

  const stopSubscription = () => {
    unsubscribe();
    unsubscribe = () => {};
  };

  const startSubscription = () => {
    let query = db.collection(COLLECTION);
    if (activeOnly) {
      query = query.where('active', '==', true);
    }

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
            console.warn('subscribeCategories permission denied:', err?.code || err?.message || err);
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

    if (!user) {
      onUpdate([]);
      return;
    }

    seedDefaultCategoriesIfEmpty()
      .catch((err) => {
        if (!isPermissionDeniedError(err)) {
          console.error('seedDefaultCategoriesIfEmpty error:', err);
        }
      })
      .finally(() => {
        startSubscription();
      });
  });

  return () => {
    stopSubscription();
    authUnsubscribe();
  };
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
