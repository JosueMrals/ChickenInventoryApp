import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { navigationRef } from 'C:/ChickenInventoryApp/App';
import styles from '../styles/DashboardHeaderStyles';
import { useRoute } from '../../../context/RouteContext';

export default function DashboardHeader({ user, role }) {
  const navigation = useNavigation();
  const { selectedRoute } = useRoute();

  // Normalizamos el rol a minúsculas para evitar problemas de mayúsculas/minúsculas
  const safeRole = role ? role.toLowerCase() : '';
  const canSelectRoute = ['vendedor', 'entregador', 'bodeguero', 'user'].includes(safeRole);

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

  const handleChangeRoute = () => {
    navigation.navigate('RouteSelection', { user, role });
  };

  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <Text style={styles.headerTitle}>Bienvenido</Text>
        <Text style={styles.headerSubtitle}>
          {user.email} • {role ? role.toUpperCase() : ''}
        </Text>

        {/* Renderizado condicional de la selección de ruta */}
        {canSelectRoute && (
          <TouchableOpacity
            onPress={handleChangeRoute}
            style={{flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingVertical: 4}}
            activeOpacity={0.6}
          >
            <Icon name="location-sharp" size={16} color="#007AFF" style={{marginRight: 4}} />
            <Text style={{color: '#007AFF', fontWeight: '700', fontSize: 14}}>
              {selectedRoute ? `Ruta: ${selectedRoute.name}` : 'Seleccionar Ruta'}
            </Text>
            <Icon name="chevron-down" size={16} color="#007AFF" style={{marginLeft: 4}} />
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
        <Icon name="log-out-outline" size={24} color="#FF3B30" />
      </TouchableOpacity>
    </View>
  );
}
