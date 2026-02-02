import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, StatusBar } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import routesService from './services/routesService';
import { useRoute } from '../../context/RouteContext';

export default function RouteSelectionScreen({ navigation, route }) {
  const { user, role } = route.params || {};
  const { updateRoute } = useRoute();
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRoutes();
  }, []);

  const loadRoutes = async () => {
    try {
      const data = await routesService.getRoutes();
      setRoutes(data);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudieron cargar las rutas.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRoute = async (selected) => {
    try {
      await updateRoute(selected);
      // Navigate to AppDrawer with the user and role
      // If we came from Login, we replace. If from Dashboard (change route), we navigate back or replace.
      // We'll check if we can go back, but usually for "Change Route" we might want to reset stack or just replace.
      // Given the requirement "From dashboard change route", likely we push this screen, then pop or replace back to dashboard.
      // But if coming from Login, we must go to AppDrawer.

      navigation.replace('AppDrawer', { user, role });
    } catch (error) {
        Alert.alert('Error', 'No se pudo seleccionar la ruta.');
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleSelectRoute(item)}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Icon name="location" size={24} color="#007AFF" />
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.routeName}>{item.name}</Text>
        <Text style={styles.routeDetails}>
          {item.start} → {item.end}
        </Text>
      </View>
      <Icon name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />
      <View style={styles.header}>
        <Text style={styles.title}>Selecciona tu Ruta</Text>
        <Text style={styles.subtitle}>Elige la ruta de trabajo para hoy</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={routes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No hay rutas disponibles.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E1F0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoContainer: {
    flex: 1,
  },
  routeName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  routeDetails: {
    fontSize: 14,
    color: '#888',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#999',
    fontSize: 16,
  },
});
