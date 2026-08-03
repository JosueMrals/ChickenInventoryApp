// src/services/auth.js
import { auth, firestore, functions } from './firebaseConfig';

// 🔹 Resuelve el identificador de login: si ya es un correo, lo usa tal cual
// (comportamiento actual); si es un nombre de usuario, lo resuelve al correo
// real vía Cloud Function (Firestore no es legible antes de autenticar).
export const resolveLoginEmail = async (identifier) => {
  const trimmed = (identifier || '').trim();
  const emailRegex = /^\S+@\S+\.\S+$/;
  if (emailRegex.test(trimmed)) {
    return trimmed;
  }

  const resolveFn = functions().httpsCallable('resolveLoginEmail');
  const result = await resolveFn({ data: { identifier: trimmed } });
  return result.data.email;
};

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

// 🔹 Perfil del usuario desde Firestore (Robustecido)
// El doc de `users` es la fuente de verdad del nombre: el displayName de Auth
// solo está seteado en algunas cuentas, por eso no se usa para mostrar nombres.
export const getUserProfile = async (uid, email = null) => {
  try {
    // 1. Intento principal: Buscar por ID del documento
    const docSnap = await firestore().collection('users').doc(uid).get();
    if (docSnap.exists()) {
      return { uid, ...docSnap.data() };
    }

    // 2. Intento secundario: Si falló por UID y tenemos email, buscar por email
    if (email) {
      console.log('⚠️ No se encontró perfil por UID, buscando por email');
      const querySnap = await firestore().collection('users').where('email', '==', email).limit(1).get();
      if (!querySnap.empty) {
        const userDoc = querySnap.docs[0];
        return { uid: userDoc.id, ...userDoc.data() };
      }
    }

    console.log('⚠️ No se encontró documento de usuario.');
    return null;
  } catch (error) {
    console.log('🔥 Error obteniendo perfil:', error);
    return null;
  }
};

// 🔹 Nombre completo para mostrar. Sin nombre en Firestore, cae al inicio del correo.
export const getDisplayName = (profile, email = null) => {
  const fullName = [profile?.nombre, profile?.apellido]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(' ');
  if (fullName) return fullName;
  return email ? String(email).split('@')[0] : '';
};

// 🔹 Obtener rol del usuario
// Para el usuario autenticado el rol sale del custom claim del token (sin lectura
// a Firestore). Para cualquier otro uid, o si el claim aún no está puesto, se cae
// al perfil como antes. Ver syncUserRoleClaim / syncAllRoleClaims en functions/.
export const getUserRole = async (uid, email = null) => {
  const currentUser = auth().currentUser;
  if (currentUser && currentUser.uid === uid) {
    const { claims } = await currentUser.getIdTokenResult();
    if (claims.role) return claims.role;
  }

  const profile = await getUserProfile(uid, email);
  return profile?.role || 'user';
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

    if (docSnap.exists()) {
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
