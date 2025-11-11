import firestore from '@react-native-firebase/firestore';

// Obtener todos los clientes
export const fetchCustomers = (onUpdate) => {
  return firestore()
    .collection('customers')
    .orderBy('firstName', 'asc')
    .onSnapshot(snapshot => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      onUpdate(data);
    });
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
