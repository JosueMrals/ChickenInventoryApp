import { db } from '../../../services/firebase';
import firestore, { serverTimestamp, increment } from '@react-native-firebase/firestore';

const COLLECTION = 'products';

/* -------------------------
   Create / Update / Delete
   ------------------------- */

export async function createProduct(payload) {
  // payload: see schema above (without createdAt/updatedAt)
  const docRef = db.collection(COLLECTION).doc(); // new doc with generated id
  const data = {
    ...payload,
    // helpful derived fields:
    name_lower: payload.name ? payload.name.toString().toLowerCase() : '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (typeof data.stock === 'undefined') {
    data.stock = 0;
  }
  await docRef.set(data);
  return docRef.id;
}

export async function updateProduct(productId, updates) {
  // updates: partial fields to update
  const docRef = db.collection(COLLECTION).doc(productId);
  const data = {
    ...updates,
    ...(updates.name ? { name_lower: updates.name.toString().toLowerCase() } : {}),
    updatedAt: serverTimestamp(),
  };
  await docRef.update(data);
}

export async function deleteProduct(productId) {
  const docRef = db.collection(COLLECTION).doc(productId);
  await docRef.delete();
}

/* -------------------------
   Getters
   ------------------------- */

export async function getProductById(productId) {
  const docRef = db.collection(COLLECTION).doc(productId);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getProductByBarcode(barcode) {
  if (!barcode && barcode !== 0) return null;
  try {
    const snap = await db.collection(COLLECTION).where('barcode', '==', barcode).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (err) {
    console.error('getProductByBarcode error:', err);
    throw err;
  }
}

export async function getProductByName(name) {
  if (!name) return null;
  try {
    const lower = name.toString().toLowerCase();
    let snap = await db.collection(COLLECTION).where('name_lower', '==', lower).limit(1).get();
    if (!snap.empty) {
      const doc = snap.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    snap = await db.collection(COLLECTION).where('name', '==', name).limit(1).get();
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  } catch (err) {
    console.error('getProductByName error:', err);
    throw err;
  }
}

/* -------------------------
   Real-time subscription
   ------------------------- */

export function subscribeProducts(onUpdate, options = {}) {
  // options: { orderBy: 'name', limit: 200, where: [...] }
  const orderBy = options.orderBy ?? 'name';
  const limit = options.limit ?? 500;
  let ref = db.collection(COLLECTION).orderBy(orderBy).limit(limit);

  if (Array.isArray(options.where)) {
    options.where.forEach(clause => {
      if (Array.isArray(clause) && clause.length === 3) {
        ref = ref.where(clause[0], clause[1], clause[2]);
      }
    });
  }

  const unsubscribe = ref.onSnapshot(snapshot => {
    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    onUpdate(items);
  }, err => {
    console.error('subscribeProducts snapshot error:', err);
    onUpdate([], err);
  });

  return unsubscribe;
}

/* -------------------------
   Search helpers
   ------------------------- */

export async function searchProductsByNamePrefix(prefix, pageSize = 20) {
  if (!prefix) return [];
  const lower = prefix.toString().toLowerCase();
  try {
    const snap = await db
      .collection(COLLECTION)
      .orderBy('name_lower')
      .startAt(lower)
      .endAt(lower + '\uf8ff')
      .limit(pageSize)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('searchProductsByNamePrefix error:', err);
    return [];
  }
}

export async function searchProductsByBarcodeOrName(term, pageSize = 50) {
  // Quick mixed search:
  if (!term && term !== 0) return [];
  const t = term.toString();
  try {
    const byBarcode = await db.collection(COLLECTION).where('barcode', '==', t).limit(20).get();
    if (!byBarcode.empty) return byBarcode.docs.map(d => ({ id: d.id, ...d.data() }));

    const lower = t.toLowerCase();
    try {
      const snap = await db.collection(COLLECTION).orderBy('name_lower').startAt(lower).endAt(lower + '\uf8ff').limit(pageSize).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (errInner) {
      console.error('search fallback failed:', errInner);
      return [];
    }
  } catch (err) {
    console.error('searchProductsByBarcodeOrName error:', err);
    return [];
  }
}

/* -------------------------
   Stock operations
   ------------------------- */

export async function incrementStock(productId, amount) {
  if (!productId) throw new Error('productId required');
  if (Number.isNaN(Number(amount))) throw new Error('amount must be numeric');
  const docRef = db.collection(COLLECTION).doc(productId);
  await docRef.update({
    stock: increment(Number(amount)),
    updatedAt: serverTimestamp(),
  });
}

export async function setStock(productId, newStock) {
  if (!productId) throw new Error('productId required');
  const docRef = db.collection(COLLECTION).doc(productId);
  await docRef.update({
    stock: Number(newStock),
    updatedAt: serverTimestamp(),
  });
}

/* -------------------------
   Utils / validations
   ------------------------- */

export async function validateNoDuplicates({ name, barcode, currentId = null }) {
  if (barcode) {
    const snap = await db.collection(COLLECTION).where('barcode', '==', barcode).limit(1).get();
    if (!snap.empty && snap.docs[0].id !== currentId) {
      return { ok: false, field: 'barcode', message: 'Código de barras ya existe' };
    }
  }

  if (name) {
    const lower = name.toString().toLowerCase();
    let snap = await db.collection(COLLECTION).where('name_lower', '==', lower).limit(1).get();
    if (!snap.empty && snap.docs[0].id !== currentId) {
      return { ok: false, field: 'name', message: 'Nombre ya existe' };
    }
    snap = await db.collection(COLLECTION).where('name', '==', name).limit(1).get();
    if (!snap.empty && snap.docs[0].id !== currentId) {
      return { ok: false, field: 'name', message: 'Nombre ya existe' };
    }
  }

  return { ok: true };
}

/* -------------------------
   Pagination helper (cursor-based)
   ------------------------- */

export async function listProductsPage({ pageSize = 50, startAfterDoc = null } = {}) {
  try {
    let ref = db.collection(COLLECTION).orderBy('name').limit(pageSize);
    if (startAfterDoc) ref = ref.startAfter(startAfterDoc);
    const snap = await ref.get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const last = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
    return { items, lastDoc: last };
  } catch (err) {
    console.error('listProductsPage error:', err);
    return { items: [], lastDoc: null };
  }
}

/* -------------------------
   Export default (optional)
   ------------------------- */

const productsService = {
  createProduct,
  updateProduct,
  deleteProduct,
  getProductById,
  getProductByBarcode,
  getProductByName,
  subscribeProducts,
  searchProductsByNamePrefix,
  searchProductsByBarcodeOrName,
  incrementStock,
  setStock,
  validateNoDuplicates,
  listProductsPage,
};

export default productsService;
