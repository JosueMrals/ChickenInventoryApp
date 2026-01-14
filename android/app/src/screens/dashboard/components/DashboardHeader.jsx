import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import { navigationRef } from 'C:/ChickenInventoryApp/App';
import styles from '../styles/dashboardStyles';

export default function DashboardHeader({ user, role }) {
  const handleLogout = async () => {
    try {
      await auth().signOut();
      if (navigationRef.isReady()) {
        navigationRef.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      Alert.alert('Error', 'No se pudo cerrar la sesión.');
    }
  };

  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <Text style={styles.headerTitle}>Bienvenido</Text>
        <Text style={styles.headerSubtitle}>
          {user.email} ({role.toUpperCase()})
        </Text>
      </View>
      <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
        <Icon name="log-out-outline" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
