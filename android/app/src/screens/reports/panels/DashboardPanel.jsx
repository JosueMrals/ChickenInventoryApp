import React from "react";
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";

function KpiCard({ icon, label, value, sub, iconColor, bg }) {
  return (
    <View style={[dash.kpiCard, { borderLeftColor: iconColor }]}>
      <View style={[dash.kpiIcon, { backgroundColor: bg }]}>
        <Icon name={icon} size={20} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={dash.kpiLabel}>{label}</Text>
        <Text style={[dash.kpiValue, { color: iconColor }]}>{value}</Text>
        {sub ? <Text style={dash.kpiSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function StatRow({ label, value, highlight }) {
  return (
    <View style={dash.statRow}>
      <Text style={dash.statLabel}>{label}</Text>
      <Text style={[dash.statValue, highlight && { color: highlight }]}>{value}</Text>
    </View>
  );
}

function ProgressBar({ ratio, color }) {
  return (
    <View style={dash.progressBg}>
      <View style={[dash.progressFill, { width: `${Math.min(100, ratio * 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

function TopEmployeeRow({ emp, max, index }) {
  const ratio = max > 0 ? emp.total / max : 0;
  const colors = ['#7C3AED', '#0369A1', '#059669', '#D97706', '#DC2626'];
  const color = colors[index % colors.length];
  const name = emp.name || emp.id || '—';
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <View style={dash.empRow}>
      <View style={[dash.empAvatar, { backgroundColor: color + '22' }]}>
        <Text style={[dash.empAvatarText, { color }]}>{initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={dash.empName} numberOfLines={1}>{name}</Text>
          <Text style={[dash.empTotal, { color }]}>C${emp.total.toFixed(2)}</Text>
        </View>
        <ProgressBar ratio={ratio} color={color} />
        <Text style={dash.empSub}>{emp.count} venta{emp.count !== 1 ? 's' : ''}</Text>
      </View>
    </View>
  );
}

export default function DashboardPanel({ data, loading, error, dateLabel, refreshing, onRefresh }) {
  if (loading) {
    return (
      <View style={dash.center}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={dash.loadingText}>Calculando resumen…</Text>
      </View>
    );
  }

  if (!data) {
    // Distinguir "falló la consulta" de "no hubo ventas": antes ambos casos
    // mostraban el mismo "Sin datos", y un error de red parecía un período vacío.
    return (
      <View style={dash.center}>
        <Icon name="alert-circle-outline" size={48} color="#D1D5DB" />
        <Text style={dash.emptyText}>{error || 'Sin datos para mostrar'}</Text>
        {!!onRefresh && (
          <Text style={dash.retryHint} onPress={onRefresh}>Toca para reintentar</Text>
        )}
      </View>
    );
  }

  const income = Number(data.totalIncome || 0);
  const cost = Number(data.totalCost || 0);
  const profit = Number(data.profit || 0);
  const salesCount = Number(data.totalSalesCount || 0);
  const avgPerSale = Number(data.avgPerSale || 0);
  // El servicio devolvía este mismo número dos veces (`totalSaved` y
  // `totalDiscounts`); ahora hay un solo campo.
  const saved = Number(data.totalDiscounts || 0);
  const margin = income > 0 ? (profit / income) * 100 : 0;

  const topEmployees = Array.isArray(data.salesByEmployee) ? data.salesByEmployee.slice(0, 5) : [];
  const maxEmpTotal = Math.max(1, ...topEmployees.map((e) => e.total || 0));

  const topClients = Array.isArray(data.bestClients) ? data.bestClients.slice(0, 5) : [];

  return (
    <ScrollView
      style={dash.container}
      contentContainerStyle={{ paddingBottom: 30 }}
      refreshControl={
        onRefresh
          ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} colors={['#007AFF']} tintColor="#007AFF" />
          : undefined
      }
    >
      {/* ── Periodo ─────────────────────────────────── */}
      {dateLabel ? (
        <View style={dash.periodBadge}>
          <Icon name="calendar-outline" size={13} color="#7C3AED" style={{ marginRight: 5 }} />
          <Text style={dash.periodText}>{dateLabel}</Text>
        </View>
      ) : null}

      {/* ── KPIs principales ────────────────────────── */}
      <Text style={dash.sectionTitle}>Resumen financiero</Text>
      <KpiCard icon="trending-up" label="Ingresos totales"
        value={`C$${income.toFixed(2)}`}
        sub={`${salesCount} venta${salesCount !== 1 ? 's' : ''} · promedio C$${avgPerSale.toFixed(2)}`}
        iconColor="#059669" bg="#ECFDF5" />
      <KpiCard icon="cart-outline" label="Costo de ventas"
        value={`C$${cost.toFixed(2)}`}
        iconColor="#DC2626" bg="#FEF2F2" />
      <KpiCard icon="stats-chart" label="Ganancia neta"
        value={`C$${profit.toFixed(2)}`}
        sub={`Margen: ${margin.toFixed(1)}%`}
        iconColor={profit >= 0 ? '#7C3AED' : '#DC2626'}
        bg={profit >= 0 ? '#EDE9FE' : '#FEF2F2'} />
      {saved > 0 && (
        <KpiCard icon="pricetag-outline" label="Total ahorrado por clientes"
          value={`C$${saved.toFixed(2)}`}
          sub="Descuentos + bonificaciones aplicados"
          iconColor="#F59E0B" bg="#FEF3C7" />
      )}

      {/* ── Desglose financiero ──────────────────────── */}
      <View style={dash.breakdownCard}>
        <Text style={dash.breakdownTitle}>Desglose</Text>
        <StatRow label="Ingresos brutos" value={`C$${income.toFixed(2)}`} highlight="#059669" />
        <View style={dash.hr} />
        <StatRow label="Costo total" value={`-C$${cost.toFixed(2)}`} highlight="#DC2626" />
        <View style={dash.hr} />
        <StatRow label="Ganancia" value={`C$${profit.toFixed(2)}`} highlight={profit >= 0 ? '#7C3AED' : '#DC2626'} />
        <View style={dash.hr} />
        <StatRow label="Margen neto" value={`${margin.toFixed(1)}%`} />
        <View style={dash.hr} />
        <StatRow label="Promedio por venta" value={`C$${avgPerSale.toFixed(2)}`} />
        <View style={dash.hr} />
        <StatRow label="N° de ventas" value={`${salesCount}`} />
      </View>

      {/* ── Rendimiento por vendedor ─────────────────── */}
      {topEmployees.length > 0 && (
        <>
          <Text style={dash.sectionTitle}>Top vendedores</Text>
          <View style={dash.sectionCard}>
            {topEmployees.map((emp, i) => (
              <TopEmployeeRow key={emp.id || i} emp={emp} max={maxEmpTotal} index={i} />
            ))}
          </View>
        </>
      )}

      {/* ── Mejores clientes ─────────────────────────── */}
      {topClients.length > 0 && (
        <>
          <Text style={dash.sectionTitle}>Mejores clientes</Text>
          <View style={dash.sectionCard}>
            {topClients.map((c, i) => {
              const maxClient = topClients[0]?.total || 1;
              const ratio = c.total / maxClient;
              return (
                <View key={c.customerId || i} style={dash.clientRow}>
                  <View style={dash.clientRank}>
                    <Text style={dash.clientRankText}>#{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={dash.clientName} numberOfLines={1}>{c.name || c.customerId}</Text>
                      <Text style={dash.clientTotal}>C${c.total.toFixed(2)}</Text>
                    </View>
                    <ProgressBar ratio={ratio} color="#0369A1" />
                    <Text style={dash.empSub}>{c.count} compra{c.count !== 1 ? 's' : ''}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const dash = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 40 },
  loadingText: { color: '#9CA3AF', fontSize: 14, marginTop: 8 },
  emptyText: { color: '#9CA3AF', fontSize: 15, marginTop: 8, textAlign: 'center' },
  retryHint: { color: '#007AFF', fontSize: 13, fontWeight: '700', marginTop: 12 },

  periodBadge: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'flex-start', marginHorizontal: 16, marginTop: 14, marginBottom: 2,
    backgroundColor: '#EDE9FE', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  periodText: { fontSize: 12, color: '#7C3AED', fontWeight: '600' },

  sectionTitle: {
    fontSize: 13, fontWeight: '800', color: '#374151',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  // KPI card
  kpiCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14,
    marginHorizontal: 12, marginBottom: 8,
    paddingVertical: 14, paddingHorizontal: 14,
    borderLeftWidth: 4,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    gap: 12,
  },
  kpiIcon: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  kpiLabel: { fontSize: 12, color: '#9CA3AF', fontWeight: '500', marginBottom: 2 },
  kpiValue: { fontSize: 20, fontWeight: '800' },
  kpiSub: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

  // Desglose
  breakdownCard: {
    backgroundColor: '#fff', borderRadius: 14,
    marginHorizontal: 12, marginBottom: 8, paddingHorizontal: 16, paddingVertical: 14,
    elevation: 1,
  },
  breakdownTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  statLabel: { fontSize: 13, color: '#6B7280' },
  statValue: { fontSize: 13, fontWeight: '700', color: '#111827' },
  hr: { height: 1, backgroundColor: '#F1F5F9' },

  // Section card
  sectionCard: {
    backgroundColor: '#fff', borderRadius: 14,
    marginHorizontal: 12, marginBottom: 8, padding: 14,
    elevation: 1, gap: 14,
  },

  // Employee
  empRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  empAvatar: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  empAvatarText: { fontSize: 13, fontWeight: '800' },
  empName: { fontSize: 13, fontWeight: '600', color: '#111827', flex: 1 },
  empTotal: { fontSize: 13, fontWeight: '800' },
  empSub: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },

  // Client
  clientRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  clientRank: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#EFF6FF',
    justifyContent: 'center', alignItems: 'center',
  },
  clientRankText: { fontSize: 11, fontWeight: '800', color: '#0369A1' },
  clientName: { fontSize: 13, fontWeight: '600', color: '#111827', flex: 1 },
  clientTotal: { fontSize: 13, fontWeight: '800', color: '#0369A1' },

  // Progress bar
  progressBg: { height: 5, backgroundColor: '#F1F5F9', borderRadius: 6, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 6 },
});
