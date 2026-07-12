import React, { useRef, useState } from 'react';
import { View, Text, ActivityIndicator, Animated, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useDashboardStats } from './hooks/useDashboardStats';
import { useRoute } from '../../context/RouteContext';
import DashboardHeader from './components/DashboardHeader';
import InfoSection from './components/InfoSection';
import InfoRow from './components/InfoRow';
import styles from './styles/dashboardStyles';

const NAV_BAR_HEIGHT = 44;

const MODULE_GROUPS_BY_ROLE = {
  admin: [
    { label: 'Ventas', keys: ['pre-sale', 'products-new'] },
    { label: 'Clientes y Créditos', keys: ['customers', 'credits'] },
    { label: 'Operaciones', keys: ['routes', 'prepare-presales', 'returns', 'my-deliveries'] },
    { label: 'Administración', keys: ['reports', 'users', 'settings'] },
    { label: 'Mi Cuenta', keys: ['profile'] },
  ],
  vendedor: [
    { label: 'Ventas', keys: ['pre-sale', 'products-new'] },
    { label: 'Clientes y Créditos', keys: ['customers', 'credits'] },
    { label: 'Mi Cuenta', keys: ['profile'] },
  ],
  bodeguero: [
    { label: 'Almacén', keys: ['prepare-presales', 'returns', 'products-new'] },
    { label: 'Mi Cuenta', keys: ['profile'] },
  ],
  entregador: [
    { label: 'Mis Entregas', keys: ['my-deliveries'] },
    { label: 'Otros', keys: ['credits', 'settings'] },
    { label: 'Mi Cuenta', keys: ['profile'] },
  ],
};

const STAT_KEYS_BY_ROLE = {
  admin: ['salesToday', 'activeDeliveries', 'pendingCredits', 'products', 'lowStock', 'users'],
  entregador: ['assignedDeliveries', 'totalToCollect'],
};

export default function DashboardScreen({ user, role, navigation }) {
  const { stats, loading } = useDashboardStats(role, user);
  const insets = useSafeAreaInsets();
  const { selectedRoute } = useRoute();
  const [userProfile, setUserProfile] = useState(null);

  const scrollY = useRef(new Animated.Value(0)).current;

  const firstName = (userProfile?.nombre || user?.nombre || user?.name || user?.displayName || user?.email?.split('@')?.[0] || 'Usuario').trim();
  const lastName = (userProfile?.apellido || user?.apellido || '').trim();
  const displayName = `${firstName}${lastName ? ` ${lastName}` : ''}`;
  const safeRole = role ? role.toLowerCase() : '';
  const canSelectRoute = ['vendedor', 'entregador', 'bodeguero', 'user'].includes(safeRole);

  const getStatRows = () => {
    if (!stats) return [];

    const statDefinitions = {
      products: { icon: 'cube-outline', color: '#007AFF', title: 'Productos', value: stats.products },
      lowStock: { icon: 'alert-circle-outline', color: '#FF3B30', title: 'Stock bajo', value: stats.lowStock },
      users: { icon: 'people-outline', color: '#34C759', title: 'Usuarios', value: stats.users },
      salesToday: { icon: 'cash-outline', color: '#2ECC71', title: 'Ventas Hoy', value: `C$${stats.salesTodayTotal?.toFixed(2) || '0.00'}` },
      activeDeliveries: { icon: 'car-outline', color: '#2D9CDB', title: 'Entregas Activas', value: stats.activeDeliveries },
      pendingCredits: { icon: 'card-outline', color: '#EB5757', title: 'Créditos Pendientes', value: `C$${stats.pendingCreditsAmount?.toFixed(2) || '0.00'}` },
      assignedDeliveries: { icon: 'bicycle-outline', color: '#007AFF', title: 'Entregas Asignadas', value: stats.assignedDeliveries },
      totalToCollect: { icon: 'cash-outline', color: '#34C759', title: 'Total a Recaudar', value: `C$${stats.totalToCollect?.toFixed(2) || '0.00'}` },
    };

    const keys = STAT_KEYS_BY_ROLE[role] || [];
    return keys.map((key) => ({ key, ...statDefinitions[key] }));
  };

  const getModuleGroups = () => {
    const allModules = [
      { key: 'products-new', label: 'Inventario', icon: 'cube-outline', color: '#007AFF', screen: 'ProductsStack', roles: ['admin', 'vendedor', 'bodeguero'] },
      { key: 'pre-sale', label: 'Pre-Venta', icon: 'cart-outline', color: '#4CAF50', screen: 'PreSales', roles: ['admin', 'vendedor'] },
      { key: 'customers', label: 'Clientes', icon: 'person-sharp', color: '#FF9500', screen: 'Customer', roles: ['admin', 'vendedor'] },
      { key: 'credits', label: 'Créditos', icon: 'card-outline', color: '#FF3B30', screen: 'Credits', roles: ['admin', 'vendedor', 'entregador'] },
      { key: 'reports', label: 'Reportes', icon: 'bar-chart-outline', color: '#5856D6', screen: 'Reports', roles: ['admin'] },
      { key: 'users', label: 'Usuarios', icon: 'people-outline', color: '#34C759', screen: 'Register', roles: ['admin'] },
      { key: 'settings', label: 'Configuración', icon: 'settings-outline', color: '#8E8E93', screen: 'Settings', roles: ['admin', 'entregador'] },
      { key: 'routes', label: 'Rutas', icon: 'location-outline', color: '#E91E63', screen: 'Routes', roles: ['admin'] },
      { key: 'prepare-presales', label: 'Preparar Pre-Ventas', icon: 'file-tray-stacked-outline', color: '#F2C94C', screen: 'PreparePreSales', roles: ['admin', 'bodeguero'] },
      { key: 'returns', label: 'Devoluciones', icon: 'return-up-back-outline', color: '#E67E22', screen: 'Returns', roles: ['admin', 'bodeguero'] },
      { key: 'my-deliveries', label: 'Mis Entregas', icon: 'bicycle-outline', color: '#2DCE89', screen: 'MyDeliveries', roles: ['admin', 'entregador'] },
      { key: 'profile', label: 'Mi Perfil', icon: 'person-circle-outline', color: '#5AC8FA', screen: 'Profile', roles: ['admin', 'vendedor', 'bodeguero', 'entregador', 'user'] },
    ];

    const modulesByKey = allModules.reduce((map, m) => ({ ...map, [m.key]: m }), {});
    const availableModules = allModules.filter((m) => m.roles.includes(role));
    const availableKeys = new Set(availableModules.map((m) => m.key));

    const groupConfig = MODULE_GROUPS_BY_ROLE[role] || [{ label: 'Módulos', keys: availableModules.map((m) => m.key) }];

    return groupConfig
      .map((group) => ({
        label: group.label,
        modules: group.keys.filter((key) => availableKeys.has(key)).map((key) => modulesByKey[key]),
      }))
      .filter((group) => group.modules.length > 0);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando panel...</Text>
      </View>
    );
  }

  const statRows = getStatRows();
  const moduleGroups = getModuleGroups();
  const rawTodayLabel = format(new Date(), "EEEE d 'de' MMMM", { locale: es });
  const todayLabel = rawTodayLabel.charAt(0).toUpperCase() + rawTodayLabel.slice(1);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F4F8" />

      <DashboardHeader displayName={displayName} scrollY={scrollY} />

      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + NAV_BAR_HEIGHT }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.largeTitleBlock}>
          <Text style={styles.largeTitleGreeting}>Hola, {displayName} 👋</Text>
          <Text style={styles.largeTitleSubtitle}>
            {role ? `${role.toUpperCase()} • ` : ''}{todayLabel}
          </Text>
        </View>

        <View style={styles.sectionsContainer}>
          {canSelectRoute && (
            <InfoSection>
              <InfoRow
                icon="location-sharp"
                color="#007AFF"
                label="Ruta actual"
                value={selectedRoute ? selectedRoute.name : 'Seleccionar'}
                onPress={() => navigation.navigate('RouteSelection', { user, role })}
                wrapValue
              />
            </InfoSection>
          )}

          {statRows.length > 0 && (
            <InfoSection title="Resumen">
              {statRows.map((stat) => (
                <InfoRow key={stat.key} icon={stat.icon} color={stat.color} label={stat.title} value={stat.value} />
              ))}
            </InfoSection>
          )}

          {moduleGroups.map((group) => (
            <InfoSection key={group.label} title={group.label}>
              {group.modules.map((m) => (
                <InfoRow
                  key={m.key}
                  icon={m.icon}
                  color={m.color}
                  label={m.label}
                  onPress={() => navigation.navigate(m.screen, { user, role })}
                />
              ))}
            </InfoSection>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2025 DIALIFGH</Text>
        </View>
      </Animated.ScrollView>
    </View>
  );
}
