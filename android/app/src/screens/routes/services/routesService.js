import firestore from '@react-native-firebase/firestore';

const COLLECTION_NAME = 'routes';

const routesService = {
  /**
   * Obtiene todas las rutas ordenadas por nombre.
   */
  getRoutes: async () => {
    try {
      const snapshot = await firestore()
        .collection(COLLECTION_NAME)
        .orderBy('name', 'asc')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting routes:', error);
      throw error;
    }
  },

  /**
   * Crea una nueva ruta.
   * @param {Object} routeData - Datos de la ruta (name, start, end).
   */
  createRoute: async (routeData) => {
    try {
      await firestore().collection(COLLECTION_NAME).add({
        ...routeData,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('Error creating route:', error);
      throw error;
    }
  },

  /**
   * Actualiza una ruta existente.
   * @param {string} id - ID del documento.
   * @param {Object} updates - Datos a actualizar.
   */
  updateRoute: async (id, updates) => {
    try {
      await firestore().collection(COLLECTION_NAME).doc(id).update({
        ...updates,
        updatedAt: firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating route:', error);
      throw error;
    }
  },

  /**
   * Elimina una ruta.
   * @param {string} id - ID del documento.
   */
  deleteRoute: async (id) => {
    try {
      await firestore().collection(COLLECTION_NAME).doc(id).delete();
    } catch (error) {
      console.error('Error deleting route:', error);
      throw error;
    }
  }
};

export default routesService;
