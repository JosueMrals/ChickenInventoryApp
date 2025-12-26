
import firestore, { serverTimestamp } from "@react-native-firebase/firestore";
import { getCurrentUserId } from "../../../utils/SessionManager"; // Asumiendo que SessionManager exporta esta función

const col = (name) => firestore().collection(name);

/**
 * Registra una actividad de producto en la colección 'product_movements'
 * 
 * @param {'create' | 'update' | 'delete'} type El tipo de movimiento.
 * @param {string} productId El ID del producto.
 * @param {object} details Detalles adicionales sobre el movimiento.
 */
export const logProductActivity = async (type, productId, details) => {
  try {
    const userId = await getCurrentUserId(); // Obtener el ID del usuario actual
    
    await col("product_movements").add({
      type,
      productId,
      userId,
      details, // e.g., { name: 'Pollo Entero', price: 10.50 } or { changes: 'price from 10 to 12' }
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error logging product activity:", error);
  }
};
