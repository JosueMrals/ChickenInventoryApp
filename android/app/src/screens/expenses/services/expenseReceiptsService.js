import storage from '@react-native-firebase/storage';
import ImageResizer from '@bam.tech/react-native-image-resizer';

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 75;

// Sube la foto del comprobante de un gasto a Storage (comprimida) y devuelve
// su metadato { url, path, uploadedAt }. Mismo patrón que invoicePhotosService/
// customerPhotosService — no reinventar el flujo de fotos.
export const uploadExpenseReceipt = async (localUri, uid) => {
  const resized = await ImageResizer.createResizedImage(
    localUri, MAX_DIMENSION, MAX_DIMENSION, 'JPEG', JPEG_QUALITY, 0,
  );

  const path = `expenseReceipts/${uid}_${Date.now()}.jpg`;
  const ref = storage().ref(path);
  // contentType explícito: la regla de Storage exige 'image/.*'.
  await ref.putFile(resized.uri, { contentType: 'image/jpeg' });
  const url = await ref.getDownloadURL();

  return { url, path, uploadedAt: new Date().toISOString() };
};

// Elimina la foto de Storage (limpieza si se cancela el gasto antes de que
// nadie la haya revisado).
export const deleteExpenseReceipt = async (path) => {
  if (!path) return;
  try {
    await storage().ref(path).delete();
  } catch (e) {
    // No es crítico: si el borrado falla queda un huérfano, no debe romper el flujo.
    console.warn('[expenseReceipts] no se pudo eliminar la foto:', e?.code || e?.message || e);
  }
};
