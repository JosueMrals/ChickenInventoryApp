import { firestore } from './firebaseConfig';

/** 🧾 Obtener lista de créditos en tiempo real */
export const fetchCredits = (onUpdate) => {
  return firestore()
    .collection('credits')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
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

  await firestore().collection('credits').doc(creditId).update({
    paid: nuevoPagado,
    pending: nuevoPendiente > 0 ? nuevoPendiente : 0,
    status: nuevoEstado,
    updatedAt: new Date(),
    payments: firestore.FieldValue.arrayUnion(abono),
  });

  return {
    nuevoPagado,
    nuevoPendiente,
    estado: nuevoEstado,
  };
};


/** ❌ Eliminar crédito */
export const eliminarCredito = async (creditId) => {
  await firestore().collection('credits').doc(creditId).delete();
};
