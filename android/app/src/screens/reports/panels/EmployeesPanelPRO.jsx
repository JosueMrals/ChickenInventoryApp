import React from "react";
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";

export default function EmployeesPanelPRO({ data, loading }) {
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#0369A1" />
        <Text style={s.loadingText}>Cargando…</Text>
      </View>
    );
  }

  const employees = Array.isArray(data) ? data : [];

  if (!employees.length) {
    return (
      <View style={s.center}>
        <Icon name="people-outline" size={48} color="#D1D5DB" />
        <Text style={s.emptyText}>Sin datos de vendedores</Text>
        <Text style={s.emptyHint}>Las ventas deben tener el campo "createdBy"</Text>
      </View>
    );
  }

  const max = Math.max(1, ...employees.map((e) => e.total || 0));
  const totalSales = employees.reduce((s, e) => s + e.total, 0);
  const colors = ['#7C3AED','#0369A1','#059669','#D97706','#DC2626'];

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 30 }}>
      {/* KPI global */}
      <View style={s.kpiRow}>
        <View style={s.kpiCard}>
          <Icon name="people" size={20} color="#0369A1" />
          <Text style={s.kpiValue}>{employees.length}</Text>
          <Text style={s.kpiLabel}>Vendedores</Text>
        </View>
        <View style={s.kpiCard}>
          <Icon name="cash-outline" size={20} color="#059669" />
          <Text style={[s.kpiValue, { fontSize: 13 }]}>C${totalSales.toFixed(0)}</Text>
          <Text style={s.kpiLabel}>Total ventas</Text>
        </View>
        <View style={s.kpiCard}>
          <Icon name="podium-outline" size={20} color="#7C3AED" />
          <Text style={[s.kpiValue, { fontSize: 12 }]} numberOfLines={1}>
            {employees[0]?.name || employees[0]?.id || '—'}
          </Text>
          <Text style={s.kpiLabel}>Top vendedor</Text>
        </View>
      </View>

      <Text style={s.sectionTitle}>Rendimiento por vendedor</Text>

      {employees.map((emp, i) => {
        const ratio = (emp.total || 0) / max;
        const color = colors[i % colors.length];
        const initials = (emp.name || emp.id || '?').slice(0, 2).toUpperCase();
        const share = totalSales > 0 ? (emp.total / totalSales) * 100 : 0;

        return (
          <View key={emp.id || i} style={s.card}>
            <View style={s.cardTop}>
              <View style={[s.avatar, { backgroundColor: color + '22' }]}>
                <Text style={[s.avatarText, { color }]}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.empName} numberOfLines={1}>{emp.name || emp.id}</Text>
                <Text style={s.empSub}>{emp.count} venta{emp.count !== 1 ? 's' : ''} · {share.toFixed(1)}% del total</Text>
              </View>
              <View style={[s.rankBadge, { backgroundColor: color + '22', borderColor: color }]}>
                <Text style={[s.rankText, { color }]}>#{i + 1}</Text>
              </View>
            </View>

            <View style={s.barRow}>
              <View style={s.barBg}>
                <View style={[s.barFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: color }]} />
              </View>
              <Text style={[s.barValue, { color }]}>C${(emp.total || 0).toFixed(2)}</Text>
            </View>

            {emp.count > 0 && (
              <Text style={s.avgText}>
                Promedio por venta: C${(emp.total / emp.count).toFixed(2)}
              </Text>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, padding: 40 },
  loadingText: { color: '#9CA3AF', fontSize: 14 },
  emptyText: { color: '#6B7280', fontSize: 15, fontWeight: '600' },
  emptyHint: { color: '#9CA3AF', fontSize: 12, textAlign: 'center' },

  kpiRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 14, paddingBottom: 6, gap: 8 },
  kpiCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12,
    alignItems: 'center', gap: 4, elevation: 1,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  kpiValue: { fontSize: 16, fontWeight: '800', color: '#111827' },
  kpiLabel: { fontSize: 10, color: '#9CA3AF' },

  sectionTitle: {
    fontSize: 13, fontWeight: '800', color: '#374151',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  card: {
    backgroundColor: '#fff', borderRadius: 14,
    marginHorizontal: 12, marginBottom: 10, padding: 14,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 14, fontWeight: '800' },
  empName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  empSub: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  rankBadge: {
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  rankText: { fontSize: 12, fontWeight: '800' },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  barBg: { flex: 1, height: 8, backgroundColor: '#F1F5F9', borderRadius: 6, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 6 },
  barValue: { fontSize: 13, fontWeight: '800', width: 90, textAlign: 'right' },
  avgText: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
});
