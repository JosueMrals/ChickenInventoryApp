import firestore, { serverTimestamp } from '@react-native-firebase/firestore';

const COLLECTION = 'products';

// Obtener todos
export async function getProducts() {
  const snapshot = await firestore()
    .collection(COLLECTION)
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
}

// Buscar por código
export async function getProductByBarcode(barcode) {
  const query = await firestore()
    .collection(COLLECTION)
    .where('barcode', '==', barcode)
    .limit(1)
    .get();

  if (query.empty) return null;

  const doc = query.docs[0];
  return { id: doc.id, ...doc.data() };
}

// Crear
export async function createProduct(data) {
  data.createdAt = serverTimestamp();
  return await firestore().collection(COLLECTION).add(data);
}

// Actualizar
export async function updateProduct(id, data) {
  return await firestore().collection(COLLECTION).doc(id).update(data);
}

// Eliminar
export async function deleteProduct(id) {
  return await firestore().collection(COLLECTION).doc(id).delete();
}

// Ingreso de stock
export async function addStockToProduct(id, amount) {
  const ref = firestore().collection(COLLECTION).doc(id);

  return await firestore().runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    const current = doc.data().stock || 0;
    transaction.update(ref, { stock: current + amount });
  });
}
