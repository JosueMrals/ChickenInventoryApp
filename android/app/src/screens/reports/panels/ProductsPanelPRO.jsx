import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  View, Text, ScrollView, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator, StyleSheet, Dimensions,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { getProductsReport } from "../services/reportsService";

const SCREEN_W = Dimensions.get("window").width;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const C$ = (n) =>
  `C$${Number(n || 0).toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n) => `${Number(n || 0).toFixed(1)}%`;

// Genera color e iniciales para un producto sin imagen
const COLORS = ["#0369A1","#059669","#7C3AED","#D97706","#DC2626","#0891B2","#9333EA"];
const colorFor = (id) => COLORS[(id?.charCodeAt(0) || 0) % COLORS.length];

const TABS = ["Más vendidos", "Inventario", "Categorías"];

// ─── Mini componentes ─────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, color, bg }) {
  return (
    <View style={[p.kpiCard, { borderTopColor: color, borderTopWidth: 3 }]}>
      <View style={[p.kpiIcon, { backgroundColor: bg }]}>
        <Icon name={icon} size={16} color={color} />
      </View>
      <Text style={p.kpiLabel}>{label}</Text>
      <Text style={[p.kpiValue, { color }]}>{value}</Text>
    </View>
  );
}

function ProductAvatar({ product, size = 42 }) {
  const initial = (product.name || "?")[0].toUpperCase();
  const color   = colorFor(product.id);
  return (
    <View style={[p.avatar, { width: size, height: size, borderRadius: size / 4, backgroundColor: color + "20", borderColor: color + "40" }]}>
      <Text style={[p.avatarText, { color, fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
}

function ProgressBar({ ratio, color }) {
  return (
    <View style={p.barBg}>
      <View style={[p.barFill, { width: `${Math.min(100, (ratio || 0) * 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

// Badge de stock
function StockBadge({ stock, isLowStock, isOutOfStock }) {
  if (isOutOfStock) return (
    <View style={[p.badge, { backgroundColor: "#FEE2E2" }]}>
      <Text style={[p.badgeText, { color: "#DC2626" }]}>Sin stock</Text>
    </View>
  );
  if (isLowStock) return (
    <View style={[p.badge, { backgroundColor: "#FEF3C7" }]}>
      <Text style={[p.badgeText, { color: "#D97706" }]}>↓ {stock}</Text>
    </View>
  );
  return (
    <View style={[p.badge, { backgroundColor: "#DCFCE7" }]}>
      <Text style={[p.badgeText, { color: "#059669" }]}>{stock}</Text>
    </View>
  );
}

// ─── Tab: Más vendidos ────────────────────────────────────────────────────────
function SalesTab({ products, search }) {
  const maxQty = products[0]?.qtySold || 1;
  const maxRev = Math.max(...products.map((p) => p.revenue), 1);
  const [sortBy, setSortBy] = useState("qty"); // 'qty' | 'revenue' | 'margin'

  const sorted = useMemo(() => {
    const filtered = search
      ? products.filter((pr) => pr.name?.toLowerCase().includes(search.toLowerCase()))
      : products;
    if (sortBy === "revenue") return [...filtered].sort((a, b) => b.revenue - a.revenue);
    if (sortBy === "margin")  return [...filtered].sort((a, b) => b.margin - a.margin);
    return filtered; // qty (ya viene ordenado)
  }, [products, search, sortBy]);

  if (!sorted.length) {
    return (
      <View style={p.emptyBox}>
        <Icon name="cube-outline" size={38} color="#CBD5E1" />
        <Text style={p.emptyText}>Sin ventas en este período</Text>
      </View>
    );
  }

  return (
    <>
      {/* Ordenar */}
      <View style={p.sortRow}>
        {[["qty","Unidades"],["revenue","Ingresos"],["margin","Margen"]].map(([k, l]) => (
          <TouchableOpacity
            key={k}
            style={[p.sortBtn, sortBy === k && p.sortBtnActive]}
            onPress={() => setSortBy(k)}
            activeOpacity={0.8}
          >
            <Text style={[p.sortBtnText, sortBy === k && p.sortBtnTextActive]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {sorted.map((item, i) => {
        const color = colorFor(item.id);
        const ratio = sortBy === "revenue"
          ? item.revenue / maxRev
          : item.qtySold / Math.max(maxQty, 1);
        return (
          <View key={item.id} style={p.productCard}>
            <Text style={[p.rankBadge, { color }]}>#{i + 1}</Text>
            <ProductAvatar product={item} />
            <View style={{ flex: 1 }}>
              <View style={p.rowBetween}>
                <Text style={p.productName} numberOfLines={1}>{item.name}</Text>
                <Text style={[p.productRevenue, { color }]}>{C$(item.revenue)}</Text>
              </View>
              <ProgressBar ratio={ratio} color={color} />
              <View style={p.rowBetween}>
                <Text style={p.productSub}>
                  <Icon name="cube-outline" size={10} color="#9CA3AF" /> {item.qtySold} uds
                  {item.category ? `  ·  ${item.category}` : ""}
                </Text>
                <Text style={p.productSub}>
                  Margen {pct(item.margin)}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </>
  );
}

// ─── Tab: Inventario ──────────────────────────────────────────────────────────
function InventoryTab({ allProducts, lowStock, outOfStock, totalStockValue, search }) {
  const [showSection, setShowSection] = useState("all"); // 'all' | 'low' | 'out'

  const filtered = useMemo(() => {
    const base =
      showSection === "low" ? lowStock :
      showSection === "out" ? outOfStock :
      allProducts;
    if (!search) return base;
    return base.filter((pr) => pr.name?.toLowerCase().includes(search.toLowerCase()));
  }, [allProducts, lowStock, outOfStock, showSection, search]);

  return (
    <>
      {/* Mini KPIs de stock */}
      <View style={p.stockKpiRow}>
        <TouchableOpacity style={[p.stockKpi, showSection === "all" && p.stockKpiActive]} onPress={() => setShowSection("all")} activeOpacity={0.8}>
          <Text style={p.stockKpiVal}>{allProducts.length}</Text>
          <Text style={p.stockKpiLbl}>Total</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[p.stockKpi, showSection === "low" && { backgroundColor: "#FEF3C7" }]} onPress={() => setShowSection("low")} activeOpacity={0.8}>
          <Text style={[p.stockKpiVal, { color: "#D97706" }]}>{lowStock.length}</Text>
          <Text style={p.stockKpiLbl}>Stock bajo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[p.stockKpi, showSection === "out" && { backgroundColor: "#FEE2E2" }]} onPress={() => setShowSection("out")} activeOpacity={0.8}>
          <Text style={[p.stockKpiVal, { color: "#DC2626" }]}>{outOfStock.length}</Text>
          <Text style={p.stockKpiLbl}>Sin stock</Text>
        </TouchableOpacity>
        <View style={[p.stockKpi, { flex: 1.4 }]}>
          <Text style={[p.stockKpiVal, { color: "#0369A1", fontSize: 12 }]} numberOfLines={1}>{C$(totalStockValue)}</Text>
          <Text style={p.stockKpiLbl}>Valor inv.</Text>
        </View>
      </View>

      {/* Alerta si hay agotados */}
      {outOfStock.length > 0 && showSection === "all" && (
        <View style={p.alertBanner}>
          <Icon name="warning-outline" size={15} color="#B91C1C" />
          <Text style={p.alertText}>{outOfStock.length} productos sin stock — revisa tu inventario</Text>
        </View>
      )}

      {/* Lista de productos */}
      {filtered.length === 0 ? (
        <View style={p.emptyBox}>
          <Icon name="checkmark-circle-outline" size={38} color="#059669" />
          <Text style={p.emptyText}>No hay productos en esta sección</Text>
        </View>
      ) : (
        filtered.map((item) => {
          const color = colorFor(item.id);
          const stockRatio = item.stock / Math.max(item.stock + 20, 1); // visual approximation
          return (
            <View key={item.id} style={p.inventoryCard}>
              <ProductAvatar product={item} size={38} />
              <View style={{ flex: 1 }}>
                <View style={p.rowBetween}>
                  <Text style={p.productName} numberOfLines={1}>{item.name}</Text>
                  <StockBadge stock={item.stock} isLowStock={item.isLowStock} isOutOfStock={item.isOutOfStock} />
                </View>
                <View style={p.rowBetween}>
                  <Text style={p.productSub}>Costo: {C$(item.cost)}</Text>
                  <Text style={p.productSub}>Precio: {C$(item.salePrice)}</Text>
                  <Text style={p.productSub}>Valor: {C$(item.stockValue)}</Text>
                </View>
                {!item.isOutOfStock && (
                  <View style={[p.barBg, { marginTop: 4 }]}>
                    <View style={[p.barFill, {
                      width: `${Math.min(100, stockRatio * 100)}%`,
                      backgroundColor: item.isLowStock ? "#D97706" : "#059669",
                    }]} />
                  </View>
                )}
              </View>
            </View>
          );
        })
      )}
    </>
  );
}

// ─── Tab: Categorías ──────────────────────────────────────────────────────────
function CategoriesTab({ categories, totalRevenue }) {
  const CAT_COLORS = ["#0369A1","#7C3AED","#059669","#D97706","#DC2626","#0891B2","#9333EA","#BE185D"];
  if (!categories.length) {
    return (
      <View style={p.emptyBox}>
        <Icon name="grid-outline" size={38} color="#CBD5E1" />
        <Text style={p.emptyText}>Sin datos de categorías</Text>
      </View>
    );
  }
  return (
    <>
      {categories.map((cat, i) => {
        const color = CAT_COLORS[i % CAT_COLORS.length];
        const ratio = totalRevenue > 0 ? cat.revenue / totalRevenue : 0;
        return (
          <View key={cat.name} style={p.catCard}>
            <View style={[p.catDot, { backgroundColor: color }]} />
            <View style={{ flex: 1 }}>
              <View style={p.rowBetween}>
                <Text style={[p.catName, { color }]}>{cat.name}</Text>
                <Text style={p.catRevenue}>{C$(cat.revenue)}</Text>
              </View>
              <ProgressBar ratio={ratio} color={color} />
              <View style={p.rowBetween}>
                <Text style={p.productSub}>{cat.count} producto{cat.count !== 1 ? "s" : ""} · {cat.qty} uds vendidas</Text>
                <Text style={p.productSub}>{pct(ratio * 100)}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </>
  );
}

// ─── Panel principal ──────────────────────────────────────────────────────────
export default function ProductsPanelPRO({ dateFrom, dateTo }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch]     = useState("");
  const lastKey = useRef(null);

  useEffect(() => {
    const key = `${dateFrom?.getTime?.() ?? ""}_${dateTo?.getTime?.() ?? ""}`;
    if (lastKey.current === key && data) return;
    lastKey.current = key;

    let mounted = true;
    setLoading(true);
    setSearch("");
    getProductsReport({ from: dateFrom, to: dateTo })
      .then((r) => { if (mounted) { setData(r); setLoading(false); } })
      .catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [dateFrom, dateTo]);

  if (loading) {
    return (
      <View style={p.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={p.loadingText}>Analizando productos…</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={p.centered}>
        <Icon name="cloud-offline-outline" size={40} color="#CBD5E1" />
        <Text style={p.emptyText}>No se pudieron cargar los datos</Text>
      </View>
    );
  }

  const {
    totalProducts, totalRevenue, totalQtySold, totalStockValue,
    lowStockCount, outOfStockCount,
    topBySales, allProducts, lowStock, outOfStock, categories,
  } = data;

  return (
    <ScrollView style={p.screen} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">

      {/* ── KPIs ──────────────────────────────────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}
        contentContainerStyle={{ gap: 10, paddingHorizontal: 14 }}>
        <KpiCard icon="cube-outline"    label="Productos" value={totalProducts}         color="#0369A1" bg="#EFF6FF" />
        <KpiCard icon="trending-up"     label="Ingresos"  value={C$(totalRevenue)}      color="#059669" bg="#ECFDF5" />
        <KpiCard icon="layers-outline"  label="Uds vendidas" value={totalQtySold}       color="#7C3AED" bg="#F5F3FF" />
        <KpiCard icon="wallet-outline"  label="Valor inventario" value={C$(totalStockValue)} color="#D97706" bg="#FFFBEB" />
        {lowStockCount > 0 && (
          <KpiCard icon="warning-outline" label="Stock bajo" value={lowStockCount}      color="#D97706" bg="#FEF3C7" />
        )}
        {outOfStockCount > 0 && (
          <KpiCard icon="alert-circle-outline" label="Sin stock" value={outOfStockCount} color="#DC2626" bg="#FEE2E2" />
        )}
      </ScrollView>

      {/* ── Barra de búsqueda ──────────────────────────────────── */}
      <View style={p.searchContainer}>
        <Icon name="search-outline" size={16} color="#9CA3AF" />
        <TextInput
          style={p.searchInput}
          placeholder="Buscar producto…"
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
      <View style={p.tabRow}>
        {TABS.map((label, i) => (
          <TouchableOpacity
            key={i}
            style={[p.tabBtn, activeTab === i && p.tabBtnActive]}
            onPress={() => setActiveTab(i)}
            activeOpacity={0.8}
          >
            <Text style={[p.tabBtnText, activeTab === i && p.tabBtnTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Contenido del tab activo ───────────────────────────── */}
      <View style={p.tabContent}>
        {activeTab === 0 && (
          <SalesTab products={topBySales} search={search} />
        )}
        {activeTab === 1 && (
          <InventoryTab
            allProducts={allProducts}
            lowStock={lowStock}
            outOfStock={outOfStock}
            totalStockValue={totalStockValue}
            search={search}
          />
        )}
        {activeTab === 2 && (
          <CategoriesTab categories={categories} totalRevenue={totalRevenue} />
        )}
      </View>
    </ScrollView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const p = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: "#F5F6FA", paddingTop: 14 },
  centered:    { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: "#9CA3AF", fontSize: 13 },
  emptyText:   { color: "#9CA3AF", fontSize: 14, marginTop: 8 },
  emptyBox:    { alignItems: "center", justifyContent: "center", paddingVertical: 40 },

  rowBetween:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  // KPI cards (scroll horizontal)
  kpiCard: {
    width: 104, backgroundColor: "#fff", borderRadius: 14,
    padding: 12, alignItems: "flex-start",
    elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4,
  },
  kpiIcon:  { width: 30, height: 30, borderRadius: 8, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  kpiLabel: { fontSize: 10, color: "#6B7280", fontWeight: "500", marginBottom: 2 },
  kpiValue: { fontSize: 16, fontWeight: "800" },

  // Search
  searchContainer: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9,
    marginHorizontal: 14, marginBottom: 12,
    elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#111827", padding: 0 },

  // Tabs
  tabRow:        { flexDirection: "row", marginHorizontal: 14, marginBottom: 12, backgroundColor: "#E5E7EB", borderRadius: 10, padding: 3 },
  tabBtn:        { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8 },
  tabBtnActive:  { backgroundColor: "#fff", elevation: 2 },
  tabBtnText:    { fontSize: 12, color: "#6B7280", fontWeight: "500" },
  tabBtnTextActive: { color: "#007AFF", fontWeight: "700" },

  tabContent: { paddingHorizontal: 14 },

  // Barra de progreso
  barBg:   { height: 6, backgroundColor: "#F1F5F9", borderRadius: 3, overflow: "hidden", marginVertical: 5 },
  barFill: { height: 6, borderRadius: 3 },

  // Avatar producto
  avatar:     { justifyContent: "center", alignItems: "center", borderWidth: 1 },
  avatarText: { fontWeight: "800" },

  // Tarjeta ventas (más vendidos)
  productCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 10,
    elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3,
  },
  rankBadge:    { fontSize: 12, fontWeight: "800", width: 22, textAlign: "center" },
  productName:  { fontSize: 13, fontWeight: "700", color: "#111827", flex: 1, marginRight: 6 },
  productRevenue: { fontSize: 13, fontWeight: "800" },
  productSub:   { fontSize: 10, color: "#9CA3AF", marginTop: 2 },

  // Órden. rápido
  sortRow:    { flexDirection: "row", gap: 6, marginBottom: 12 },
  sortBtn:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#fff" },
  sortBtnActive:{ backgroundColor: "#007AFF", borderColor: "#007AFF" },
  sortBtnText:  { fontSize: 12, color: "#6B7280", fontWeight: "500" },
  sortBtnTextActive: { color: "#fff", fontWeight: "700" },

  // Tarjeta inventario
  inventoryCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 8,
    elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3,
  },
  badge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: "700" },

  // Stock KPIs
  stockKpiRow:   { flexDirection: "row", gap: 6, marginBottom: 10 },
  stockKpi:      { flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 10, alignItems: "center", elevation: 1 },
  stockKpiActive:{ backgroundColor: "#EFF6FF" },
  stockKpiVal:   { fontSize: 16, fontWeight: "800", color: "#111827" },
  stockKpiLbl:   { fontSize: 9, color: "#9CA3AF", marginTop: 2 },

  // Alerta banner
  alertBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FEE2E2", borderRadius: 10, padding: 10, marginBottom: 12,
  },
  alertText: { fontSize: 12, color: "#B91C1C", fontWeight: "600", flex: 1 },

  // Tarjeta categoría
  catCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 10,
    elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3,
  },
  catDot:    { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  catName:   { fontSize: 14, fontWeight: "700" },
  catRevenue:{ fontSize: 14, fontWeight: "800", color: "#111827" },
});
