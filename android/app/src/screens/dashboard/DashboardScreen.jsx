import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Animated, StatusBar } from 'react-native';
import { useDashboardStats } from './hooks/useDashboardStats';
import ModuleCard from './components/ModuleCard';
import DashboardHeader from './components/DashboardHeader';
import StatCardGrid from './components/StatCardGrid';
import ModuleCardGrid from './components/ModuleCardGrid';
import styles from './styles/dashboardStyles';

export default function DashboardScreen({ user, role }) {
  const { stats, loading } = useDashboardStats(role);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const getStatsConfig = () => {
    if (!stats) return { availableStats: {}, layout: [] };

    const availableStats = {
      products: { icon: "cube-outline", color: "#007AFF", title: "Productos", value: stats.products },
      lowStock: { icon: "alert-circle-outline", color: "#FF3B30", title: "Stock bajo", value: stats.lowStock },
      users: { icon: "people-outline", color: "#34C759", title: "Usuarios", value: stats.users },
      pendingPreSales: { icon: "hourglass-outline", color: "#F2C94C", title: "Pendientes", value: stats.pendingPreSales },
      readyForDelivery: { icon: "checkmark-circle-outline", color: "#2DCE89", title: "Listas p/ Entrega", value: stats.readyForDelivery },
      assignedDeliveries: { icon: "bicycle-outline", color: "#007AFF", title: "Entregas Asignadas", value: stats.assignedDeliveries },
      totalToCollect: { icon: "cash-outline", color: "#34C759", title: "Total a Recaudar", value: `C$${stats.totalToCollect?.toFixed(2) || '0.00'}` },
    };

    let layout = [];

    switch (role) {
      case 'admin':
        layout = [
          [{ key: 'products', size: 1 }, { key: 'lowStock', size: 1 }, { key: 'users', size: 1 }],
        ];
        break;
      case 'bodeguero':
        layout = [
          [{ key: 'pendingPreSales', size: 1 }, { key: 'readyForDelivery', size: 1 }]
        ];
        break;
      case 'entregador':
        layout = [
          [{ key: 'assignedDeliveries', size: 1 }],
          [{ key: 'totalToCollect', size: 1 }]
        ];
        break;
      default:
        layout = [
          [{ key: 'products', size: 1 }, { key: 'lowStock', size: 1 }]
        ];
    }

    return { availableStats, layout };
  };

  const getModulesConfig = () => {
    const allModules = [
      { key: 'products-new',label: 'Inventario', icon: 'cube-outline', color: '#007AFF', screen: 'ProductsStack', roles: ['admin', 'vendedor', 'bodeguero'] },
      { key: 'quick-sale', label: 'Venta Rápida', icon: 'flash-outline', color: '#FF9500', screen: 'QuickSales', roles: ['admin', 'vendedor'] },
      { key: 'pre-sale', label: 'Pre-Venta', icon: 'cart-outline', color: '#4CAF50', screen: 'PreSales', roles: ['admin', 'vendedor'] },
      { key: 'customers', label: 'Clientes', icon: 'person-sharp', color: '#FF9500', screen: 'Customer', roles: ['admin', 'vendedor'] },
      { key: 'credits', label: 'Créditos', icon: 'card-outline', color: '#FF3B30', screen: 'Credits', roles: ['admin', 'vendedor'] },
      { key: 'reports', label: 'Reportes', icon: 'bar-chart-outline', color: '#5856D6', screen: 'Reports', roles: ['admin'] },
      { key: 'users', label: 'Usuarios', icon: 'people-outline', color: '#34C759', screen: 'Register', roles: ['admin'] },
      { key: 'settings', label: 'Configuración', icon: 'settings-outline', color: '#8E8E93', screen: 'Settings', roles: ['admin'] },
      { key: 'routes', label: 'Rutas', icon: 'location-outline', color: '#E91E63', screen: 'Routes', roles: ['admin'] },
      { key: 'prepare-presales', label: 'Preparar Pre-Ventas', icon: 'file-tray-stacked-outline', color: '#F2C94C', screen: 'PreparePreSales', roles: ['admin','bodeguero'] },
      { key: 'my-deliveries', label: 'Mis Entregas', icon: 'bicycle-outline', color: '#2DCE89', screen: 'MyDeliveries', roles: ['admin','entregador'] },
    ];

    const availableModules = allModules.filter((m) => m.roles.includes(role));
    let layout = [];

    switch (role) {
      case 'admin':
        layout = [
          [{ key: 'quick-sale', size: 1 }, { key: 'pre-sale', size: 1 }, { key: 'products-new', size: 1 }],
          [{ key: 'customers', size: 1 }, { key: 'credits', size: 1 }, { key: 'routes', size: 1 }],
          [{ key: 'prepare-presales', size: 1 }, { key: 'my-deliveries', size: 1 }],
          [{ key: 'reports', size: 1 }, { key: 'users', size: 1 }, { key: 'settings', size: 1 }],
        ];
        break;
      case 'vendedor':
        layout = [
            [{ key: 'quick-sale', size: 2 }, { key: 'pre-sale', size: 1 }],
            [{ key: 'customers', size: 1 }, { key: 'credits', size: 1 }, { key: 'products-new', size: 1 }],
        ];
        break;
      case 'bodeguero':
        layout = [
            [ { key: 'prepare-presales', size: 2 }, {key: 'products-new', size: 1 }],
        ];
        break;
      case 'entregador':
        layout = [
            [{ key: 'my-deliveries', size: 1 }],
        ];
        break;
      default:
        layout = [
            ...availableModules.map(m => ([{ key: m.key, size: 1 }]))
        ];
    }

    return { availableModules, layout };
  };

  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando panel...</Text>
      </View>
    );

  const { availableStats, layout: statsLayout } = getStatsConfig();
  const { availableModules, layout: modulesLayout } = getModulesConfig();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <DashboardHeader user={user} role={role} />
      <View style={styles.statsContainer}>
        <StatCardGrid availableStats={availableStats} layout={statsLayout} />
      </View>
      <Text style={styles.sectionTitle}>Operaciones</Text>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <ModuleCardGrid
          modules={availableModules}
          layout={modulesLayout}
          anim={anim}
          user={user}
          role={role}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2025 DIALIFGH</Text>
      </View>
    </View>
  );
}
