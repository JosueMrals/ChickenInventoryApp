import { firestore } from '../../../services/firebaseConfig';

/** 🧾 Obtener lista de créditos en tiempo real */
export const fetchCredits = (onUpdate) => {
  return firestore()
    .collection('credits')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      const data = snapshot.docs.map(doc => {
        const raw = doc.data() || {};
        return {
          id: doc.id,
          preSaleId: raw.preSaleId || raw.presaleId || null,
          ...raw,
        };
      });
      onUpdate(data);
    });
};

/** 💵 Registrar abono y guardar historial */
export const abonarCredito = async (creditId, currentPaid, currentPending, amount, userEmail) => {
  const pago = parseFloat(amount);
  if (!pago || pago <= 0) throw new Error('Monto inválido');
  if (pago > currentPending)
    throw new Error(`El abono no puede ser mayor al saldo pendiente (${currentPending.toFixed(2)}).`);

  const nuevoPagado = currentPaid + pago;
  const nuevoPendiente = currentPending - pago;
  const nuevoEstado = nuevoPendiente <= 0 ? 'paid' : 'pending';

  const abono = {
    amount: pago,
    date: new Date(),
    by: userEmail,
  };

  const creditRef = firestore().collection('credits').doc(creditId);
  const creditSnap = await creditRef.get();
  const creditData = creditSnap.exists ? creditSnap.data() : {};
  const preSaleId = creditData?.preSaleId || creditData?.presaleId || null;

  const batch = firestore().batch();
  batch.update(creditRef, {
    paid: nuevoPagado,
    pending: nuevoPendiente > 0 ? nuevoPendiente : 0,
    status: nuevoEstado,
    updatedAt: new Date(),
    payments: firestore.FieldValue.arrayUnion(abono),
  });

  if (preSaleId && nuevoEstado === 'paid') {
    const preSaleRef = firestore().collection('presales').doc(preSaleId);
    batch.update(preSaleRef, {
      status: 'paid',
      fechaPago: new Date(),
      updatedAt: new Date(),
    });
  }

  await batch.commit();

  return {
    nuevoPagado,
    nuevoPendiente,
    estado: nuevoEstado,
  };
};

/** 🧾 Crear crédito desde una pre-venta */
export const createCreditFromPreSale = async (preSale, createdBy) => {
  if (!preSale?.id) throw new Error('Pre-venta inválida');

  const creditRef = firestore().collection('credits').doc();
  const preSaleRef = firestore().collection('presales').doc(preSale.id);
  const total = Number(preSale.total) || 0;
  const customerName = preSale.customerName || preSale.customer?.firstName || 'Cliente';
  const customerId = preSale.customerId || preSale.customer?.id || null;

  const batch = firestore().batch();
  batch.set(creditRef, {
    preSaleId: preSale.id,
    customerId,
    customerName,
    total,
    paid: 0,
    pending: total,
    status: 'pending',
    createdAt: new Date(),
    createdBy: createdBy || 'N/A',
  });

  batch.update(preSaleRef, {
    status: 'credit_pending',
    creditId: creditRef.id,
    updatedAt: new Date(),
  });

  await batch.commit();
  return creditRef.id;
};

/** ❌ Eliminar crédito */
export const eliminarCredito = async (creditId) => {
  await firestore().collection('credits').doc(creditId).delete();
};
