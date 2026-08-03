import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, ScrollView, ActivityIndicator,
  StyleSheet, Dimensions, TouchableOpacity,
} from "react-native";
import Svg, { Rect, Text as SvgText, Line } from "react-native-svg";
import Icon from "react-native-vector-icons/Ionicons";
import { getFinancialDetail } from "../services/reportsService";

const SCREEN_W = Dimensions.get("window").width - 28;

// ─── Helpers ────────────────────────────────────────────────────────────────
const C$ = (n) => `C$${Number(n || 0).toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n) => `${Number(n || 0).toFixed(1)}%`;

const PM_META = {
  efectivo:     { label: "Efectivo",      icon: "cash-outline",         color: "#059669" },
  cash:         { label: "Efectivo",      icon: "cash-outline",         color: "#059669" },
  tarjeta:      { label: "Tarjeta",       icon: "card-outline",         color: "#0369A1" },
  card:         { label: "Tarjeta",       icon: "card-outline",         color: "#0369A1" },
  transferencia:{ label: "Transferencia", icon: "swap-horizontal",      color: "#7C3AED" },
  transfer:     { label: "Transferencia", icon: "swap-horizontal",      color: "#7C3AED" },
  credito:      { label: "Crédito",       icon: "time-outline",         color: "#D97706" },
  credit:       { label: "Crédito",       icon: "time-outline",         color: "#D97706" },
};
const pmMeta = (key) =>
  PM_META[key?.toLowerCase()] || { label: key, icon: "ellipse-outline", color: "#6B7280" };

function fmtDate(str) {
  if (!str) return "";
  const [y, m, d] = str.split("-");
  return `${d}/${m}`;
}

// ─── Gráfica de barras diarias ───────────────────────────────────────────────
function DailyBarChart({ timeseries = [] }) {
  if (!timeseries.length) {
    return (
      <View style={f.emptyChart}>
        <Icon name="bar-chart-outline" size={32} color="#CBD5E1" />
        <Text style={f.emptyChartText}>Sin datos en el período</Text>
      </View>
    );
  }

  const BAR_W   = Math.max(22, Math.min(48, (SCREEN_W - 24) / timeseries.length - 6));
  const CHART_H = 110;
  // reduce en vez de spread: Math.max(...array) revienta con RangeError sobre ~100k elementos.
  const maxVal  = timeseries.reduce((m, t) => Math.max(m, t.income || 0), 1);
  const totalW  = timeseries.length * (BAR_W + 6);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Svg width={Math.max(totalW, SCREEN_W)} height={CHART_H + 30}>
        {/* Línea base */}
        <Line x1={0} y1={CHART_H} x2={Math.max(totalW, SCREEN_W)} y2={CHART_H}
          stroke="#E5E7EB" strokeWidth={1} />
        {timeseries.map((pt, i) => {
          const ratio  = pt.income / maxVal;
          const barH   = Math.max(4, ratio * CHART_H);
          const x      = i * (BAR_W + 6) + 3;
          const y      = CHART_H - barH;
          const alpha  = Math.round(100 + 155 * ratio).toString(16).padStart(2, "0");
          return (
            <React.Fragment key={pt.date}>
              <Rect x={x} y={y} width={BAR_W} height={barH}
                fill={`#007AFF${alpha}`} rx={4} />
              <SvgText x={x + BAR_W / 2} y={CHART_H + 14}
                fontSize={9} fill="#9CA3AF" textAnchor="middle">
                {fmtDate(pt.date)}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </ScrollView>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color, bg, wide }) {
  return (
    <View style={[f.kpiCard, wide && { flex: 1 }, { borderLeftColor: color }]}>
      <View style={[f.kpiIcon, { backgroundColor: bg }]}>
        <Icon name={icon} size={18} color={color} />
      </View>
      <Text style={f.kpiLabel}>{label}</Text>
      <Text style={[f.kpiValue, { color }]}>{value}</Text>
      {sub ? <Text style={f.kpiSub}>{sub}</Text> : null}
    </View>
  );
}

// ─── Fila de desglose ────────────────────────────────────────────────────────
function BreakRow({ label, value, color, bold, indent, separator }) {
  return (
    <>
      {separator && <View style={f.brSep} />}
      <View style={[f.brRow, indent && { paddingLeft: 16 }]}>
        <Text style={[f.brLabel, bold && f.brBold, color && { color }]}>{label}</Text>
        <Text style={[f.brValue, bold && f.brBold, color && { color }]}>{value}</Text>
      </View>
    </>
  );
}

// ─── Panel principal ─────────────────────────────────────────────────────────
export default function FinancialPanelPRO({ dateFrom, dateTo, refreshKey = 0 }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTx, setShowTx]   = useState(false);
  const lastKey = useRef(null);

  useEffect(() => {
    const key = `${dateFrom?.getTime?.() ?? ""}_${dateTo?.getTime?.() ?? ""}_${refreshKey}`;
    if (lastKey.current === key) return;   // la clave ya incluye rango + refreshKey
    lastKey.current = key;

    let mounted = true;
    setLoading(true);
    getFinancialDetail({ from: dateFrom, to: dateTo })
      .then((r) => { if (mounted) { setData(r); setLoading(false); } })
      .catch(()  => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [dateFrom, dateTo, refreshKey]);

  if (loading) {
    return (
      <View style={f.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={f.loadingText}>Calculando finanzas…</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={f.centered}>
        <Icon name="cloud-offline-outline" size={40} color="#CBD5E1" />
        <Text style={f.emptyText}>No hay datos disponibles</Text>
      </View>
    );
  }

  const {
    salesIncome, salesCost, grossProfit, grossMargin, netMargin,
    totalDiscounts, salesCount, avgPerSale, salesSources,
    paymentMethods, timeseries,
    extIncomes, extExpenses, financialDocs,
    totalIncome, totalExpenses, netProfit,
  } = data;

  const hasFinancials = financialDocs?.length > 0;

  return (
    <ScrollView style={f.screen} contentContainerStyle={{ paddingBottom: 32 }}>

      {/* ── Título ─────────────────────────────────────────────────── */}
      <View style={f.sectionHeader}>
        <Icon name="stats-chart-sharp" size={16} color="#007AFF" />
        <Text style={f.sectionTitle}>Resumen Financiero</Text>
      </View>

      {/* ── KPIs fila 1 ────────────────────────────────────────────── */}
      <View style={f.kpiRow}>
        <KpiCard icon="trending-up"    label="Ingresos de ventas" value={C$(salesIncome)}
          sub={`${salesCount} transacciones`} color="#059669" bg="#ECFDF5" />
        <KpiCard icon="wallet-outline"  label="Ganancia neta"       value={C$(netProfit)}
          sub={`Margen ${pct(netMargin)}`}
          color={netProfit >= 0 ? "#7C3AED" : "#DC2626"}
          bg={netProfit >= 0 ? "#F5F3FF" : "#FEF2F2"} />
      </View>
      <View style={f.kpiRow}>
        <KpiCard icon="pie-chart-outline" label="Margen bruto" value={pct(grossMargin)}
          sub={`Ganancia C$${grossProfit.toFixed(0)}`} color="#0369A1" bg="#EFF6FF" />
        <KpiCard icon="pricetag-outline"  label="Descuentos otorgados" value={C$(totalDiscounts)}
          sub={`Promedio/venta ${C$(avgPerSale)}`} color="#D97706" bg="#FFFBEB" />
      </View>

      {/* ── Desglose financiero ────────────────────────────────────── */}
      <View style={f.card}>
        <View style={f.cardHeader}>
          <Icon name="receipt-outline" size={15} color="#007AFF" />
          <Text style={f.cardTitle}>Desglose financiero</Text>
        </View>

        <Text style={f.groupLabel}>INGRESOS</Text>
        <BreakRow label="Ventas directas (caja)"       value={C$(salesSources?.sale    || 0)} indent />
        <BreakRow label="Pre-ventas completadas"        value={C$(salesSources?.presale || 0)} indent />
        {extIncomes > 0 &&
          <BreakRow label="Ingresos financieros extra"  value={C$(extIncomes)} indent />}
        <BreakRow label="Total ingresos" value={C$(totalIncome)} bold color="#059669" separator />

        <Text style={[f.groupLabel, { marginTop: 10 }]}>EGRESOS</Text>
        <BreakRow label="Costo de mercancía (COGS)"    value={C$(salesCost)} indent />
        <BreakRow label="Descuentos aplicados"          value={C$(totalDiscounts)} indent />
        {extExpenses > 0 &&
          <BreakRow label="Gastos operativos"           value={C$(extExpenses)} indent />}
        <BreakRow label="Total egresos" value={C$(totalExpenses)} bold color="#DC2626" separator />

        <BreakRow label="GANANCIA NETA" value={C$(netProfit)}
          bold separator
          color={netProfit >= 0 ? "#7C3AED" : "#DC2626"} />
      </View>

      {/* ── Métodos de pago ───────────────────────────────────────── */}
      {paymentMethods?.length > 0 && (
        <View style={f.card}>
          <View style={f.cardHeader}>
            <Icon name="card-outline" size={15} color="#007AFF" />
            <Text style={f.cardTitle}>Métodos de pago</Text>
          </View>
          {paymentMethods.map((pm, i) => {
            const meta  = pmMeta(pm.label);
            const ratio = salesIncome > 0 ? pm.total / salesIncome : 0;
            return (
              <View key={i} style={f.pmRow}>
                <View style={[f.pmIcon, { backgroundColor: meta.color + "20" }]}>
                  <Icon name={meta.icon} size={14} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={f.pmLabelRow}>
                    <Text style={f.pmLabel}>{meta.label}</Text>
                    <Text style={f.pmAmount}>{C$(pm.total)}</Text>
                  </View>
                  <View style={f.pmBarBg}>
                    <View style={[f.pmBarFill, {
                      width: `${Math.min(100, ratio * 100)}%`,
                      backgroundColor: meta.color,
                    }]} />
                  </View>
                  <Text style={f.pmSub}>{pct(ratio * 100)} · {pm.count} venta{pm.count !== 1 ? "s" : ""}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Tendencia diaria ──────────────────────────────────────── */}
      <View style={f.card}>
        <View style={f.cardHeader}>
          <Icon name="bar-chart-outline" size={15} color="#007AFF" />
          <Text style={f.cardTitle}>Tendencia de ingresos por día</Text>
        </View>
        <DailyBarChart timeseries={timeseries} />
        {timeseries.length > 0 && (
          <View style={f.trendFooter}>
            <Text style={f.trendStat}>Máx: {C$(timeseries.reduce((m, t) => Math.max(m, t.income || 0), 0))}</Text>
            <Text style={f.trendStat}>Min: {C$(timeseries.reduce((m, t) => Math.min(m, t.income || 0), Infinity))}</Text>
            <Text style={f.trendStat}>Prom.: {C$(salesIncome / Math.max(timeseries.length, 1))}</Text>
          </View>
        )}
      </View>

      {/* ── Fuentes de venta ─────────────────────────────────────── */}
      <View style={f.card}>
        <View style={f.cardHeader}>
          <Icon name="layers-outline" size={15} color="#007AFF" />
          <Text style={f.cardTitle}>Origen de ventas</Text>
        </View>
        {[
          { label: "Ventas rápidas (caja)", val: salesSources?.sale || 0, color: "#059669", icon: "flash-outline" },
          { label: "Pre-ventas",            val: salesSources?.presale || 0, color: "#7C3AED", icon: "document-text-outline" },
        ].map((src, i) => {
          const ratio = salesIncome > 0 ? src.val / salesIncome : 0;
          return (
            <View key={i} style={f.pmRow}>
              <View style={[f.pmIcon, { backgroundColor: src.color + "20" }]}>
                <Icon name={src.icon} size={14} color={src.color} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={f.pmLabelRow}>
                  <Text style={f.pmLabel}>{src.label}</Text>
                  <Text style={f.pmAmount}>{C$(src.val)}</Text>
                </View>
                <View style={f.pmBarBg}>
                  <View style={[f.pmBarFill, { width: `${Math.min(100, ratio * 100)}%`, backgroundColor: src.color }]} />
                </View>
                <Text style={f.pmSub}>{pct(ratio * 100)} del total</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* ── Transacciones financieras externas ───────────────────── */}
      {hasFinancials && (
        <View style={f.card}>
          <TouchableOpacity
            style={f.cardHeader}
            onPress={() => setShowTx((v) => !v)}
            activeOpacity={0.75}
          >
            <Icon name="swap-vertical-outline" size={15} color="#007AFF" />
            <Text style={f.cardTitle}>Transacciones financieras ({financialDocs.length})</Text>
            <Icon
              name={showTx ? "chevron-up" : "chevron-down"}
              size={16} color="#9CA3AF"
              style={{ marginLeft: "auto" }}
            />
          </TouchableOpacity>
          <View style={f.txKpiRow}>
            <View style={f.txKpi}>
              <Icon name="arrow-up-circle-outline" size={16} color="#059669" />
              <Text style={[f.txKpiVal, { color: "#059669" }]}>{C$(extIncomes)}</Text>
              <Text style={f.txKpiLbl}>Ingresos ext.</Text>
            </View>
            <View style={f.txDivider} />
            <View style={f.txKpi}>
              <Icon name="arrow-down-circle-outline" size={16} color="#DC2626" />
              <Text style={[f.txKpiVal, { color: "#DC2626" }]}>{C$(extExpenses)}</Text>
              <Text style={f.txKpiLbl}>Gastos ext.</Text>
            </View>
            <View style={f.txDivider} />
            <View style={f.txKpi}>
              <Icon name="wallet-outline" size={16} color={extIncomes - extExpenses >= 0 ? "#7C3AED" : "#DC2626"} />
              <Text style={[f.txKpiVal, { color: extIncomes - extExpenses >= 0 ? "#7C3AED" : "#DC2626" }]}>
                {C$(extIncomes - extExpenses)}
              </Text>
              <Text style={f.txKpiLbl}>Balance ext.</Text>
            </View>
          </View>
          {showTx && financialDocs.map((tx, i) => {
            const isIncome = tx.type === "income";
            return (
              <View key={tx.id || i} style={f.txRow}>
                <View style={[f.txDot, { backgroundColor: isIncome ? "#059669" : "#DC2626" }]} />
                <View style={{ flex: 1 }}>
                  <Text style={f.txDesc}>{tx.description || tx.concept || (isIncome ? "Ingreso" : "Gasto")}</Text>
                  <Text style={f.txDate}>
                    {tx.createdAt?.toDate
                      ? tx.createdAt.toDate().toLocaleDateString("es-NI")
                      : "—"}
                    {tx.category ? ` · ${tx.category}` : ""}
                  </Text>
                </View>
                <Text style={[f.txAmount, { color: isIncome ? "#059669" : "#DC2626" }]}>
                  {isIncome ? "+" : "-"}{C$(tx.amount)}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────
const f = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F6FA", padding: 14 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: "#9CA3AF", marginTop: 8 },
  emptyText:   { color: "#9CA3AF", fontSize: 14 },

  // Sección
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  sectionTitle:  { fontSize: 15, fontWeight: "700", color: "#111827" },

  // KPIs
  kpiRow:  { flexDirection: "row", gap: 10, marginBottom: 10 },
  kpiCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 14,
    padding: 14, borderLeftWidth: 4,
    elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4,
  },
  kpiIcon:  { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  kpiLabel: { fontSize: 11, color: "#6B7280", fontWeight: "500", marginBottom: 2 },
  kpiValue: { fontSize: 18, fontWeight: "800" },
  kpiSub:   { fontSize: 10, color: "#9CA3AF", marginTop: 3 },

  // Card
  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 14,
    marginBottom: 12,
    elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  cardTitle:  { fontSize: 13, fontWeight: "700", color: "#111827" },

  // Desglose
  groupLabel: { fontSize: 10, fontWeight: "700", color: "#9CA3AF", letterSpacing: 0.8, marginBottom: 4, marginTop: 6 },
  brRow:  { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  brLabel:{ fontSize: 13, color: "#374151" },
  brValue:{ fontSize: 13, color: "#374151" },
  brBold: { fontWeight: "700", fontSize: 14 },
  brSep:  { height: 1, backgroundColor: "#F1F5F9", marginVertical: 4 },

  // Métodos de pago
  pmRow:    { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 14 },
  pmIcon:   { width: 32, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center", marginTop: 2 },
  pmLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  pmLabel:  { fontSize: 13, color: "#374151", fontWeight: "600" },
  pmAmount: { fontSize: 13, fontWeight: "700", color: "#111827" },
  pmBarBg:  { height: 8, backgroundColor: "#F1F5F9", borderRadius: 4, overflow: "hidden" },
  pmBarFill:{ height: 8, borderRadius: 4 },
  pmSub:    { fontSize: 10, color: "#9CA3AF", marginTop: 3 },

  // Tendencia
  trendFooter: { flexDirection: "row", justifyContent: "space-around", marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  trendStat:   { fontSize: 11, color: "#6B7280" },
  emptyChart:  { alignItems: "center", justifyContent: "center", paddingVertical: 24, gap: 8 },
  emptyChartText: { color: "#9CA3AF", fontSize: 13 },

  // Transacciones externas
  txKpiRow:  { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 10, padding: 12, marginBottom: 10 },
  txKpi:     { flex: 1, alignItems: "center", gap: 4 },
  txKpiVal:  { fontSize: 14, fontWeight: "800" },
  txKpiLbl:  { fontSize: 10, color: "#9CA3AF" },
  txDivider: { width: 1, height: 36, backgroundColor: "#E5E7EB", marginHorizontal: 4 },
  txRow:     { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  txDot:     { width: 8, height: 8, borderRadius: 4 },
  txDesc:    { fontSize: 13, color: "#374151", fontWeight: "500" },
  txDate:    { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  txAmount:  { fontSize: 14, fontWeight: "700" },
});

