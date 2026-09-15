import { db } from '../../../services/firebase';
import { serverTimestamp } from '@react-native-firebase/firestore';

const COLLECTION = 'suppliers';

// ── Validación pura (sin Firestore) ─────────────────────────────────────────
export function validateSupplierDraft({ name, phone, address, notes } = {}) {
  if (!name || !name.trim()) {
    return { ok: false, message: 'El nombre del proveedor es obligatorio.' };
  }
  return {
    ok: true,
    draft: {
      name: name.trim(),
      phone: (phone || '').trim(),
      address: (address || '').trim(),
      notes: (notes || '').trim(),
    },
  };
}

// ── Persistencia ─────────────────────────────────────────────────────────────
export async function createSupplier(input) {
  const validation = validateSupplierDraft(input);
  if (!validation.ok) throw new Error(validation.message);

  const ref = db.collection(COLLECTION).doc();
  await ref.set({
    ...validation.draft,
    name_lower: validation.draft.name.toLowerCase(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSupplier(supplierId, input) {
  if (!supplierId) throw new Error('supplierId requerido');
  const validation = validateSupplierDraft(input);
  if (!validation.ok) throw new Error(validation.message);

  await db.collection(COLLECTION).doc(supplierId).update({
    ...validation.draft,
    name_lower: validation.draft.name.toLowerCase(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteSupplier(supplierId) {
  if (!supplierId) throw new Error('supplierId requerido');
  await db.collection(COLLECTION).doc(supplierId).delete();
}

export function subscribeSuppliers(onUpdate) {
  const unsubscribe = db.collection(COLLECTION).onSnapshot(
    (snapshot) => {
      const rows = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      onUpdate(rows);
    },
    () => onUpdate([]),
  );
  return unsubscribe;
}

export default {
  validateSupplierDraft,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  subscribeSuppliers,
};
