import firestore from '@react-native-firebase/firestore';

/**
 * Historial de entregas bodega → entregador.
 *
 * No hay colección aparte: el registro ya vive en la propia pre-venta
 * (`dispatchedAt`, `dispatchedBy`, `entregadorId`), que se conserva aunque la
 * orden se cobre o se devuelva después. Consultar `presales` por rango de fecha
 * evita duplicar el dato y hace que el historial cubra también lo ya cobrado.
 */

const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// Momento de la entrega al repartidor. `dispatchedAt` es el canónico;
// `fechaEntregaRepartidor` cubre las órdenes despachadas por la vía individual
// antes de que ambas rutas escribieran los mismos campos.
export const getHandoverDate = (presale) =>
  toDate(presale?.dispatchedAt) || toDate(presale?.fechaEntregaRepartidor);

/**
 * Entregas dentro de un rango. El rango va al query (no se filtra en JS) para no
 * descargar meses de preventas y quedarse con un día.
 *
 * @param {Date} from  inicio del rango (inclusive)
 * @param {Date} to    fin del rango (inclusive)
 * @param {Function} onUpdate  recibe el arreglo de preventas entregadas
 * @param {Function} onError   recibe el error si el query falla
 * @param {string|null} routeId  acota a una ruta (vista del bodeguero); null = todas (admin)
 */
export const subscribeHandovers = (from, to, onUpdate, onError = null, routeId = null) => {
  let query = firestore().collection('presales');
  if (routeId) {
    query = query.where('routeId', '==', routeId);
  }
  query = query
    .where('dispatchedAt', '>=', from)
    .where('dispatchedAt', '<=', to)
    .orderBy('dispatchedAt', 'desc');

  return query.onSnapshot(
    (snapshot) => {
      onUpdate((snapshot?.docs || []).map((doc) => ({ id: doc.id, ...doc.data() })));
    },
    // Sin este callback un query fallido deja la pantalla cargando para siempre.
    (error) => {
      console.error('[handoverHistory] subscribeHandovers:', error);
      onError?.(error);
    },
  );
};

/** Mapa uid → nombre para resolver entregador y bodeguero de cada entrega. */
export const subscribeUserNames = (onUpdate) =>
  firestore()
    .collection('users')
    .onSnapshot(
      (snapshot) => {
        const map = {};
        (snapshot?.docs || []).forEach((doc) => {
          const u = doc.data() || {};
          const full = [u.nombre, u.apellido].map((p) => (p || '').trim()).filter(Boolean).join(' ');
          map[doc.id] = full || u.email || doc.id;
        });
        onUpdate(map);
      },
      (error) => {
        console.error('[handoverHistory] subscribeUserNames:', error);
        onUpdate({});
      },
    );
