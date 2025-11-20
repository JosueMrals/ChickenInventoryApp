import React, { useEffect, useRef } from 'react';
import { View, Text, FlatList, ActivityIndicator, Animated } from 'react-native';
import { useDashboardStats } from './hooks/useDashboardStats';
import StatCard from './components/StatCard';
import ModuleCard from './components/ModuleCard';
import DashboardHeader from './components/DashboardHeader';
import styles from './styles/dashboardStyles';

export default function DashboardScreen({ user, role }) {
  const { stats, loading } = useDashboardStats();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const modules = [
    { key: 'products-new',label: 'Inventario Nuevo', icon: 'cube-outline', color: '#007AFF', screen: 'ProductListScreen', roles: ['admin', 'user'] },
    { key: 'quick-sale', label: 'Venta Rápida', icon: 'flash-outline', color: '#FF9500', screen: 'QuickSales', roles: ['admin', 'user'] },
    { key: 'customers', label: 'Clientes', icon: 'person-sharp', color: '#FF9500', screen: 'Customer', roles: ['admin', 'user'] },
    { key: 'credits', label: 'Créditos', icon: 'card-outline', color: '#FF3B30', screen: 'Credits', roles: ['admin', 'user'] },
    { key: 'reports', label: 'Reportes', icon: 'bar-chart-outline', color: '#5856D6', screen: 'Reports', roles: ['admin', 'user'] },
    { key: 'users', label: 'Usuarios', icon: 'people-outline', color: '#34C759', screen: 'Register', roles: ['admin'] },
    { key: 'settings', label: 'Configuración', icon: 'settings-outline', color: '#8E8E93', screen: 'Settings', roles: ['admin'] },
  ];

  const availableModules = modules.filter((m) => m.roles.includes(role));

  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando panel...</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <DashboardHeader user={user} role={role} />

      {/* 🔹 Estadísticas */}
      <View style={styles.statsContainer}>
        <StatCard icon="cube-outline" color="#007AFF" title="Productos" value={stats.products} />
        <StatCard icon="alert-circle-outline" color="#FF3B30" title="Stock bajo" value={stats.lowStock} />
        {role === 'admin' && (
          <>
            <StatCard icon="people-outline" color="#34C759" title="Usuarios" value={stats.users} />
            <StatCard icon="checkmark-done-outline" color="#5856D6" title="Verificados" value={stats.verifiedUsers} />
          </>
        )}
      </View>

      {/* 🔹 Módulos */}
      <Text style={styles.sectionTitle}>Operaciones</Text>
      <FlatList
        data={availableModules}
        numColumns={2}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <ModuleCard item={item} anim={anim} user={user} role={role} />
        )}
        contentContainerStyle={styles.modulesList}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2025 ChickenInventoryApp</Text>
      </View>
    </View>
  );
}
