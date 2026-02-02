import React, { useEffect, useRef } from 'react';
import { View, Text, FlatList, ActivityIndicator, Animated, StatusBar } from 'react-native';
import { useDashboardStats } from './hooks/useDashboardStats';
import StatCard from './components/StatCard';
import ModuleCard from './components/ModuleCard';
import DashboardHeader from './components/DashboardHeader';
import styles from './styles/dashboardStyles';

export default function DashboardScreen({ user, role }) {
  const { stats, loading } = useDashboardStats(role);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const modules = [
    // Módulos para Admin y User
    { key: 'products-new',label: 'Inventario', icon: 'cube-outline', color: '#007AFF', screen: 'ProductsStack', roles: ['admin', 'vendedor', 'bodeguero'] },
    { key: 'quick-sale', label: 'Venta Rápida', icon: 'flash-outline', color: '#FF9500', screen: 'QuickSales', roles: ['admin', 'vendedor'] },
    { key: 'pre-sale', label: 'Pre-Venta', icon: 'cart-outline', color: '#4CAF50', screen: 'PreSales', roles: ['admin', 'vendedor'] },
    { key: 'customers', label: 'Clientes', icon: 'person-sharp', color: '#FF9500', screen: 'Customer', roles: ['admin', 'vendedor'] },
    { key: 'credits', label: 'Créditos', icon: 'card-outline', color: '#FF3B30', screen: 'Credits', roles: ['admin', 'vendedor'] },
    { key: 'reports', label: 'Reportes', icon: 'bar-chart-outline', color: '#5856D6', screen: 'Reports', roles: ['admin'] },

    // Módulos solo para Admin
    { key: 'users', label: 'Usuarios', icon: 'people-outline', color: '#34C759', screen: 'Register', roles: ['admin'] },
    { key: 'settings', label: 'Configuración', icon: 'settings-outline', color: '#8E8E93', screen: 'Settings', roles: ['admin'] },
    { key: 'routes', label: 'Rutas', icon: 'location-outline', color: '#E91E63', screen: 'Routes', roles: ['admin'] },

    // Módulo para Bodeguero
    { key: 'prepare-presales', label: 'Preparar Pre-Ventas', icon: 'file-tray-stacked-outline', color: '#F2C94C', screen: 'PreparePreSales', roles: ['admin','bodeguero'] },

    // Módulo para Entregador
    { key: 'my-deliveries', label: 'Mis Entregas', icon: 'bicycle-outline', color: '#2DCE89', screen: 'MyDeliveries', roles: ['admin','entregador','bodeguero'] },
  ];

  const availableModules = modules.filter((m) => m.roles.includes(role));

  const renderStats = () => {
    if (!stats) return null;

    switch (role) {
      case 'admin':
        return (
          <>
            <StatCard icon="cube-outline" color="#007AFF" title="Productos" value={stats.products} />
            <StatCard icon="alert-circle-outline" color="#FF3B30" title="Stock bajo" value={stats.lowStock} />
            <StatCard icon="people-outline" color="#34C759" title="Usuarios" value={stats.users} />
          </>
        );
      case 'bodeguero':
        return (
          <>
            <StatCard icon="hourglass-outline" color="#F2C94C" title="Pendientes" value={stats.pendingPreSales} />
            <StatCard icon="checkmark-circle-outline" color="#2DCE89" title="Listas p/ Entrega" value={stats.readyForDelivery} />
          </>
        );
      case 'entregador':
        return (
          <>
            <StatCard icon="bicycle-outline" color="#007AFF" title="Entregas Asignadas" value={stats.assignedDeliveries} />
            <StatCard icon="cash-outline" color="#34C759" title="Total a Recaudar" value={`$${stats.totalToCollect?.toFixed(2) || '0.00'}`} />
          </>
        );
      case 'user':
      default:
        return (
          <>
            <StatCard icon="cube-outline" color="#007AFF" title="Productos" value={stats.products} />
            <StatCard icon="alert-circle-outline" color="#FF3B30" title="Stock bajo" value={stats.lowStock} />
          </>
        );
    }
  };

  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando panel...</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Sección Fija Superior: Header, Stats y Título */}
      <View>
        <DashboardHeader user={user} role={role} />
        <View style={styles.statsContainer}>
          {renderStats()}
        </View>
        <Text style={styles.sectionTitle}>Operaciones</Text>
      </View>

      {/* Sección Scrollable: Solo los módulos */}
      <FlatList
        key="dashboard-modules-3-cols"
        data={availableModules}
        numColumns={3}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <ModuleCard item={item} anim={anim} user={user} role={role} />
        )}
        contentContainerStyle={styles.modulesList}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Sección Fija Inferior: Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2025 DIALIFGH</Text>
      </View>
    </View>
  );
}
