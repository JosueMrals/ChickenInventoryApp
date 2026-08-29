import storage from '@react-native-firebase/storage';
import ImageResizer from '@bam.tech/react-native-image-resizer';

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 75;

// Sube la foto de una factura de recepción a Storage (comprimida) y devuelve su
// metadato { url, path, uploadedAt }. Mismo patrón que customerPhotosService.
// Una factura suele llevar texto: se conserva algo más de resolución que en las
// fotos de cliente para que los números sean legibles.
export const uploadInvoicePhoto = async (localUri) => {
  const resized = await ImageResizer.createResizedImage(
    localUri, MAX_DIMENSION, MAX_DIMENSION, 'JPEG', JPEG_QUALITY, 0,
  );

  const path = `goodsReceipts/${Date.now()}.jpg`;
  const ref = storage().ref(path);
  // contentType explícito: la regla de Storage exige 'image/.*' y no hay que
  // depender de que el SDK lo infiera de un content:// uri.
  await ref.putFile(resized.uri, { contentType: 'image/jpeg' });
  const url = await ref.getDownloadURL();

  return { url, path, uploadedAt: new Date().toISOString() };
};

// Elimina de Storage la foto de una factura (limpieza si el usuario la reemplaza
// antes de guardar la recepción).
export const deleteInvoicePhoto = async (path) => {
  if (!path) return;
  try {
    await storage().ref(path).delete();
  } catch (e) {
    // No es crítico: si el borrado falla queda un huérfano, pero no debe romper
    // el flujo de recepción.
    console.warn('[invoicePhotos] no se pudo eliminar la foto:', e?.code || e?.message || e);
  }
};
