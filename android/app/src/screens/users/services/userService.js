import { firestore, auth, functions } from '../../../services/firebaseConfig';

// Escuchar cambios en la colección de usuarios en tiempo real
export const onUsersSnapshot = (callback) => {
  return firestore().collection('users')
    .onSnapshot(
      (snapshot) => {
        const usersList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        callback(usersList);
      },
      (error) => {
        console.error("Error fetching users:", error);
        // Opcional: callback([]) o manejar el error en la UI
      }
    );
};

// Agregar un nuevo usuario mediante Cloud Function (para no cerrar la sesión del admin)
export const addUser = async (userData) => {
  try {
    const createUserFn = functions().httpsCallable('createUser');
    const result = await createUserFn({ data: userData });
    return result.data.message || 'Usuario creado exitosamente.';
  } catch (error) {
    console.error("Error calling createUser function:", error);
    // Lanzar el error para que el hook lo maneje y muestre la alerta
    throw error;
  }
};

// Eliminar usuario mediante Cloud Function
export const deleteUser = async (uid) => {
  try {
    const deleteUserFn = functions().httpsCallable('deleteUser');
    await deleteUserFn({ data: { uid } });
    return true;
  } catch (error) {
    console.error("Error calling deleteUser function:", error);
    throw new Error(error.message || "No se pudo eliminar el usuario.");
  }
};

// Actualizar un usuario en Firestore y opcionalmente su contraseña
export const updateUser = async (uid, dataToUpdate) => {
  const currentUser = auth().currentUser;

  if (!currentUser) {
    throw new Error("Tu sesión ha expirado. Por favor, reinicia la sesión.");
  }

  const { nombre, apellido, user, role, password } = dataToUpdate;

  if (!nombre || !apellido || !user || !role) {
    throw new Error('Nombre, apellido, usuario y rol son obligatorios.');
  }

  // Actualizar datos básicos en Firestore directamente
  await firestore().collection('users').doc(uid).update({
    nombre: nombre.trim(),
    apellido: apellido.trim(),
    user: user.trim(),
    role: role.trim().toLowerCase(),
  });

  // Si hay contraseña, actualizarla mediante Cloud Function
  if (password && password.trim().length > 0) {
    try {
      // Refrescar token para asegurar permisos
      await currentUser.getIdToken(true);

      const updateUserPassword = functions().httpsCallable('updateUserPassword');
      const result = await updateUserPassword({ data: { uid, password } });
      
      console.log('✅ Resultado cambio pass:', result.data.message);
    } catch (error) {
      console.error("🔥 Error cambio pass:", error);
      throw new Error(error.message || 'Datos actualizados, pero falló el cambio de contraseña.');
    }
  }
};
