import React from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useUsersMonitor } from '../hooks/useReportsData';

const ROLE_CONFIG = {
  admin:      { label: 'Admin',      color: '#7C3AED', bg: '#EDE9FE', icon: 'shield-checkmark' },
  manager:    { label: 'Gerente',    color: '#0369A1', bg: '#E0F2FE', icon: 'briefcase' },
  cashier:    { label: 'Cajero',     color: '#059669', bg: '#ECFDF5', icon: 'cash' },
  delivery:   { label: 'Entregador', color: '#D97706', bg: '#FEF3C7', icon: 'bicycle' },
  user:       { label: 'Usuario',    color: '#6B7280', bg: '#F3F4F6', icon: 'person' },
};

function getRoleConfig(role) {
  return ROLE_CONFIG[String(role || '').toLowerCase()] || ROLE_CONFIG.user;
}

function formatDate(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' });
}

function UserCard({ user, rank }) {
  const rc = getRoleConfig(user.role);
  const initials = (user.displayName || user.email || '?').slice(0, 2).toUpperCase();
  const hasSales = user.salesCount > 0;
  const isVerified = user.verified === true || user.emailVerified === true;

  return (
    <View style={styles.card}>
      {/* Avatar + info principal */}
      <View style={styles.cardTop}>
        <View style={[styles.avatar, { backgroundColor: rc.bg }]}>
          <Text style={[styles.avatarText, { color: rc.color }]}>{initials}</Text>
        </View>

        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.userName} numberOfLines={1}>
              {user.displayName || user.name || user.email?.split('@')[0] || 'Usuario'}
            </Text>
            {isVerified && (
              <Icon name="checkmark-circle" size={14} color="#22C55E" style={{ marginLeft: 4 }} />
            )}
          </View>
          <Text style={styles.userEmail} numberOfLines={1}>{user.email || user.uid}</Text>
          <View style={[styles.roleBadge, { backgroundColor: rc.bg, borderColor: rc.color }]}>
            <Icon name={rc.icon} size={10} color={rc.color} style={{ marginRight: 3 }} />
            <Text style={[styles.roleText, { color: rc.color }]}>{rc.label}</Text>
          </View>
        </View>

        {/* Ranking */}
        {hasSales && (
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>#{rank}</Text>
          </View>
        )}
      </View>

      {/* Métricas */}
      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>
            {hasSales ? `C$${user.salesTotal.toFixed(2)}` : '—'}
          </Text>
          <Text style={styles.metricLabel}>Ventas</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{hasSales ? user.salesCount : '—'}</Text>
          <Text style={styles.metricLabel}>Transacciones</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Text style={styles.metricValue}>
            {hasSales ? `C$${(user.salesTotal / user.salesCount).toFixed(2)}` : '—'}
          </Text>
          <Text style={styles.metricLabel}>Promedio</Text>
        </View>
      </View>

      {/* Última venta */}
      {user.lastSale && (
        <View style={styles.lastSaleRow}>
          <Icon name="time-outline" size={12} color="#9CA3AF" style={{ marginRight: 4 }} />
          <Text style={styles.lastSaleText}>
            Última venta: {formatDate(user.lastSale)} · {formatTime(user.lastSale)}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function UsersMonitorPanel({ dateFrom, dateTo }) {
  const { usersWithStats, loadingUsers } = useUsersMonitor(dateFrom, dateTo);

  if (loadingUsers) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>Cargando usuarios…</Text>
      </View>
    );
  }

  if (!usersWithStats.length) {
    return (
      <View style={styles.center}>
        <Icon name="people-outline" size={48} color="#D1D5DB" />
        <Text style={styles.emptyText}>No hay usuarios registrados</Text>
      </View>
    );
  }

  // KPIs globales
  const totalUsers = usersWithStats.length;
  const activeUsers = usersWithStats.filter((u) => u.salesCount > 0).length;
  const totalSales = usersWithStats.reduce((s, u) => s + u.salesTotal, 0);
  const totalTx = usersWithStats.reduce((s, u) => s + u.salesCount, 0);
  const roleGroups = usersWithStats.reduce((acc, u) => {
    const r = String(u.role || 'user');
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});

  let sellingRank = 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }}>
      {/* KPI header */}
      <View style={styles.kpiHeader}>
        <View style={styles.kpiCard}>
          <Icon name="people" size={20} color="#7C3AED" />
          <Text style={styles.kpiValue}>{totalUsers}</Text>
          <Text style={styles.kpiLabel}>Usuarios</Text>
        </View>
        <View style={styles.kpiCard}>
          <Icon name="pulse" size={20} color="#22C55E" />
          <Text style={styles.kpiValue}>{activeUsers}</Text>
          <Text style={styles.kpiLabel}>Activos hoy</Text>
        </View>
        <View style={styles.kpiCard}>
          <Icon name="receipt-outline" size={20} color="#F59E0B" />
          <Text style={styles.kpiValue}>{totalTx}</Text>
          <Text style={styles.kpiLabel}>Transacciones</Text>
        </View>
        <View style={styles.kpiCard}>
          <Icon name="cash-outline" size={20} color="#0369A1" />
          <Text style={[styles.kpiValue, { fontSize: 13 }]}>C${totalSales.toFixed(0)}</Text>
          <Text style={styles.kpiLabel}>Total ventas</Text>
        </View>
      </View>

      {/* Distribución por rol */}
      {Object.keys(roleGroups).length > 0 && (
        <View style={styles.rolesRow}>
          {Object.entries(roleGroups).map(([role, count]) => {
            const rc = getRoleConfig(role);
            return (
              <View key={role} style={[styles.roleChip, { backgroundColor: rc.bg, borderColor: rc.color }]}>
                <Icon name={rc.icon} size={11} color={rc.color} style={{ marginRight: 3 }} />
                <Text style={[styles.roleChipText, { color: rc.color }]}>{rc.label}: {count}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Título sección */}
      <Text style={styles.sectionTitle}>Actividad por usuario</Text>

      {/* Lista de usuarios */}
      {usersWithStats.map((u) => {
        if (u.salesCount > 0) sellingRank += 1;
        return (
          <UserCard
            key={u.uid}
            user={u}
            rank={u.salesCount > 0 ? sellingRank : null}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  loadingText: { color: '#9CA3AF', fontSize: 14, marginTop: 8 },
  emptyText: { color: '#9CA3AF', fontSize: 15, marginTop: 8 },

  // KPI header
  kpiHeader: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  kpiValue: { fontSize: 16, fontWeight: '800', color: '#111827' },
  kpiLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '500' },

  // Roles
  rolesRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 6, marginBottom: 8 },
  roleChip: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  roleChipText: { fontSize: 11, fontWeight: '700' },

  // Section title
  sectionTitle: {
    fontSize: 14, fontWeight: '800', color: '#374151',
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8,
  },

  // User card
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 16, fontWeight: '800' },
  userInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  userName: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
  userEmail: { fontSize: 12, color: '#9CA3AF', marginBottom: 6 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  roleText: { fontSize: 10, fontWeight: '700' },
  rankBadge: {
    backgroundColor: '#FEF3C7', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: '#F59E0B',
  },
  rankText: { fontSize: 12, fontWeight: '800', color: '#D97706' },

  // Métricas
  metricsRow: {
    flexDirection: 'row', backgroundColor: '#F8FAFC',
    borderRadius: 10, paddingVertical: 10,
  },
  metric: { flex: 1, alignItems: 'center' },
  metricValue: { fontSize: 13, fontWeight: '800', color: '#111827' },
  metricLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  metricDivider: { width: 1, backgroundColor: '#E5E7EB' },

  // Última venta
  lastSaleRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 8, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  lastSaleText: { fontSize: 11, color: '#9CA3AF' },
});

