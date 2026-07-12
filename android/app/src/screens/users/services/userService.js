import { firestore, auth, functions } from '../../../services/firebaseConfig';

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};

// Escuchar cambios en la colección de usuarios en tiempo real.
// Ordena en el cliente (no con .orderBy('createdAt')): Firestore excluye
// silenciosamente cualquier doc sin ese campo, y no todos los usuarios lo tienen
// (p. ej. creados directo en la consola de Firebase, antes de que existiera el campo).
export const onUsersSnapshot = (callback) => {
  return firestore().collection('users')
    .onSnapshot(
      (snapshot) => {
        const usersList = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        callback(usersList);
      },
      (error) => {
        console.error("Error fetching users:", error);
        callback([]);
      }
    );
};

/**
 * Crear usuario via Cloud Function.
 * La función crea Auth + Firestore atómicamente (con rollback en caso de fallo).
 */
export const addUser = async (userData) => {
  try {
    const createUserFn = functions().httpsCallable('createUser');
    const result = await createUserFn({ data: userData });
    return result.data.message || 'Usuario creado exitosamente.';
  } catch (error) {
    console.error("Error calling createUser function:", error);
    // Firebase Functions wraps el mensaje en error.message
    const msg = error?.message || 'No se pudo crear el usuario.';
    throw new Error(msg);
  }
};

/**
 * Eliminar usuario via Cloud Function (elimina Auth + Firestore).
 */
export const deleteUser = async (uid) => {
  try {
    const deleteUserFn = functions().httpsCallable('deleteUser');
    await deleteUserFn({ data: { uid } });
    return true;
  } catch (error) {
    console.error("Error calling deleteUser function:", error);
    throw new Error(error?.message || "No se pudo eliminar el usuario.");
  }
};

/**
 * Actualizar perfil del usuario en Firestore.
 * Si se provee password, también actualiza Firebase Authentication via Cloud Function.
 *
 * Campos opcionales (cedula, telefono): si llegan vacíos se eliminan de Firestore.
 */
export const updateUser = async (uid, dataToUpdate) => {
  const currentUser = auth().currentUser;

  if (!currentUser) {
    throw new Error("Tu sesión ha expirado. Por favor, inicia sesión nuevamente.");
  }

  const { nombre, apellido, user, role, password, cedula, telefono } = dataToUpdate;

  // Validación de campos obligatorios
  if (!nombre?.trim()) throw new Error('El nombre es obligatorio.');
  if (!apellido?.trim()) throw new Error('El apellido es obligatorio.');
  if (!user?.trim()) throw new Error('El nombre de usuario es obligatorio.');
  if (!role?.trim()) throw new Error('El rol es obligatorio.');

  // Construir payload para Firestore
  const updateData = {
    nombre:    nombre.trim(),
    apellido:  apellido.trim(),
    user:      user.trim(),
    role:      role.trim().toLowerCase(),
    updatedAt: firestore.FieldValue.serverTimestamp(),
  };

  // Campos opcionales: guardar valor o eliminar el campo si está vacío
  updateData.cedula   = cedula?.trim()   || firestore.FieldValue.delete();
  updateData.telefono = telefono?.trim() || firestore.FieldValue.delete();

  // 1. Actualizar Firestore
  await firestore().collection('users').doc(uid).update(updateData);

  // 2. Actualizar displayName en Auth (refleja nombre completo)
  try {
    // Solo actualizamos si el usuario editado es el mismo admin o usamos Admin SDK via CF
    // Por ahora sincronizamos al menos el displayName si es el mismo usuario logueado
    if (currentUser.uid === uid) {
      await currentUser.updateProfile({ displayName: `${nombre.trim()} ${apellido.trim()}` });
    }
  } catch (profileErr) {
    // No bloqueante: el perfil de Auth es secundario
    console.warn('No se pudo actualizar displayName en Auth:', profileErr);
  }

  // 3. Si hay nueva contraseña, actualizarla en Authentication via Cloud Function
  if (password && password.trim().length > 0) {
    // Refrescar token para garantizar permisos de admin
    await currentUser.getIdToken(true);

    const updateUserPassword = functions().httpsCallable('updateUserPassword');
    const result = await updateUserPassword({ data: { uid, password: password.trim() } });
    console.log('✅ Contraseña actualizada en Auth:', result.data.message);
  }
};
