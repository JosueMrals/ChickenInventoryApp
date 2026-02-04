import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useUsers } from './hooks/useUsers';
import UserList from './components/UserList';
import AddUserModal from './components/AddUserModal';
import EditUserModal from './components/EditUserModal';
import { styles } from './styles/userStyles';

export default function UserManagementScreen({ route, navigation }) {
  const { role: currentRole, user: currentUser } = route.params || {};
  const { users, loading, addUser, deleteUser, updateUser } = useUsers();
  
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Se reactiva la guarda de seguridad
  useEffect(() => {
    console.log('Current Role:', currentRole);
    console.log('Current User:', currentUser);
    if (currentRole !== 'admin') {
      Alert.alert(
        'Acceso denegado',
        'Solo los administradores pueden ver esta sección.'
      );
      navigation.goBack();
    }
  }, [currentRole, navigation]);

  const handleEditPress = (user) => {
    setSelectedUser(user);
    setEditModalVisible(true);
  };

  if (currentRole !== 'admin') {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Administración de Usuarios</Text>
        <TouchableOpacity onPress={() => navigation.openDrawer()}>
          <Text style={styles.headerIcon}>☰</Text>
        </TouchableOpacity>
      </View>

      <UserList
        users={users}
        loading={loading}
        currentUser={currentUser}
        onDeleteUser={deleteUser}
        onEditUser={handleEditPress}
      />

      <TouchableOpacity onPress={() => setAddModalVisible(true)} style={styles.addButton}>
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>

      <AddUserModal
        visible={isAddModalVisible}
        onClose={() => setAddModalVisible(false)}
        onAddUser={addUser}
      />

      {selectedUser && (
        <EditUserModal
          visible={isEditModalVisible}
          onClose={() => {
            setEditModalVisible(false);
            setSelectedUser(null);
          }}
          onUpdateUser={updateUser}
          userData={selectedUser}
        />
      )}
    </SafeAreaView>
  );
}
