// services/firebaseService.js
import firestore from '@react-native-firebase/firestore';


const PRODUCTS = 'products';


export const createProduct = async (product) => {
// product must contain: name, barcode, descipction, purchasePrice, profitMargin (percent), salePrice, measureType, wholsalePrice, wholesaleThreshold
const now = firestore.FieldValue.serverTimestamp();
const data = {
...product,
stock: 0,
createdAt: now,
updateAt: now,
};
const ref = await firestore().collection(PRODUCTS).add(data);
return ref.id;
};


export const updateProduct = async (id, updates) => {
const now = firestore.FieldValue.serverTimestamp();
await firestore().collection(PRODUCTS).doc(id).update({ ...updates, updateAt: now });
};


export const getProductByBarcode = async (barcode) => {
const snapshot = await firestore().collection(PRODUCTS).where('barcode', '==', barcode).limit(1).get();
return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
};


export const getProductByName = async (name) => {
const snapshot = await firestore().collection(PRODUCTS).where('name', '==', name).limit(1).get();
return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
};


export const fetchProducts = (onSnapshot, query = null) => {
// query: optional string to search name/barcode
let ref = firestore().collection(PRODUCTS).orderBy('name');
if (query && query.trim()) {
// simple client-side filtering recommended for small datasets; here we'll do where startAt for name
ref = ref.where('name', '>=', query).where('name', '<=', query + '\uf8ff');
}
return ref.onSnapshot(onSnapshot);
};


export const addStock = async (id, qty) => {
const docRef = firestore().collection(PRODUCTS).doc(id);
await firestore().runTransaction(async (tx) => {
const doc = await tx.get(docRef);
if (!doc.exists) throw new Error('Product not found');
const current = doc.data().stock || 0;
tx.update(docRef, { stock: current + qty, updateAt: firestore.FieldValue.serverTimestamp() });
});
};


export default {
createProduct,
updateProduct,
getProductByBarcode,
getProductByName,
fetchProducts,
addStock,
};