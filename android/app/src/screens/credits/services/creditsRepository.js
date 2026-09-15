import { firestore } from '../../../services/firebaseConfig';
import { getAggregateFromServer, count, sum } from '@react-native-firebase/firestore';
import { startOfDay, endOfDay } from 'date-fns';
import { captureError } from '../../../services/errorMonitoring';
import { normalizeCustomerName } from './creditsValidation';

/** Acota un query de créditos a un rango de fechas.
 *  Se normaliza a día completo: con la fecha tal cual, "hasta el 15" dejaba
 *  fuera todo lo creado ese mismo día después de las 00:00. */
const applyDateRange = (query, from, to) => {
  if (from) query = query.where('createdAt', '>=', startOfDay(from));
  if (to) query = query.where('createdAt', '<=', endOfDay(to));
  return query;
};

const mapCreditDoc = (doc) => {
  const raw = doc.data() || {};
  return {
    ...raw,
    customerName: normalizeCustomerName(raw.customerName || raw.clientName || '', 'Cliente'),
    id: doc.id, // Fuerza siempre el id real del documento
    preSaleId: raw.preSaleId || raw.presaleId || null,
  };
};

/** Obtener lista de créditos en tiempo real.
 *  `status` y el rango de fechas van al query en vez de filtrarse en JS, y
 *  `limit` acota la lista: `credits` solo crece y antes se transfería entera
 *  para mostrar una pantalla. Filtrar la fecha en cliente sobre esa página
 *  mentiría (mostraría "no hay créditos en marzo" cuando solo no entraron en
 *  los últimos 100). Índice existente: (status ASC, createdAt DESC).
 *  Los totales NO salen de aquí (serían parciales): ver getCreditTotals().
 *
 *  `createdBy`/`entregadorId` acotan la lista al dueño del crédito: sin esto
 *  cualquier vendedor o entregador veía la cartera completa. Son excluyentes
 *  entre sí (un solo rol scope a la vez); admin no manda ninguno de los dos. */
export const fetchCredits = (onUpdate, { status = null, limit = 100, from = null, to = null, createdBy = null, entregadorId = null } = {}, onError = null) => {
  let query = firestore().collection('credits');
  if (createdBy) query = query.where('createdBy', '==', createdBy);
  if (entregadorId) query = query.where('entregadorId', '==', entregadorId);
  if (status) query = query.where('status', '==', status);
  query = applyDateRange(query, from, to);

  return query
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .onSnapshot(
      snapshot => onUpdate((snapshot?.docs || []).map(mapCreditDoc)),
      // Sin este callback, un fallo del query (índice en construcción, permisos)
      // no llamaba a onUpdate NUNCA: la pantalla se quedaba en "Cargando créditos..."
      // para siempre, sin lista y sin mensaje. Ahora el error se propaga a la UI.
      error => {
        console.error('[creditsService] fetchCredits:', error);
        onError?.(error);
      },
    );
};

/** Totales de créditos, sumados EN EL SERVIDOR.
 *
 *  Antes se calculaban en JS sobre la colección completa ya descargada. Al acotar
 *  la lista eso daría totales silenciosamente incorrectos — y son montos de dinero.
 *  Un agregado no descarga los documentos: cuesta una fracción de lectura y el
 *  resultado es exacto sobre toda la colección, no sobre la página visible.
 *
 *  `createdBy`/`entregadorId`: mismos filtros que fetchCredits, para que el
 *  encabezado no muestre el total de toda la cartera sobre una lista ya
 *  acotada al vendedor o entregador. */
export const getCreditTotals = async ({ from = null, to = null, createdBy = null, entregadorId = null } = {}) => {
  let credits = firestore().collection('credits');
  if (createdBy) credits = credits.where('createdBy', '==', createdBy);
  if (entregadorId) credits = credits.where('entregadorId', '==', entregadorId);
  const scoped = (status) => applyDateRange(credits.where('status', '==', status), from, to);

  try {
    // El conteo viaja en el mismo agregado que la suma: los contadores de los
    // filtros no pueden salir de la lista descargada (viene ya filtrada por
    // estado, así que el estado inactivo siempre contaría 0).
    const [paidSnap, pendingSnap] = await Promise.all([
      getAggregateFromServer(scoped('paid'), { value: sum('total'), docs: count() }),
      getAggregateFromServer(scoped('pending'), { value: sum('pending'), docs: count() }),
    ]);

    return {
      paid: paidSnap.data().value || 0,
      pending: pendingSnap.data().value || 0,
      countPaid: paidSnap.data().docs || 0,
      countPending: pendingSnap.data().docs || 0,
    };
  } catch (error) {
    console.error('[creditsService] getCreditTotals:', error);
    // `null`, no 0: son montos de dinero. Un C$0.00 inventado hace creer que no
    // hay saldo pendiente; la UI muestra "—" cuando el dato no está disponible.
    return { paid: null, pending: null, countPaid: null, countPending: null, error };
  }
};

/** Deuda vigente de un cliente: suma EN EL SERVIDOR de lo pendiente en sus
 *  créditos sin saldar. Es la base del control de sobregiro acumulado: sin esto
 *  el límite se comparaba solo contra el total de la venta en curso.
 *
 *  Se calcula por agregado en vez de mantener un contador denormalizado en el
 *  cliente (`customer.currentCredit`): hay ~10 vías que escriben créditos y un
 *  contador con tantos escritores se desincroniza en silencio — y es dinero.
 *
 *  `excludeCreditId`: al EDITAR una preventa a crédito, su propio crédito ya
 *  está incluido en la suma; sin excluirlo se contaría dos veces y bloquearía
 *  cualquier edición.
 *
 *  Devuelve `null` —no 0— si el agregado falla (sin señal): 0 significaría
 *  "no debe nada" y autorizaría crédito a un cliente sobregirado. */
export const getCustomerOutstandingCredit = async (customerId, { excludeCreditId = null } = {}) => {
  if (!customerId) return 0;

  try {
    const snap = await getAggregateFromServer(
      firestore().collection('credits').where('customerId', '==', customerId).where('status', '==', 'pending'),
      { value: sum('pending') },
    );

    let outstanding = Number(snap.data().value) || 0;

    if (excludeCreditId) {
      const own = await firestore().collection('credits').doc(excludeCreditId).get();
      if (own.exists() && own.data()?.status === 'pending') {
        outstanding -= Number(own.data()?.pending) || 0;
      }
    }

    return Math.max(0, Number(outstanding.toFixed(2)));
  } catch (error) {
    captureError(error, { scope: 'creditsService.getCustomerOutstandingCredit', customerId });
    return null;
  }
};
