import { useState, useEffect } from 'react';
import { onUsersSnapshot, addUser, deleteUser, updateUser } from '../services/userService';
import { Alert } from 'react-native';

export const useUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onUsersSnapshot((data) => {
      setUsers(data);
      setLoading(false);
    });

    // Validar que unsubscribe sea una función antes de llamarla
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const handleAddUser = async (userData) => {
    const successMessage = await addUser(userData);
    Alert.alert('✅ Usuario creado', successMessage);
  };

  const handleDeleteUser = (uid, email) => {
    Alert.alert(
      'Eliminar usuario',
      `¿Estás seguro de que quieres eliminar a ${email}? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUser(uid);
              Alert.alert('Usuario eliminado', `${email} ha sido eliminado de Firestore.`);
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  const handleUpdateUser = async (uid, dataToUpdate) => {
    await updateUser(uid, dataToUpdate);
    Alert.alert('✅ Usuario actualizado', 'Los datos del usuario se actualizaron correctamente.');
  };

  return { users, loading, addUser: handleAddUser, deleteUser: handleDeleteUser, updateUser: handleUpdateUser };
};
