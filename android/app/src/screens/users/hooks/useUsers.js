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

    return () => unsubscribe();
  }, []);

  const handleAddUser = async (userData) => {
    try {
      const successMessage = await addUser(userData);
      Alert.alert('Usuario creado', successMessage);
    } catch (error) {
      console.log('🔥 Error creando usuario:', error);
      let errorMessage = 'Ocurrió un error inesperado.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'El correo electrónico ya está en uso.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'El formato del correo es inválido.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'La contraseña debe tener al menos 6 caracteres.';
      }
      Alert.alert('Error al crear usuario', errorMessage);
    }
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
    try {
      await updateUser(uid, dataToUpdate);
      Alert.alert('Usuario actualizado', 'Los datos del usuario se actualizaron correctamente.');
    } catch (error) {
      console.log('🔥 Error actualizando usuario:', error);
      Alert.alert('Error', error.message);
    }
  };

  return { users, loading, addUser: handleAddUser, deleteUser: handleDeleteUser, updateUser: handleUpdateUser };
};
