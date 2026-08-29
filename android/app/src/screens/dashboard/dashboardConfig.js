// Configuración compartida del tablero (módulos e indicadores por rol).
// Se extrajo de DashboardScreen para que las variantes Clásica y Moderna
// consuman exactamente la misma lógica de datos y no se dupliquen definiciones.

import { formatCurrency, formatNumber } from '../../utils/formatMoney';

export const MODULE_GROUPS_BY_ROLE = {
  admin: [
    { label: 'Ventas', keys: ['pre-sale', 'products-new'] },
    { label: 'Clientes y Créditos', keys: ['customers', 'credits'] },
    { label: 'Operaciones', keys: ['routes', 'prepare-presales', 'reception', 'returns', 'my-deliveries', 'staff-purchase'] },
    { label: 'Administración', keys: ['reports', 'users', 'payroll', 'settings'] },
    { label: 'Mi Cuenta', keys: ['profile'] },
  ],
  vendedor: [
    { label: 'Ventas', keys: ['pre-sale', 'products-new'] },
    { label: 'Clientes y Créditos', keys: ['customers', 'credits'] },
    { label: 'Mi Cuenta', keys: ['profile'] },
  ],
  bodeguero: [
    { label: 'Almacén', keys: ['prepare-presales', 'reception', 'returns', 'products-new', 'staff-purchase'] },
    { label: 'Mi Cuenta', keys: ['profile'] },
  ],
  entregador: [
    { label: 'Mis Entregas', keys: ['my-deliveries', 'returns'] },
    { label: 'Consulta', keys: ['customers', 'credits'] },
    { label: 'Otros', keys: ['settings'] },
    { label: 'Mi Cuenta', keys: ['profile'] },
  ],
};

export const STAT_KEYS_BY_ROLE = {
  admin: ['salesToday', 'activeDeliveries', 'pendingCredits', 'products', 'lowStock', 'users'],
  entregador: ['assignedDeliveries', 'totalToCollect'],
};

export const ALL_MODULES = [
  { key: 'products-new', label: 'Inventario', icon: 'cube-outline', color: '#007AFF', screen: 'ProductsStack', roles: ['admin', 'vendedor', 'bodeguero'] },
  { key: 'pre-sale', label: 'Pre-Venta', icon: 'cart-outline', color: '#4CAF50', screen: 'PreSales', roles: ['admin', 'vendedor'] },
  // El entregador entra en modo consulta (sin crear/editar/eliminar).
  { key: 'customers', label: 'Clientes', icon: 'person-sharp', color: '#FF9500', screen: 'Customer', roles: ['admin', 'vendedor', 'entregador'] },
  { key: 'credits', label: 'Créditos', icon: 'card-outline', color: '#FF3B30', screen: 'Credits', roles: ['admin', 'vendedor', 'entregador'] },
  { key: 'reports', label: 'Reportes', icon: 'bar-chart-outline', color: '#5856D6', screen: 'Reports', roles: ['admin'] },
  { key: 'users', label: 'Usuarios', icon: 'people-outline', color: '#34C759', screen: 'Register', roles: ['admin'] },
  { key: 'settings', label: 'Configuración', icon: 'settings-outline', color: '#8E8E93', screen: 'Settings', roles: ['admin', 'entregador'] },
  { key: 'routes', label: 'Rutas', icon: 'location-outline', color: '#E91E63', screen: 'Routes', roles: ['admin'] },
  { key: 'prepare-presales', label: 'Preparar Pre-Ventas', icon: 'file-tray-stacked-outline', color: '#F2C94C', screen: 'PreparePreSales', roles: ['admin', 'bodeguero'] },
  { key: 'reception', label: 'Recepción de Mercancía', icon: 'download-outline', color: '#27AE60', screen: 'Reception', roles: ['admin', 'bodeguero'] },
  { key: 'returns', label: 'Devoluciones', icon: 'return-up-back-outline', color: '#E67E22', screen: 'Returns', roles: ['admin', 'bodeguero', 'entregador'] },
  { key: 'my-deliveries', label: 'Mis Entregas', icon: 'bicycle-outline', color: '#2DCE89', screen: 'MyDeliveries', roles: ['admin', 'entregador'] },
  { key: 'payroll', label: 'Nómina', icon: 'wallet-outline', color: '#007AFF', screen: 'Payroll', roles: ['admin'] },
  { key: 'staff-purchase', label: 'Entrega a Personal', icon: 'bag-handle-outline', color: '#5856D6', screen: 'StaffPurchase', roles: ['admin', 'bodeguero'] },
  { key: 'profile', label: 'Mi Perfil', icon: 'person-circle-outline', color: '#5AC8FA', screen: 'Profile', roles: ['admin', 'vendedor', 'bodeguero', 'entregador', 'user'] },
];

// Construye las filas de indicadores para el rol dado a partir de los agregados.
export function getStatRows(role, stats) {
  if (!stats) return [];

  const statDefinitions = {
    products: { icon: 'cube-outline', color: '#007AFF', title: 'Productos', value: formatNumber(stats.products) },
    lowStock: { icon: 'alert-circle-outline', color: '#FF3B30', title: 'Stock bajo', value: formatNumber(stats.lowStock) },
    users: { icon: 'people-outline', color: '#34C759', title: 'Usuarios', value: formatNumber(stats.users) },
    salesToday: { icon: 'cash-outline', color: '#2ECC71', title: 'Ventas Hoy', value: formatCurrency(stats.salesTodayTotal) },
    activeDeliveries: { icon: 'car-outline', color: '#2D9CDB', title: 'Entregas Activas', value: formatNumber(stats.activeDeliveries) },
    pendingCredits: { icon: 'card-outline', color: '#EB5757', title: 'Créditos Pendientes', value: formatCurrency(stats.pendingCreditsAmount) },
    assignedDeliveries: { icon: 'bicycle-outline', color: '#007AFF', title: 'Entregas Asignadas', value: formatNumber(stats.assignedDeliveries) },
    totalToCollect: { icon: 'cash-outline', color: '#34C759', title: 'Total a Recaudar', value: formatCurrency(stats.totalToCollect) },
  };

  const keys = STAT_KEYS_BY_ROLE[role] || [];
  return keys.map((key) => ({ key, ...statDefinitions[key] }));
}

// Construye los grupos de módulos disponibles para el rol dado.
export function getModuleGroups(role) {
  const modulesByKey = ALL_MODULES.reduce((map, m) => ({ ...map, [m.key]: m }), {});
  const availableModules = ALL_MODULES.filter((m) => m.roles.includes(role));
  const availableKeys = new Set(availableModules.map((m) => m.key));

  const groupConfig = MODULE_GROUPS_BY_ROLE[role] || [{ label: 'Módulos', keys: availableModules.map((m) => m.key) }];

  return groupConfig
    .map((group) => ({
      label: group.label,
      modules: group.keys.filter((key) => availableKeys.has(key)).map((key) => modulesByKey[key]),
    }))
    .filter((group) => group.modules.length > 0);
}
