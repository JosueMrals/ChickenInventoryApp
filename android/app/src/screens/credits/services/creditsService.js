import { firestore, auth } from '../../../services/firebaseConfig';
import { getAggregateFromServer, count, sum } from '@react-native-firebase/firestore';
import { startOfDay, endOfDay } from 'date-fns';
import { computeAbono } from '../../../utils/creditUtils';
import { captureError } from '../../../services/errorMonitoring';
import { NON_PAYABLE_PRESALE_STATUSES, CREDIT_TO_CASH_STATUS } from '../../../services/preSaleService';
import { formatCurrency } from '../../../utils/formatMoney';

function sanitizeDocId(rawId) {
  if (typeof rawId !== 'string') return null;
  const trimmed = rawId.trim();
  if (!trimmed) return null;
  if (!trimmed.includes('/')) return trimmed;

  // Compatibilidad: algunos registros legacy guardan path completo "presales/{id}".
  const parts = trimmed.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  return parts[parts.length - 1] || null;
}

const normalizeCustomerName = (raw, fallback = 'Cliente') => {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return value || fallback;
};

const buildCustomerNameFromPreSale = (preSale) => {
  const direct = normalizeCustomerName(preSale?.customerName, '');
  if (direct) return direct;

  const firstName = typeof preSale?.customer?.firstName === 'string' ? preSale.customer.firstName.trim() : '';
  const lastName = typeof preSale?.customer?.lastName === 'string' ? preSale.customer.lastName.trim() : '';
  const joined = [firstName, lastName].filter(Boolean).join(' ').trim();
  return joined || 'Cliente';
};

function toFirestoreTimestamp(value) {
  if (value && typeof value.toDate === 'function') {
    return value;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return firestore.Timestamp.fromDate(value);
  }

  if (typeof value?.seconds === 'number') {
    return firestore.Timestamp.fromDate(new Date(value.seconds * 1000));
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return firestore.Timestamp.fromDate(parsed);
    }
  }

  return firestore.Timestamp.fromDate(new Date());
}

/** 📅 Acota un query de créditos a un rango de fechas.
 *  Se normaliza a día completo: con la fecha tal cual, "hasta el 15" dejaba
 *  fuera todo lo creado ese mismo día después de las 00:00. */
const applyDateRange = (query, from, to) => {
  if (from) query = query.where('createdAt', '>=', startOfDay(from));
  if (to) query = query.where('createdAt', '<=', endOfDay(to));
  return query;
};

/** 🧾 Obtener lista de créditos en tiempo real.
 *  `status` y el rango de fechas van al query en vez de filtrarse en JS, y
 *  `limit` acota la lista: `credits` solo crece y antes se transfería entera
 *  para mostrar una pantalla. Filtrar la fecha en cliente sobre esa página
 *  mentiría (mostraría "no hay créditos en marzo" cuando solo no entraron en
 *  los últimos 100). Índice existente: (status ASC, createdAt DESC).
 *  Los totales NO salen de aquí (serían parciales): ver getCreditTotals(). */
export const fetchCredits = (onUpdate, { status = null, limit = 100, from = null, to = null } = {}, onError = null) => {
  let query = firestore().collection('credits');
  if (status) query = query.where('status', '==', status);
  query = applyDateRange(query, from, to);

  return query
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .onSnapshot(
      snapshot => {
        const data = (snapshot?.docs || []).map(doc => {
          const raw = doc.data() || {};
          const customerName = normalizeCustomerName(raw.customerName || raw.clientName || '', 'Cliente');
          return {
            ...raw,
            customerName,
            id: doc.id, // Fuerza siempre el id real del documento
            preSaleId: raw.preSaleId || raw.presaleId || null,
          };
        });
        onUpdate(data);
      },
      // Sin este callback, un fallo del query (índice en construcción, permisos)
      // no llamaba a onUpdate NUNCA: la pantalla se quedaba en "Cargando créditos..."
      // para siempre, sin lista y sin mensaje. Ahora el error se propaga a la UI.
      error => {
        console.error('[creditsService] fetchCredits:', error);
        onError?.(error);
      },
    );
};

/** 💰 Totales de créditos, sumados EN EL SERVIDOR.
 *
 *  Antes se calculaban en JS sobre la colección completa ya descargada. Al acotar
 *  la lista eso daría totales silenciosamente incorrectos — y son montos de dinero.
 *  Un agregado no descarga los documentos: cuesta una fracción de lectura y el
 *  resultado es exacto sobre toda la colección, no sobre la página visible.
 */
export const getCreditTotals = async ({ from = null, to = null } = {}) => {
  const credits = firestore().collection('credits');
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

/** 🧮 Deuda vigente de un cliente: suma EN EL SERVIDOR de lo pendiente en sus
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
      firestore()
        .collection('credits')
        .where('customerId', '==', customerId)
        .where('status', '==', 'pending'),
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

/** 💵 Registrar abono y guardar historial.
 *  Acepta pagos mayores al saldo: aplica solo el pendiente y devuelve el cambio. */
export const abonarCredito = async (creditId, amount, userEmail) => {
  const safeCreditId = sanitizeDocId(creditId);
  if (!safeCreditId) {
    throw new Error('Crédito inválido: id no válido.');
  }

  const now = new Date();
  const nowTs = firestore.Timestamp.fromDate(now);
  const fallbackUser = auth()?.currentUser?.email || auth()?.currentUser?.displayName || null;
  const paymentActor = (typeof userEmail === 'string' && userEmail.trim()) ? userEmail.trim() : (fallbackUser || 'N/A');
  const creditRef = firestore().collection('credits').doc(safeCreditId);
  let result = null;

  await firestore().runTransaction(async (tx) => {
    const creditSnap = await tx.get(creditRef);
    if (!creditSnap.exists()) {
      throw new Error('El crédito no existe o fue eliminado.');
    }

    const creditData = creditSnap.data() || {};
    const abonoCalc = computeAbono(creditData, amount);

    const abono = {
      amount: abonoCalc.applied,
      date: nowTs,
      by: paymentActor,
      previousPending: abonoCalc.previousPending,
      newPending: abonoCalc.newPending,
    };
    if (abonoCalc.change > 0) {
      abono.received = abonoCalc.received;
      abono.change = abonoCalc.change;
    }

    const preSaleRawId = creditData?.preSaleId || creditData?.presaleId || null;
    const preSaleId = sanitizeDocId(preSaleRawId);

    tx.update(creditRef, {
      paid: abonoCalc.newPaid,
      pending: abonoCalc.newPending,
      status: abonoCalc.status,
      updatedAt: nowTs,
      payments: firestore.FieldValue.arrayUnion(abono),
    });

    // Nota: la actualización de preventa se realiza fuera de la transacción para
    // no bloquear el abono por datos legacy inconsistentes en preSaleId.

    result = {
      nuevoPagado: abonoCalc.newPaid,
      nuevoPendiente: abonoCalc.newPending,
      estado: abonoCalc.status,
      appliedAmount: abonoCalc.applied,
      change: abonoCalc.change,
      linkedPreSaleId: preSaleId || null,
    };
  });

  if (result?.estado === 'paid' && result?.linkedPreSaleId) {
    try {
      // Transacción propia (fuera del abono, que no debe bloquearse por datos
      // legacy de preSaleId): relee el estado real antes de marcar 'paid'. Sin
      // esto, un abono reproducido desde la cola offline podía reescribir una
      // preventa que mientras tanto fue cancelada o devuelta — el mismo patrón
      // que regresaba facturas cobradas a "pendiente".
      const preSaleRef = firestore().collection('presales').doc(result.linkedPreSaleId);
      await firestore().runTransaction(async (tx) => {
        const snap = await tx.get(preSaleRef);
        if (!snap.exists()) return;
        const currentStatus = snap.data()?.status;
        if (currentStatus === 'paid') return; // ya reflejaba el saldo: reintento idempotente
        // El crédito por cobrar vive en 'dispatched'/'credit_dispatched': esos SÍ
        // deben poder pasar a 'paid'. Solo se bloquean los estados donde ya no hay
        // deuda que saldar o donde el estado codifica una devolución.
        if (NON_PAYABLE_PRESALE_STATUSES.has(currentStatus)) {
          throw new Error(`La pre-venta está en un estado que no admite cobro: ${currentStatus}`);
        }
        tx.update(preSaleRef, { status: 'paid', fechaPago: nowTs, updatedAt: nowTs });
      });
      result.linkedPreSaleUpdated = true;
    } catch (linkError) {
      console.warn('No se pudo actualizar la preventa enlazada al saldar crédito:', {
        creditId: safeCreditId,
        preSaleId: result.linkedPreSaleId,
        message: linkError?.message,
        code: linkError?.code,
      });
      result.linkedPreSaleUpdated = false;
    }
  }

  return result;
};

/** 🧾 Crear crédito desde una pre-venta.
 *  options.dueDate: fecha de pago acordada con el cliente (Date|Timestamp). */
export const createCreditFromPreSale = async (preSale, createdBy, options = {}) => {
  if (!preSale?.id) throw new Error('Pre-venta inválida');

  const creditRef = firestore().collection('credits').doc();
  const preSaleRef = firestore().collection('presales').doc(preSale.id);
  const total = Number(preSale.total) || 0;
  const customerName = buildCustomerNameFromPreSale(preSale);
  const customerId = preSale.customerId || preSale.customer?.id || null;
  const rawDueDate = options.dueDate || preSale.creditDueDate || null;
  const dueDate = rawDueDate ? toFirestoreTimestamp(rawDueDate) : null;

  const actor = (typeof createdBy === 'string' && createdBy.trim())
    ? createdBy.trim()
    : (auth()?.currentUser?.email || auth()?.currentUser?.displayName || 'N/A');

  // Usar transacción para validar el estado actual antes de sobreescribir
  await firestore().runTransaction(async (tx) => {
    const preSaleSnap = await tx.get(preSaleRef);

    if (!preSaleSnap.exists()) {
      throw new Error('La pre-venta no existe o ya fue eliminada.');
    }

    const currentStatus = preSaleSnap.data()?.status;

    if (currentStatus === 'paid') {
      throw new Error('Esta pre-venta ya fue pagada. No se puede crear un crédito.');
    }
    if (currentStatus === 'cancelled') {
      throw new Error('No se puede crear un crédito para una pre-venta cancelada.');
    }
    if (currentStatus === 'credit_pending' || currentStatus?.startsWith('credit_')) {
      throw new Error('Esta pre-venta ya tiene un crédito asignado.');
    }
    if (!['pending', 'dispatched'].includes(currentStatus)) {
      throw new Error(`Estado inválido para crear crédito: ${currentStatus}.`);
    }

    tx.set(creditRef, {
      preSaleId: preSale.id,
      customerId,
      customerName,
      clientName: customerName,
      dueDate,
      total,
      paid: 0,
      pending: total,
      status: 'pending',
      createdAt: new Date(),
      createdBy: actor,
    });

    tx.update(preSaleRef, {
      status: 'credit_pending',
      creditId: creditRef.id,
      creditDueDate: dueDate,
      updatedAt: new Date(),
    });
  });

  return creditRef.id;
};

/** ❌ Eliminar crédito */
/** ❌ Eliminar crédito y devolver su pre-venta a contado.
 *
 *  Antes era un `.delete()` suelto: el crédito desaparecía y la pre-venta se
 *  quedaba en 'credit_pending' apuntando a un `creditId` que ya no existía.
 *  Peor: en ese estado createCreditFromPreSale la rechaza ("ya tiene un crédito
 *  asignado"), así que la orden quedaba trabada para siempre, sin cuenta por
 *  cobrar y sin posibilidad de volver a generarla. */
export const eliminarCredito = async (creditId) => {
  const safeCreditId = sanitizeDocId(creditId);
  if (!safeCreditId) throw new Error('Crédito inválido: id no válido.');

  const creditRef = firestore().collection('credits').doc(safeCreditId);

  await firestore().runTransaction(async (tx) => {
    const creditSnap = await tx.get(creditRef);
    if (!creditSnap.exists()) return; // ya no existe: reintento idempotente

    const creditData = creditSnap.data() || {};

    // Mismo criterio que al pasar una pre-venta de crédito a contado: borrar un
    // crédito con abonos perdería el registro del dinero ya cobrado.
    const paid = Number(creditData.paid) || 0;
    if (paid > 0) {
      throw new Error(
        `Este crédito tiene ${formatCurrency(paid)} abonados. No se puede eliminar sin perder el registro de lo cobrado.`
      );
    }

    // Los créditos de venta rápida guardan `saleId` y no tienen pre-venta que
    // revertir: en ese caso solo se borra el documento.
    const preSaleId = sanitizeDocId(creditData.preSaleId || creditData.presaleId);
    let preSaleRef = null;
    let preSaleStatus = null;
    if (preSaleId) {
      preSaleRef = firestore().collection('presales').doc(preSaleId);
      const preSaleSnap = await tx.get(preSaleRef);
      if (preSaleSnap.exists()) preSaleStatus = preSaleSnap.data()?.status;
      else preSaleRef = null;
    }

    if (preSaleRef) {
      const revertTo = CREDIT_TO_CASH_STATUS[preSaleStatus];
      if (!revertTo) {
        throw new Error(
          `No se puede eliminar: la pre-venta está en estado "${preSaleStatus}". Solo se puede quitar el crédito antes de que la orden salga de bodega.`
        );
      }
      tx.update(preSaleRef, {
        status: revertTo,
        paymentMethod: 'cash',
        creditId: firestore.FieldValue.delete(),
        creditDueDate: null,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    }

    tx.delete(creditRef);
  });
};
