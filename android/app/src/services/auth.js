// src/services/auth.js
import { auth, firestore } from './firebaseConfig';

export const loginUser = async (email, password) => {
  try {
    const userCredential = await auth().signInWithEmailAndPassword(email, password);
    const user = userCredential.user;

    if (!user.emailVerified) {
      await auth().signOut();
      throw new Error('Correo no verificado. Por favor verifica tu cuenta antes de ingresar.');
    }

    return user;
  } catch (error) {
    console.log('🔥 Error en loginUser:', error);
    throw error;
  }
};

export const getUserRole = async (uid) => {
  try {
    const snap = await firestore().collection('users').doc(uid).get();

    if (!snap.exists) {
      console.log('⚠️ Usuario sin documento, asignando rol "user"');
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
