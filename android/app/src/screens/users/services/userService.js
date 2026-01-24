import { firestore, auth, functions } from '../../../services/firebaseConfig';
import { Alert } from 'react-native';

// ... onUsersSnapshot, addUser, deleteUser (sin cambios) ...
export const onUsersSnapshot = (callback) => { /* ... código existente ... */ };
export const addUser = async (userData) => { /* ... código existente ... */ };
export const deleteUser = async (uid) => { /* ... código existente ... */ };

// Actualizar un usuario en Firestore y opcionalmente su contraseña
export const updateUser = async (uid, dataToUpdate) => {
  const currentUser = auth().currentUser;

  if (!currentUser) {
    console.error("Error de autenticación del cliente: No se encontró un usuario logueado.");
    throw new Error("Tu sesión ha expirado. Por favor, reinicia la sesión.");
  }

  const { nombre, apellido, user, role, password } = dataToUpdate;

  if (!nombre || !apellido || !user || !role) {
    throw new Error('Nombre, apellido, usuario y rol son obligatorios.');
  }

  await firestore().collection('users').doc(uid).update({
    nombre: nombre.trim(),
    apellido: apellido.trim(),
    user: user.trim(),
    role: role.trim().toLowerCase(),
  });

  if (password) {
    try {
      // Forzar la actualización del token sigue siendo una buena práctica.
      await currentUser.getIdToken(true);

      // CORRECCIÓN: Llamar a la función sin el parámetro de región incorrecto.
      const updateUserPassword = functions().httpsCallable('updateUserPassword');
      
      const result = await updateUserPassword({ data: { uid, password } });
      
      console.log('✅ Resultado de la Función Cloud:', result.data.message);
    } catch (error) {
      console.error("🔥 Error al llamar a la Función Cloud 'updateUserPassword':", JSON.stringify(error, null, 2));
      throw new Error(error.message || 'Los datos se actualizaron, pero falló el cambio de contraseña.');
    }
  }
};
