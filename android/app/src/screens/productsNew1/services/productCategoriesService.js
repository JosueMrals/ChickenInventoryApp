import { db } from '../../../services/firebase';
import { serverTimestamp } from '@react-native-firebase/firestore';
import { PRODUCT_CATEGORIES, normalizeCategory } from '../constants/productCategories';

const COLLECTION = 'productCategories';

function normalizeName(value) {
  return normalizeCategory(value).replace(/\s+/g, ' ').trim();
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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function createOrActivateCategory(name) {
  const normalized = normalizeName(name);
  if (!normalized) throw new Error('Nombre de categoria requerido');

  const lower = normalized.toLowerCase();
  const snap = await db.collection(COLLECTION).where('name_lower', '==', lower).limit(1).get();

  if (!snap.empty) {
    const doc = snap.docs[0];
    await doc.ref.update({
      name: normalized,
      active: true,
      updatedAt: serverTimestamp(),
    });
    return doc.id;
  }

  const ref = db.collection(COLLECTION).doc();
  await ref.set({
    name: normalized,
    name_lower: lower,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deactivateCategory(categoryId) {
  if (!categoryId) throw new Error('categoryId requerido');
  await db.collection(COLLECTION).doc(categoryId).update({
    active: false,
    updatedAt: serverTimestamp(),
  });
}

export async function listActiveCategories() {
  try {
    await seedDefaultCategoriesIfEmpty();
  } catch (err) {
    if (!isPermissionDeniedError(err)) {
      throw err;
    }
  }

  const snap = await db.collection(COLLECTION).where('active', '==', true).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((item) => !!item?.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function subscribeActiveCategories(onUpdate) {
  let unsubscribe = () => {};

  const startSubscription = () => {
    unsubscribe = db
      .collection(COLLECTION)
      .where('active', '==', true)
      .onSnapshot(
        (snapshot) => {
          const rows = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .filter((item) => !!item?.name)
            .sort((a, b) => a.name.localeCompare(b.name));
          onUpdate(rows);
        },
        (err) => {
          console.error('subscribeActiveCategories error:', err);
          onUpdate([], err);
        }
      );
  };

  seedDefaultCategoriesIfEmpty()
    .catch((err) => {
      if (!isPermissionDeniedError(err)) {
        console.error('seedDefaultCategoriesIfEmpty error:', err);
      }
    })
    .finally(() => {
      startSubscription();
    });

  return () => unsubscribe();
}

export default {
  createOrActivateCategory,
  deactivateCategory,
  listActiveCategories,
  subscribeActiveCategories,
};
