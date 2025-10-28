// src/services/auth.js
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

/**
 * Escucha el estado de autenticación del usuario actual
 * y ejecuta un callback cuando cambia (login/logout).
 */
export const onAuthStateChanged = (callback) => {
  return auth().onAuthStateChanged(callback);
};

/**
 * Inicia sesión con email y password.
 * Solo permite acceso si el email está verificado.
 */
export const loginUser = async (email, password) => {
  try {
    const userCredential = await auth().signInWithEmailAndPassword(email, password);
    const user = userCredential.user;

    if (!user.emailVerified) {
      // No cerramos sesión, solo avisamos
      throw new Error('EMAIL_NOT_VERIFIED');
    }

    return user;
  } catch (error) {
    throw new Error(error.message);
  }
};

/**
 * Crea un nuevo usuario (solo admin debería hacerlo).
 * Envía un correo de verificación automáticamente.
 */
export const registerUser = async (email, password, role = 'user') => {
  const userCredential = await auth().createUserWithEmailAndPassword(email, password);
  const user = userCredential.user;

  // Envía correo de verificación
  await user.sendEmailVerification();

  // Guarda rol y datos en Firestore
  await firestore().collection('users').doc(user.uid).set({
    email: user.email,
    role,
    createdAt: new Date(),
    emailVerified: true,
  });

  return user;
};

/**
 * Cierra la sesión del usuario actual.
 */
export const logoutUser = async () => {
  await auth().signOut();
};

/**
 * Devuelve el rol (admin / user) de un usuario
 */
export const getUserRole = async (uid) => {
  if (!uid) return null;
  const doc = await firestore().collection('users').doc(uid).get();
  if (!doc.exists) return null;
  return doc.data().role;
};

/**
 * Reenvía el correo de verificación al usuario actual.
 */
export const resendVerificationEmail = async () => {
  const user = auth().currentUser;
  if (!user) {
    throw new Error('No hay un usuario autenticado.');
  }

  if (user.emailVerified) {
    throw new Error('El correo ya está verificado.');
  }

  await user.sendEmailVerification();
  return true;
};

/**
 * Actualiza el estado de verificación en Firestore si el email ya fue verificado.
 */
export const refreshEmailVerificationStatus = async () => {
  const user = auth().currentUser;
  if (!user) return;

  await user.reload(); // Recarga el estado actual del usuario
  if (user.emailVerified) {
    await firestore().collection('users').doc(user.uid).update({
      emailVerified: true,
    });
  }
};
