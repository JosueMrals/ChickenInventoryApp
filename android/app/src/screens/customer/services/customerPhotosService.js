import storage from '@react-native-firebase/storage';
import ImageResizer from '@bam.tech/react-native-image-resizer';

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 70;

// Sube una foto de cliente a Storage (comprimida) y devuelve su metadato.
export const uploadCustomerPhoto = async (customerId, localUri) => {
  const resized = await ImageResizer.createResizedImage(
    localUri, MAX_DIMENSION, MAX_DIMENSION, 'JPEG', JPEG_QUALITY, 0,
  );

  const path = `customers/${customerId}/${Date.now()}.jpg`;
  const ref = storage().ref(path);
  // contentType explícito: la regla de Storage exige 'image/.*' y no hay que
  // depender de que el SDK lo infiera bien de un content:// uri de la galería.
  await ref.putFile(resized.uri, { contentType: 'image/jpeg' });
  const url = await ref.getDownloadURL();

  return { url, path, uploadedAt: new Date().toISOString() };
};

// Elimina el archivo de Storage asociado a una foto.
export const deleteCustomerPhoto = async (path) => {
  if (!path) return;
  await storage().ref(path).delete();
};
