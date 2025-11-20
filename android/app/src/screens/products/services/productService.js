import { firestore } from '../../../services/firebaseConfig';

/**
 * payload example:
 * {
 *  name, purchasePrice, salePrice, stock, wholesaleThreshold, wholesalePrice, updatedAt
 * }
 */

export async function createProduct(payload) {
  const doc = {
    name: payload.name,
    purchasePrice: payload.purchasePrice ?? 0,
    salePrice: payload.salePrice ?? 0,
    stock: payload.stock ?? 0,
    wholesaleThreshold: payload.wholesaleThreshold ?? 0,
    wholesalePrice: payload.wholesalePrice ?? null,
    createdAt: new Date(),
  };
  return firestore().collection('products').add(doc);
}

export async function updateProduct(id, payload) {
  const clean = {};
  if (payload.name !== undefined) clean.name = payload.name;
  if (payload.purchasePrice !== undefined) clean.purchasePrice = payload.purchasePrice;
  if (payload.salePrice !== undefined) clean.salePrice = payload.salePrice;
  if (payload.stock !== undefined) clean.stock = payload.stock;
  if (payload.wholesaleThreshold !== undefined) clean.wholesaleThreshold = payload.wholesaleThreshold;
  if (payload.wholesalePrice !== undefined) clean.wholesalePrice = payload.wholesalePrice;
  if (payload.updatedAt) clean.updatedAt = payload.updatedAt;
  return firestore().collection('products').doc(id).update(clean);
}

export async function deleteProduct(id) {
  return firestore().collection('products').doc(id).delete();
}
