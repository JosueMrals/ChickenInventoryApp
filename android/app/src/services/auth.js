// src/services/auth.js
import { auth, firestore } from './firebaseConfig';

// 🔹 Login con verificación
export const loginUser = async (email, password) => {
  try {
    const userCredential = await auth().signInWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // 🔹 CAMBIO: Ya no lanzamos error aquí. Devolvemos el usuario para que la UI decida qué hacer.
    if (user.emailVerified) {
      // Si está verificado, actualizar Firestore
      await updateVerificationStatus(user.uid);
    } else {
      console.log('⚠️ Usuario logueado pero correo NO verificado.');
    }

    return user;
  } catch (error) {
    console.log('🔥 Error en loginUser:', error);
    throw error;
  }
};

// 🔹 Obtener rol del usuario desde Firestore (Robustecido)
export const getUserRole = async (uid, email = null) => {
  try {
    console.log(`🔍 Intentando obtener rol para UID: ${uid}`);

    // 1. Intento principal: Buscar por ID del documento
    const docSnap = await firestore().collection('users').doc(uid).get();

    if (docSnap.exists) {
      const data = docSnap.data();
      if (data && data.role) {
        console.log('✅ Rol encontrado por UID:', data.role);
        return data.role;
      }
    }

    // 2. Intento secundario: Si falló por UID y tenemos email, buscar por email
    if (email) {
        console.log(`⚠️ No se encontró por UID, buscando por email: ${email}`);
        const querySnap = await firestore().collection('users').where('email', '==', email).limit(1).get();

        if (!querySnap.empty) {
            const userDoc = querySnap.docs[0];
            const data = userDoc.data();
            if (data && data.role) {
                console.log('✅ Rol encontrado por Email:', data.role);
                return data.role;
            }
        }
    }

    console.log('⚠️ No se encontró documento de usuario o campo rol. Asignando "user".');
    return 'user';
  } catch (error) {
    console.log('🔥 Error obteniendo rol:', error);
    return 'user';
  }
};

// 🔹 Obtener lista de usuarios por rol
export const getUsersByRole = async (role) => {
  try {
    const snap = await firestore().collection('users').where('role', '==', role).get();

    if (snap.empty) {
      console.log(`⚠️ No se encontraron usuarios con rol: ${role}`);
      return [];
    }

    const users = snap.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    }));

    console.log(`✅ ${users.length} usuarios encontrados con rol: ${role}`);
    return users;
  } catch (error) {
    console.log(`🔥 Error obteniendo usuarios con rol ${role}:`, error);
    return [];
  }
};

// 🔹 Actualizar estado de verificación en Firestore
export const updateVerificationStatus = async (uid) => {
  try {
    const userRef = firestore().collection('users').doc(uid);
    const docSnap = await userRef.get();

    if (docSnap.exists) {
      const userData = docSnap.data();

      if (userData && !userData.verified) {
        await userRef.update({
          verified: true,
          verifiedAt: new Date(),
        });
        console.log(`✅ Usuario ${uid} marcado como verificado.`);
      }
    }
  } catch (e) {
    console.log('⚠️ Error al actualizar verificación:', e);
  }
};

// 🔹 Reenviar correo de verificación
export const resendVerificationEmail = async () => {
  const user = auth().currentUser;
  if (!user) throw new Error('No hay usuario autenticado.');

  await user.sendEmailVerification();
  console.log(`📨 Correo de verificación reenviado a ${user.email}`);
};

// 🔹 Cerrar sesión
export const logoutUser = async () => {
  try {
    await auth().signOut();
  } catch (e) {
    console.log('Error al cerrar sesión:', e);
  }
};

// 🔹 DEBUG: Mostrar datos del usuario específico por EMAIL
export const logUserData = async (email) => {
  try {
    console.log(`⏳ Buscando datos en Firestore para: ${email}`);

    // Buscamos en la colección 'users' donde el campo 'email' coincida
    const snapshot = await firestore().collection('users').where('email', '==', email).get();

    if (snapshot.empty) {
      console.log(`⚠️ No se encontró ningún documento para el email: ${email}`);
      return;
    }

    // Iteramos (aunque debería ser único) para mostrar los datos
    snapshot.forEach(doc => {
      const userData = {
        uid: doc.id, // Incluimos el UID del documento
        ...doc.data()
      };

      console.log('🔍 --- DATOS COMPLETOS DEL USUARIO (Firestore) ---');
      console.log(JSON.stringify(userData, null, 2));
      console.log('--------------------------------------------------');
    });

  } catch (error) {
    console.error('🔥 Error al imprimir datos del usuario:', error);
  }
};
