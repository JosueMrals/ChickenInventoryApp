// src/services/auth.js
import { auth, firestore } from './firebaseConfig';

// 🔹 Login con verificación
export const loginUser = async (email, password) => {
  try {
    const userCredential = await auth().signInWithEmailAndPassword(email, password);
    const user = userCredential.user;

    if (!user.emailVerified) {
      throw new Error('Correo no verificado. Verifica tu cuenta antes de ingresar.');
    }

    // Si está verificado, actualizar Firestore
    await updateVerificationStatus(user.uid);

    return user;
  } catch (error) {
    console.log('🔥 Error en loginUser:', error);
    throw error;
  }
};

// 🔹 Obtener rol del usuario desde Firestore
export const getUserRole = async (uid) => {
  try {
    const snap = await firestore().collection('users').doc(uid).get();

    if (!snap.exists) {
      console.log('⚠️ Usuario sin documento, asignando rol por defecto.');
      return 'user';
    }

    const data = snap.data();
    console.log('✅ Rol obtenido desde Firestore:', data.role);
    return data.role || 'user';
  } catch (error) {
    console.log('🔥 Error obteniendo rol:', error);
    return 'user';
  }
};

// 🔹 Actualizar estado de verificación en Firestore
export const updateVerificationStatus = async (uid) => {
  try {
    const userRef = firestore().collection('users').doc(uid);
    const docSnap = await userRef.get();

    if (docSnap.exists) {
      const userData = docSnap.data();

      if (!userData.verified) {
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
