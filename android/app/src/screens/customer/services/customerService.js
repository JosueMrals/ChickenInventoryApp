// customersService.js
import firestore from '@react-native-firebase/firestore';

const COLLECTION = 'customers';

// -----------------------------------------
// 🔥 LISTENER: obtener clientes en tiempo real
// -----------------------------------------
export const fetchCustomers = (onUpdate) => {
  console.log('[customersService] Subscribing to customers');

  try {
    return firestore()
      .collection(COLLECTION)
      .orderBy('firstName', 'asc')
      .onSnapshot(
        (snapshot) => {
          console.log('[customersService] Snapshot size:', snapshot.size);

          const data = snapshot.docs.map((doc) => {
            const d = doc.data() || {};

            // Mapeo defensivo:
            return {
              id: doc.id,
              firstName: d.firstName ?? '',
              lastName: d.lastName ?? '',
              phone: d.phone ?? '',
              cedula: d.cedula ?? '',
              address: d.address ?? '',
              creditLimit: d.creditLimit ?? 0,
              type: d.type ?? 'Común', // Común | Semi-mayorista | Mayorista
              discount: d.discount ?? 0, // porcentaje
              createdAt: d.createdAt ?? null,
              updatedAt: d.updatedAt ?? null,
              ...d,
            };
          });

          console.log('[customersService] Mapped customers:', data.length);
          onUpdate(data);
        },
        (error) => {
          console.error('[customersService] Snapshot error:', error);
          onUpdate([]);
        }
      );
  } catch (error) {
    console.error('[customersService] fetchCustomers ERROR:', error);
    return () => {};
  }
};

// -----------------------------------------
// ➕ Crear cliente
// -----------------------------------------
export const createCustomer = async (data) => {
  try {
    // Valores por defecto si no existen:
    const payload = {
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
      phone: data.phone ?? '',
      cedula: data.cedula ?? '',
      address: data.address ?? '',
      creditLimit: data.creditLimit ?? 0,
      type: data.type ?? 'Común',
      discount: data.discount ?? 0,
      createdAt: new Date(),
    };

    console.log('[customersService] Creating customer:', payload);

    return await firestore().collection(COLLECTION).add(payload);
  } catch (error) {
    console.error('[customersService] createCustomer ERROR:', error);
    throw error;
  }
};

// -----------------------------------------
// ✏️ Actualizar cliente
// -----------------------------------------
export const updateCustomer = async (id, data) => {
  try {
    const payload = {
      ...data,
      updatedAt: new Date(),
    };

    console.log('[customersService] Updating customer:', id, payload);

    return await firestore().collection(COLLECTION).doc(id).update(payload);
  } catch (error) {
    console.error('[customersService] updateCustomer ERROR:', error);
    throw error;
  }
};

// -----------------------------------------
// 🗑️ Eliminar cliente
// -----------------------------------------
export const deleteCustomer = async (id) => {
  try {
    console.log('[customersService] Deleting customer:', id);
    return await firestore().collection(COLLECTION).doc(id).delete();
  } catch (error) {
    console.error('[customersService] deleteCustomer ERROR:', error);
    throw error;
  }
};
