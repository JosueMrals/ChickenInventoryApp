import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

// Obtener todos los clientes
export const fetchCustomers = (onUpdate) => {
  let customersUnsub = null;
  const authUnsub = auth().onAuthStateChanged((user) => {
    if (customersUnsub) {
      customersUnsub();
      customersUnsub = null;
    }

    if (!user) {
      onUpdate([]);
      return;
    }

    customersUnsub = firestore()
      .collection('customers')
      .orderBy('firstName', 'asc')
      .onSnapshot(
        (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          onUpdate(data);
        },
        (error) => {
          console.error('[customersService] Snapshot error:', error);
          onUpdate([]);
        }
      );
  });

  return () => {
    if (customersUnsub) {
      customersUnsub();
    }
    if (authUnsub) {
      authUnsub();
    }
  };
};

// Crear cliente
export const createCustomer = async (data) => {
  await firestore().collection('customers').add({
    ...data,
    createdAt: new Date(),
  });
};

// Actualizar cliente
export const updateCustomer = async (id, data) => {
  await firestore().collection('customers').doc(id).update({
    ...data,
    updatedAt: new Date(),
  });
};

// Eliminar cliente
export const deleteCustomer = async (id) => {
  await firestore().collection('customers').doc(id).delete();
};
