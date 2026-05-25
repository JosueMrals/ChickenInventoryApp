import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, StyleSheet, Dimensions,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { getClientsReport } from "../services/reportsService";

const SCREEN_W = Dimensions.get("window").width;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const C$ = (n) =>
  `C$${Number(n || 0).toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct  = (n) => `${Number(n || 0).toFixed(1)}%`;
const fmtDate = (d) =>
  d ? d.toLocaleDateString("es-NI", { day: "2-digit", month: "short", year: "2-digit" }) : "—";

// Color por tipo de cliente
const TYPE_META = {
  "Común":          { color: "#6B7280", bg: "#F3F4F6",  icon: "person-outline"        },
  "Semi-mayorista": { color: "#0369A1", bg: "#EFF6FF",  icon: "people-outline"        },
  "Mayorista":      { color: "#7C3AED", bg: "#F5F3FF",  icon: "business-outline"      },
};
const typeMeta = (t) =>
  TYPE_META[t] || { color: "#9CA3AF", bg: "#F9FAFB", icon: "person-outline" };

// Genera avatar con iniciales
const AVATAR_COLORS = ["#0369A1","#059669","#7C3AED","#D97706","#DC2626","#0891B2","#9333EA","#BE185D"];
const avatarColor = (id) => AVATAR_COLORS[(id?.charCodeAt(0) || 0) % AVATAR_COLORS.length];

const TABS = ["Top Clientes", "Directorio", "Tipos"];

// ─── Componentes comunes ──────────────────────────────────────────────────────
function KpiCard({ icon, label, value, color, bg }) {
  return (
    <View style={[cl.kpiCard, { borderTopColor: color, borderTopWidth: 3 }]}>
      <View style={[cl.kpiIcon, { backgroundColor: bg }]}>
        <Icon name={icon} size={15} color={color} />
      </View>
      <Text style={cl.kpiLabel}>{label}</Text>
      <Text style={[cl.kpiValue, { color }]}>{value}</Text>
    </View>
  );
}

function ClientAvatar({ client, size = 42 }) {
  const initials = [client.firstName?.[0], client.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";
  const color    = avatarColor(client.id);
  return (
    <View style={[cl.avatar, { width: size, height: size, borderRadius: size / 3, backgroundColor: color + "22", borderColor: color + "44" }]}>
      <Text style={[cl.avatarText, { color, fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

function ProgressBar({ ratio, color }) {
  return (
    <View style={cl.barBg}>
      <View style={[cl.barFill, { width: `${Math.min(100, (ratio || 0) * 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

function TypeBadge({ type }) {
  const m = typeMeta(type);
  return (
    <View style={[cl.badge, { backgroundColor: m.bg }]}>
      <Icon name={m.icon} size={10} color={m.color} />
      <Text style={[cl.badgeText, { color: m.color }]}>{type}</Text>
    </View>
  );
}

// ─── Tab: Top Clientes ────────────────────────────────────────────────────────
function TopClientsTab({ clients, search }) {
  const [sortBy, setSortBy] = useState("total"); // 'total' | 'count' | 'avg'
  const maxTotal = clients[0]?.total || 1;

  const sorted = useMemo(() => {
    const filtered = search
      ? clients.filter((c) => c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search))
      : clients;
    if (sortBy === "count") return [...filtered].sort((a, b) => b.count    - a.count);
    if (sortBy === "avg")   return [...filtered].sort((a, b) => b.avgTicket - a.avgTicket);
    return [...filtered].sort((a, b) => b.total - a.total);
  }, [clients, search, sortBy]);

  if (!sorted.length) {
    return (
      <View style={cl.emptyBox}>
        <Icon name="people-outline" size={40} color="#CBD5E1" />
        <Text style={cl.emptyText}>Sin clientes con compras en este período</Text>
      </View>
    );
  }

  const maxVal = sortBy === "count" ? Math.max(...sorted.map((c) => c.count), 1)
    : sortBy === "avg" ? Math.max(...sorted.map((c) => c.avgTicket), 1)
    : maxTotal;

  return (
    <>
      {/* Ordenar */}
      <View style={cl.sortRow}>
        {[["total","Total gastado"],["count","# Compras"],["avg","Ticket prom."]].map(([k, l]) => (
          <TouchableOpacity
            key={k}
            style={[cl.sortBtn, sortBy === k && cl.sortBtnActive]}
            onPress={() => setSortBy(k)}
            activeOpacity={0.8}
          >
            <Text style={[cl.sortBtnText, sortBy === k && cl.sortBtnTextActive]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {sorted.map((client, i) => {
        const color = avatarColor(client.id);
        const ratio = sortBy === "count"
          ? client.count    / Math.max(...sorted.map((c) => c.count), 1)
          : sortBy === "avg"
          ? client.avgTicket / Math.max(...sorted.map((c) => c.avgTicket), 1)
          : client.total / maxTotal;
        return (
          <View key={client.id} style={cl.topCard}>
            {/* Rank */}
            <Text style={[cl.rankBadge, { color }]}>#{i + 1}</Text>
            <ClientAvatar client={client} />
            <View style={{ flex: 1 }}>
              <View style={cl.rowBetween}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={cl.clientName} numberOfLines={1}>{client.name}</Text>
                  <TypeBadge type={client.type} />
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[cl.clientTotal, { color }]}>{C$(client.total)}</Text>
                  {client.isNew && (
                    <View style={cl.newBadge}><Text style={cl.newBadgeText}>NUEVO</Text></View>
                  )}
                </View>
              </View>
              <ProgressBar ratio={ratio} color={color} />
              <View style={cl.rowBetween}>
                <Text style={cl.clientSub}>{client.count} compra{client.count !== 1 ? "s" : ""} · {client.itemsQty} uds</Text>
                <Text style={cl.clientSub}>Prom. {C$(client.avgTicket)} · {fmtDate(client.lastDate)}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </>
  );
}

// ─── Tab: Directorio ──────────────────────────────────────────────────────────
function DirectoryTab({ allClients, search }) {
  const [filter, setFilter] = useState("all"); // 'all' | 'active' | 'inactive' | 'new'

  const filtered = useMemo(() => {
    let base =
      filter === "active"   ? allClients.filter((c) => c.isActive) :
      filter === "inactive" ? allClients.filter((c) => !c.isActive) :
      filter === "new"      ? allClients.filter((c) => c.isNew) :
      allClients;
    if (search) base = base.filter((c) =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.cedula?.includes(search)
    );
    return base;
  }, [allClients, filter, search]);

  return (
    <>
      {/* Filtros rápidos */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cl.filterRow}>
        {[["all","Todos"],["active","Activos"],["inactive","Inactivos"],["new","Nuevos"]].map(([k, l]) => (
          <TouchableOpacity
            key={k}
            style={[cl.filterPill, filter === k && cl.filterPillActive]}
            onPress={() => setFilter(k)}
            activeOpacity={0.8}
          >
            <Text style={[cl.filterPillText, filter === k && cl.filterPillTextActive]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={cl.emptyBox}>
          <Icon name="search-outline" size={36} color="#CBD5E1" />
          <Text style={cl.emptyText}>Sin resultados</Text>
        </View>
      ) : (
        filtered.map((client) => {
          const m = typeMeta(client.type);
          return (
            <View key={client.id} style={cl.dirCard}>
              <ClientAvatar client={client} size={40} />
              <View style={{ flex: 1 }}>
                <View style={cl.rowBetween}>
                  <Text style={cl.clientName} numberOfLines={1}>{client.name}</Text>
                  <Text style={[cl.clientTotal, { fontSize: 13, color: client.isActive ? "#059669" : "#9CA3AF" }]}>
                    {C$(client.total)}
                  </Text>
                </View>
                <View style={cl.dirMeta}>
                  <TypeBadge type={client.type} />
                  {client.phone ? (
                    <View style={cl.metaItem}>
                      <Icon name="call-outline" size={10} color="#9CA3AF" />
                      <Text style={cl.metaText}>{client.phone}</Text>
                    </View>
                  ) : null}
                  {client.creditLimit > 0 ? (
                    <View style={cl.metaItem}>
                      <Icon name="card-outline" size={10} color="#9CA3AF" />
                      <Text style={cl.metaText}>Límite {C$(client.creditLimit)}</Text>
                    </View>
                  ) : null}
                </View>
                {client.isActive && (
                  <Text style={cl.clientSub}>{client.count} compra{client.count !== 1 ? "s" : ""} · última {fmtDate(client.lastDate)}</Text>
                )}
                {!client.isActive && (
                  <Text style={[cl.clientSub, { color: "#EF4444" }]}>Sin compras en el período</Text>
                )}
              </View>
              {client.isNew && (
                <View style={cl.newBadge}><Text style={cl.newBadgeText}>NUEVO</Text></View>
              )}
            </View>
          );
        })
      )}
    </>
  );
}

// ─── Tab: Por Tipo ────────────────────────────────────────────────────────────
function TypesTab({ byType, totalRevenue, totalClients }) {
  const TYPE_COLORS = ["#7C3AED","#0369A1","#059669","#D97706","#DC2626"];
  if (!byType.length) {
    return (
      <View style={cl.emptyBox}>
        <Icon name="pie-chart-outline" size={38} color="#CBD5E1" />
        <Text style={cl.emptyText}>Sin datos por tipo</Text>
      </View>
    );
  }
  return (
    <>
      {byType.map((t, i) => {
        const m          = typeMeta(t.type);
        const revenueRatio = totalRevenue > 0 ? t.total   / totalRevenue  : 0;
        const countRatio   = totalClients > 0 ? t.count   / totalClients  : 0;
        return (
          <View key={t.type} style={cl.typeCard}>
            <View style={[cl.typeIcon, { backgroundColor: m.bg }]}>
              <Icon name={m.icon} size={20} color={m.color} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={cl.rowBetween}>
                <Text style={[cl.typeName, { color: m.color }]}>{t.type}</Text>
                <Text style={cl.typeRevenue}>{C$(t.total)}</Text>
              </View>
              <ProgressBar ratio={revenueRatio} color={m.color} />
              <View style={cl.rowBetween}>
                <Text style={cl.clientSub}>
                  {t.count} cliente{t.count !== 1 ? "s" : ""}  ·  {t.activeCount} activo{t.activeCount !== 1 ? "s" : ""}
                </Text>
                <Text style={cl.clientSub}>{pct(revenueRatio * 100)} ingresos · {pct(countRatio * 100)} clientes</Text>
              </View>
              <View style={cl.typeStatRow}>
                <View style={cl.typeStat}>
                  <Text style={[cl.typeStatVal, { color: m.color }]}>{pct(revenueRatio * 100)}</Text>
                  <Text style={cl.typeStatLbl}>del total</Text>
                </View>
                <View style={cl.typeStat}>
                  <Text style={[cl.typeStatVal, { color: m.color }]}>
                    {C$(t.count > 0 ? t.total / t.count : 0)}
                  </Text>
                  <Text style={cl.typeStatLbl}>promedio</Text>
                </View>
                <View style={cl.typeStat}>
                  <Text style={[cl.typeStatVal, { color: m.color }]}>
                    {t.count > 0 ? Math.round((t.activeCount / t.count) * 100) : 0}%
                  </Text>
                  <Text style={cl.typeStatLbl}>activos</Text>
                </View>
              </View>
            </View>
          </View>
        );
      })}
    </>
  );
}

// ─── Panel principal ──────────────────────────────────────────────────────────
export default function ClientsPanelPRO({ dateFrom, dateTo }) {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch]       = useState("");
  const lastKey = useRef(null);

  useEffect(() => {
    const key = `${dateFrom?.getTime?.() ?? ""}_${dateTo?.getTime?.() ?? ""}`;
    if (lastKey.current === key && data) return;
    lastKey.current = key;

    let mounted = true;
    setLoading(true);
    setSearch("");
    getClientsReport({ from: dateFrom, to: dateTo })
      .then((r) => { if (mounted) { setData(r); setLoading(false); } })
      .catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [dateFrom, dateTo]);

  if (loading) {
    return (
      <View style={cl.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={cl.loadingText}>Analizando clientes…</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={cl.centered}>
        <Icon name="cloud-offline-outline" size={40} color="#CBD5E1" />
        <Text style={cl.emptyText}>No se pudieron cargar los datos</Text>
      </View>
    );
  }

  const { totalClients, activeCount, newCount, totalRevenue, avgTicket,
          topClients, allClients, newClients, byType, anonymousCount } = data;

  return (
    <ScrollView style={cl.screen} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">

      {/* ── KPIs scroll horizontal ────────────────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 14 }}>
        <KpiCard icon="people-outline"       label="Total clientes" value={totalClients}  color="#0369A1" bg="#EFF6FF" />
        <KpiCard icon="trending-up"          label="Ingresos"       value={C$(totalRevenue)} color="#059669" bg="#ECFDF5" />
        <KpiCard icon="checkmark-circle-outline" label="Activos"    value={activeCount}   color="#7C3AED" bg="#F5F3FF" />
        <KpiCard icon="receipt-outline"      label="Ticket prom."   value={C$(avgTicket)} color="#D97706" bg="#FFFBEB" />
        {newCount > 0 && (
          <KpiCard icon="star-outline"       label="Nuevos"         value={newCount}      color="#0891B2" bg="#E0F2FE" />
        )}
        {anonymousCount > 0 && (
          <KpiCard icon="help-circle-outline" label="Anónimos"      value={anonymousCount} color="#9CA3AF" bg="#F3F4F6" />
        )}
      </ScrollView>

      {/* ── Barra de búsqueda ─────────────────────────────────── */}
      <View style={cl.searchContainer}>
        <Icon name="search-outline" size={16} color="#9CA3AF" />
        <TextInput
          style={cl.searchInput}
          placeholder="Buscar por nombre, teléfono o cédula…"
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Icon name="close-circle" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <View style={cl.tabRow}>
        {TABS.map((label, i) => (
          <TouchableOpacity
            key={i}
            style={[cl.tabBtn, activeTab === i && cl.tabBtnActive]}
            onPress={() => setActiveTab(i)}
            activeOpacity={0.8}
          >
            <Text style={[cl.tabBtnText, activeTab === i && cl.tabBtnTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Contenido ─────────────────────────────────────────── */}
      <View style={cl.tabContent}>
        {activeTab === 0 && <TopClientsTab clients={topClients} search={search} />}
        {activeTab === 1 && <DirectoryTab  allClients={allClients} search={search} />}
        {activeTab === 2 && <TypesTab      byType={byType} totalRevenue={totalRevenue} totalClients={totalClients} />}
      </View>
    </ScrollView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const cl = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: "#F5F6FA", paddingTop: 14 },
  centered:    { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: "#9CA3AF", fontSize: 13 },
  emptyText:   { color: "#9CA3AF", fontSize: 14, marginTop: 8, textAlign: "center" },
  emptyBox:    { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  rowBetween:  { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },

  // KPI card
  kpiCard: {
    width: 110, backgroundColor: "#fff", borderRadius: 14,
    padding: 12, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4,
  },
  kpiIcon:  { width: 30, height: 30, borderRadius: 8, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  kpiLabel: { fontSize: 10, color: "#6B7280", fontWeight: "500", marginBottom: 2 },
  kpiValue: { fontSize: 16, fontWeight: "800" },

  // Avatar
  avatar:     { justifyContent: "center", alignItems: "center", borderWidth: 1 },
  avatarText: { fontWeight: "800" },

  // Search
  searchContainer: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9,
    marginHorizontal: 14, marginBottom: 12,
    elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#111827", padding: 0 },

  // Tabs
  tabRow:           { flexDirection: "row", marginHorizontal: 14, marginBottom: 12, backgroundColor: "#E5E7EB", borderRadius: 10, padding: 3 },
  tabBtn:           { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8 },
  tabBtnActive:     { backgroundColor: "#fff", elevation: 2 },
  tabBtnText:       { fontSize: 11, color: "#6B7280", fontWeight: "500" },
  tabBtnTextActive: { color: "#007AFF", fontWeight: "700" },
  tabContent:       { paddingHorizontal: 14 },

  // Barra progreso
  barBg:   { height: 5, backgroundColor: "#F1F5F9", borderRadius: 3, overflow: "hidden", marginVertical: 5 },
  barFill: { height: 5, borderRadius: 3 },

  // Badge tipo
  badge:     { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, alignSelf: "flex-start", marginTop: 3 },
  badgeText: { fontSize: 10, fontWeight: "700" },

  // Badge nuevo
  newBadge:     { backgroundColor: "#DBEAFE", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  newBadgeText: { fontSize: 9, fontWeight: "800", color: "#1D4ED8" },

  // Orden
  sortRow:          { flexDirection: "row", gap: 6, marginBottom: 12 },
  sortBtn:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#fff" },
  sortBtnActive:    { backgroundColor: "#007AFF", borderColor: "#007AFF" },
  sortBtnText:      { fontSize: 11, color: "#6B7280", fontWeight: "500" },
  sortBtnTextActive:{ color: "#fff", fontWeight: "700" },

  // Top card
  topCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 10,
    elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3,
  },
  rankBadge:   { fontSize: 12, fontWeight: "800", width: 24, textAlign: "center", marginTop: 2 },
  clientName:  { fontSize: 13, fontWeight: "700", color: "#111827" },
  clientTotal: { fontSize: 14, fontWeight: "800" },
  clientSub:   { fontSize: 10, color: "#9CA3AF", marginTop: 2 },

  // Directorio
  filterRow:        { gap: 6, paddingBottom: 12 },
  filterPill:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#fff" },
  filterPillActive: { backgroundColor: "#007AFF", borderColor: "#007AFF" },
  filterPillText:   { fontSize: 12, color: "#6B7280", fontWeight: "500" },
  filterPillTextActive: { color: "#fff", fontWeight: "700" },

  dirCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 8,
    elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3,
  },
  dirMeta:  { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { fontSize: 10, color: "#9CA3AF" },

  // Tipos
  typeCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 12,
    elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4,
  },
  typeIcon:    { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  typeName:    { fontSize: 15, fontWeight: "800" },
  typeRevenue: { fontSize: 15, fontWeight: "800", color: "#111827" },
  typeStatRow: { flexDirection: "row", marginTop: 8, gap: 8 },
  typeStat:    { flex: 1, alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 8, paddingVertical: 6 },
  typeStatVal: { fontSize: 13, fontWeight: "700" },
  typeStatLbl: { fontSize: 9, color: "#9CA3AF", marginTop: 1 },
});

