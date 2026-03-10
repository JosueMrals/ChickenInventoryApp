import { db } from '../firebase';
import { serverTimestamp } from '@react-native-firebase/firestore';

const OPERATIONS_COLLECTION = 'product_operations';

function normalizeCategory(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

/**
 * Crea un registro en la colección product_operations.
 * @param {Object} operationData
 * @param {string} operationData.productId - El ID del producto.
 * @param {string} operationData.productName - El nombre del producto.
 * @param {'create' | 'update' | 'delete' | 'stock_change'} operationData.operationType - El tipo de operación.
 * @param {string} operationData.userEmail - El email del usuario que realiza la acción.
 * @param {string} [operationData.category] - Categoria del producto.
 * @param {Object} [operationData.details] - Detalles adicionales sobre la operación (ej. campos cambiados para 'update').
 */
export const createProductOperation = async (operationData) => {
  try {
    const { productId, productName, operationType, userEmail, category, details = {} } = operationData;

    if (!productId || !productName || !operationType || !userEmail) {
      throw new Error('Faltan campos obligatorios para el registro de operación del producto.');
    }

    const normalizedCategory = normalizeCategory(category) || normalizeCategory(details?.category);

    await db.collection(OPERATIONS_COLLECTION).add({
      productId,
      productName,
      operationType,
      email: userEmail,
      category: normalizedCategory,
      details,
      timestamp: serverTimestamp(),
    });

  } catch (error) {
    console.error('Error al registrar la operación del producto:', error);
    // Dependiendo de las necesidades de la app, podrías querer relanzar el error
    // o manejarlo silenciosamente. Por ahora, solo lo registramos.
  }
};
