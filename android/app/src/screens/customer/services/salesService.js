import firestore from '@react-native-firebase/firestore';

const COLLECTION = 'sales';

// ------------------------------------------------------------
// 🔥 LISTENER: Obtener todas las ventas de un cliente
// ------------------------------------------------------------
// ENTRALE: customerId (string), callback(list)
// RETORNA: unsubscribe()
// ------------------------------------------------------------
export const fetchSalesByCustomer = (customerId, onUpdate) => {
  try {
    console.log('[salesService] Subscribing to sales for customer:', customerId);

    return firestore()
      .collection(COLLECTION)
      .where('customerId', '==', customerId)
      .orderBy('date', 'desc')
      .onSnapshot(
        (snapshot) => {
          console.log('[salesService] snapshot size:', snapshot.size);

          const list = snapshot.docs.map((doc) => {
            const d = doc.data() || {};

            return {
              id: doc.id,
              saleNumber: d.saleNumber ?? null,
              customerId: d.customerId ?? null,
              items: Array.isArray(d.items) ? d.items : [],
              subtotal: d.subtotal ?? 0,
              total: d.total ?? 0,
              discountApplied: d.discountApplied ?? 0, // opcional
              paymentType: d.paymentType ?? null,
              date: d.date ? d.date.toDate?.() ?? new Date(d.date) : null,
              createdAt: d.createdAt ?? null,
              ...d,
            };
          });

          console.log('[salesService] mapped list:', list.length);
          onUpdate(list);
        },
        (err) => {
          console.error('[salesService] onSnapshot ERROR =>', err);
          onUpdate([]);
        }
      );
  } catch (error) {
    console.error('[salesService] fetchSalesByCustomer ERROR =>', error);
    return () => {};
  }
};

// ------------------------------------------------------------
// ➕ Registrar venta
// ------------------------------------------------------------
// data = {
//   customerId,
//   items,
//   subtotal,
//   total,
//   discountApplied,
//   paymentType,
//   saleNumber,
// }
// ------------------------------------------------------------
export const registerSale = async (data) => {
  try {
    const payload = {
      ...data,
      date: new Date(),
      createdAt: new Date(),
    };

    console.log('[salesService] Creating sale:', payload);

    return await firestore().collection(COLLECTION).add(payload);
  } catch (error) {
    console.error('[salesService] registerSale ERROR =>', error);
    throw error;
  }
};

// ------------------------------------------------------------
// 📝 Actualizar venta (si algún día lo necesitas)
// ------------------------------------------------------------
export const updateSale = async (id, data) => {
  try {
    const payload = {
      ...data,
      updatedAt: new Date(),
    };

    console.log('[salesService] Updating sale:', id, payload);

    return await firestore().collection(COLLECTION).doc(id).update(payload);
  } catch (error) {
    console.error('[salesService] updateSale ERROR =>', error);
    throw error;
  }
};

// ------------------------------------------------------------
// 🗑️ Eliminar venta — opcional
// ------------------------------------------------------------
export const deleteSale = async (id) => {
  try {
    console.log('[salesService] Deleting sale:', id);
    return await firestore().collection(COLLECTION).doc(id).delete();
  } catch (error) {
    console.error('[salesService] deleteSale ERROR =>', error);
    throw error;
  }
};
