import '@react-native-firebase/app';
import firestore from '@react-native-firebase/firestore';

// Caché offline: permite que cada pantalla pinte desde disco antes de que llegue
// la respuesta de red. `settings()` solo puede llamarse UNA vez y antes de la
// primera operación de Firestore, por eso vive aquí y este módulo se importa de
// primero en index.js — antes que App y que todo el árbol de pantallas.
firestore().settings({
  persistence: true,
  cacheSizeBytes: firestore.CACHE_SIZE_UNLIMITED,
});

export const db = firestore();
