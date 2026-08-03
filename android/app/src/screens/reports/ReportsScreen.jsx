import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, Animated,
  ScrollView, Dimensions, SafeAreaView, StyleSheet,
  Modal, TouchableWithoutFeedback, StatusBar,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import Icon from "react-native-vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import globalStyles from "../../styles/globalStyles";
import { getQuickRange, makeRange } from "./utils/dateRanges";
import { useReportsData } from "./hooks/useReportsData";
import { clearAllReportsCaches } from "./services/reportsService";

// Paneles
import DashboardPanel from "./panels/DashboardPanel";
import FinancialPanelPRO from "./panels/FinancialPanelPRO";
import ProductsPanelPRO from "./panels/ProductsPanelPRO";
import EmployeesPanelPRO from "./panels/EmployeesPanelPRO";
import ClientsPanelPRO from "./panels/ClientsPanelPRO";
import ProductOperationsPanel from "./panels/ProductOperationsPanel";
import SalesPanel from "./panels/SalesPanel";
import UsersMonitorPanel from "./panels/UsersMonitorPanel";

const SCREEN_WIDTH = Dimensions.get("window").width;

const TABS = [
  { id: "dashboard",          label: "Resumen",    icon: "stats-chart"       },
  { id: "sales",              label: "Ventas",     icon: "receipt-outline"   },
  { id: "product-operations", label: "Ops.",       icon: "swap-horizontal"   },
  { id: "financial",          label: "Finanzas",   icon: "cash-outline"      },
  { id: "products",           label: "Productos",  icon: "cube-outline"      },
  // El panel de vendedores existía y estaba completo, pero no tenía pestaña:
  // `renderPanel` traía un case "employees" al que nunca se podía llegar.
  { id: "employees",          label: "Vendedores", icon: "people-outline"    },
  { id: "clients",            label: "Clientes",   icon: "person-outline"    },
  { id: "users-monitor",      label: "Usuarios",   icon: "shield-outline"    },
];

const QUICK_RANGES = [
  { key: "today",     label: "Hoy",          icon: "today-outline"        },
  { key: "yesterday", label: "Ayer",         icon: "calendar-outline"     },
  { key: "week",      label: "Esta semana",  icon: "calendar-number-outline" },
  { key: "month",     label: "Este mes",     icon: "calendar-clear-outline"},
  { key: "year",      label: "Este año",     icon: "calendar-outline"     },
];

function fmt(date) {
  if (!date) return "—";
  return date.toLocaleDateString("es-NI", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtShort(date) {
  if (!date) return "—";
  return date.toLocaleDateString("es-NI", { day: "2-digit", month: "short" });
}

// ── Modal de Opciones de Filtro ─────────────────────────────────────────────
function FilterOptionsModal({
  visible, onClose,
  activeRange, onSelectRange,
  customFrom, customTo,
  onSelectCustomFrom, onSelectCustomTo,
  onApplyCustom,
}) {
  const [pickerTarget, setPickerTarget] = useState(null); // 'from' | 'to'

  const openPicker = (target) => setPickerTarget(target);
  const closePicker = () => setPickerTarget(null);

  const handlePickerConfirm = (date) => {
    if (pickerTarget === "from") onSelectCustomFrom(date);
    else onSelectCustomTo(date);
    closePicker();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={ms.overlay} />
      </TouchableWithoutFeedback>

      <View style={ms.sheet}>
        {/* Handle */}
        <View style={ms.handle} />
        <Text style={ms.sheetTitle}>Filtrar período</Text>

        {/* Rangos rápidos */}
        <Text style={ms.sectionLabel}>RANGOS RÁPIDOS</Text>
        {QUICK_RANGES.map((r) => {
          const active = activeRange === r.key;
          return (
            <TouchableOpacity
              key={r.key}
              style={[ms.optionRow, active && ms.optionRowActive]}
              onPress={() => { onSelectRange(r.key); onClose(); }}
              activeOpacity={0.75}
            >
              <Icon name={r.icon} size={18} color={active ? "#007AFF" : "#6B7280"} />
              <Text style={[ms.optionLabel, active && ms.optionLabelActive]}>{r.label}</Text>
              {active && <Icon name="checkmark-circle" size={18} color="#007AFF" style={{ marginLeft: "auto" }} />}
            </TouchableOpacity>
          );
        })}

        {/* Rango personalizado */}
        <Text style={[ms.sectionLabel, { marginTop: 16 }]}>RANGO PERSONALIZADO</Text>
        <View style={ms.dateRow}>
          <TouchableOpacity style={ms.dateBtn} onPress={() => openPicker("from")} activeOpacity={0.8}>
            <Icon name="calendar-outline" size={15} color="#007AFF" />
            <Text style={ms.dateBtnLabel}>Desde</Text>
            <Text style={ms.dateBtnValue}>{fmtShort(customFrom)}</Text>
          </TouchableOpacity>
          <View style={ms.dateSep} />
          <TouchableOpacity style={ms.dateBtn} onPress={() => openPicker("to")} activeOpacity={0.8}>
            <Icon name="calendar-outline" size={15} color="#007AFF" />
            <Text style={ms.dateBtnLabel}>Hasta</Text>
            <Text style={ms.dateBtnValue}>{fmtShort(customTo)}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[ms.applyBtn, (!customFrom || !customTo) && ms.applyBtnDisabled]}
          onPress={() => { onApplyCustom(); onClose(); }}
          disabled={!customFrom || !customTo}
          activeOpacity={0.85}
        >
          <Icon name="checkmark-done-outline" size={16} color="#fff" />
          <Text style={ms.applyBtnText}>Aplicar rango</Text>
        </TouchableOpacity>

        {/* DatePicker nativo */}
        <DateTimePickerModal
          isVisible={pickerTarget !== null}
          mode="date"
          date={pickerTarget === "from" ? (customFrom || new Date()) : (customTo || new Date())}
          maximumDate={new Date()}
          onConfirm={handlePickerConfirm}
          onCancel={closePicker}
          locale="es_NI"
          confirmTextIOS="Aceptar"
          cancelTextIOS="Cancelar"
        />
      </View>
    </Modal>
  );
}

// ── Pantalla principal ──────────────────────────────────────────────────────
export default function ReportsScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab]     = useState("dashboard");
  const [loadedTabs, setLoadedTabs]   = useState(["dashboard"]);
  const [activeRange, setActiveRange] = useState("today");
  const [showOptions, setShowOptions] = useState(false);

  const initialDates = getQuickRange("today");
  const [dateFrom, setDateFrom] = useState(initialDates.from);
  const [dateTo,   setDateTo]   = useState(initialDates.to);

  const [customFrom, setCustomFrom] = useState(null);
  const [customTo,   setCustomTo]   = useState(null);

  const tabsScrollRef = useRef(null);
  const slideX = useRef(new Animated.Value(0)).current;
  const currentIndex = TABS.findIndex((t) => t.id === activeTab);

  // Se incrementa en el pull-to-refresh. Los hooks y paneles lo reciben como
  // parte de su clave de rango, así que vuelven a consultar aunque el período
  // sea el mismo. Sin esto, tras registrar una venta el reporte seguía mostrando
  // los números viejos hasta que expirara la caché de 5 minutos.
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const { summary, loading, error } = useReportsData(dateFrom, dateTo, refreshKey);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    clearAllReportsCaches();
    setRefreshKey((k) => k + 1);
    // Los paneles recargan por su cuenta al cambiar `refreshKey`; el indicador
    // solo acompaña el gesto.
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  // Label del período activo
  const dateLabel =
    activeRange === "custom"    ? `${fmtShort(dateFrom)} – ${fmtShort(dateTo)}` :
    activeRange === "today"     ? "Hoy"          :
    activeRange === "yesterday" ? "Ayer"         :
    activeRange === "week"      ? "Esta semana"  :
    activeRange === "month"     ? "Este mes"     :
    activeRange === "year"      ? "Este año"     : "—";

  // Los paneles se montan solo cuando su pestaña se visita por primera vez, y a
  // partir de ahí quedan montados para que el deslizamiento sea instantáneo.
  useEffect(() => {
    setLoadedTabs((prev) => (prev.includes(activeTab) ? prev : [...prev, activeTab]));
  }, [activeTab]);

  useEffect(() => {
    Animated.spring(slideX, {
      toValue: -currentIndex * SCREEN_WIDTH,
      useNativeDriver: true,
      tension: 60, friction: 10,
    }).start();
  }, [currentIndex, slideX]);

  const handleRangeSelect = useCallback((key) => {
    setActiveRange(key);
    const { from, to } = getQuickRange(key);
    setDateFrom(from);
    setDateTo(to);
  }, []);

  const handleApplyCustom = useCallback(() => {
    if (!customFrom || !customTo) return;
    const { from, to } = makeRange(customFrom, customTo);
    setActiveRange("custom");
    setDateFrom(from);
    setDateTo(to);
  }, [customFrom, customTo]);

  const handleTabPress = useCallback((tabId, index) => {
    setActiveTab(tabId);
    tabsScrollRef.current?.scrollTo({
      x: Math.max(0, index * 80 - SCREEN_WIDTH / 2 + 40),
      animated: true,
    });
  }, []);

  const handleBack = useCallback(() => {
    navigation.navigate("DashboardScreen");
  }, [navigation]);

  const renderPanel = (id) => {
    if (!loadedTabs.includes(id)) {
      return (
        <View style={s.placeholderPanel}>
          <Text style={s.placeholderText}>Cargando…</Text>
        </View>
      );
    }
    switch (id) {
      case "dashboard":
        return (
          <DashboardPanel
            data={summary}
            loading={loading}
            error={error}
            dateLabel={dateLabel}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        );
      case "sales":
        return (
          <SalesPanel
            summary={summary}
            loadingSummary={loading}
            dateFrom={dateFrom}
            dateTo={dateTo}
            refreshKey={refreshKey}
          />
        );
      case "financial":
        return <FinancialPanelPRO dateFrom={dateFrom} dateTo={dateTo} refreshKey={refreshKey} />;
      case "products":
        return <ProductsPanelPRO dateFrom={dateFrom} dateTo={dateTo} refreshKey={refreshKey} />;
      case "employees":
        return <EmployeesPanelPRO data={summary?.salesByEmployee} loading={loading} />;
      case "clients":
        return <ClientsPanelPRO dateFrom={dateFrom} dateTo={dateTo} refreshKey={refreshKey} />;
      case "users-monitor":
        return <UsersMonitorPanel dateFrom={dateFrom} dateTo={dateTo} refreshKey={refreshKey} />;
      case "product-operations":
        // El panel resuelve sus propios datos; solo necesita el período.
        return <ProductOperationsPanel dateFrom={dateFrom} dateTo={dateTo} />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar backgroundColor="#007AFF" barStyle="light-content" />

      {/* ── Header (globalStyles) ─────────────────────────────────────── */}
      <View style={[globalStyles.header, s.headerOverride]}>
        <TouchableOpacity
          onPress={handleBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={globalStyles.title}>Informes & Análisis</Text>
        <TouchableOpacity
          style={s.dotsBtn}
          onPress={() => setShowOptions(true)}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="ellipsis-vertical" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <View style={s.tabsBar}>
        <ScrollView
          ref={tabsScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabsContent}
        >
          {TABS.map((t, index) => {
            const active = activeTab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[s.tab, active && s.tabActive]}
                onPress={() => handleTabPress(t.id, index)}
                activeOpacity={0.8}
              >
                <Icon
                  name={t.icon}
                  size={15}
                  color={active ? "#007AFF" : "#9CA3AF"}
                  style={{ marginBottom: 2 }}
                />
                <Text style={[s.tabLabel, active && s.tabLabelActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Paneles deslizantes ───────────────────────────────────────── */}
      <Animated.View
        style={{
          flexDirection: "row",
          width: SCREEN_WIDTH * TABS.length,
          transform: [{ translateX: slideX }],
          flex: 1,
        }}
      >
        {TABS.map((t) => (
          <View key={t.id} style={{ width: SCREEN_WIDTH, flex: 1 }}>
            {renderPanel(t.id)}
          </View>
        ))}
      </Animated.View>

      {/* ── Modal de filtros ─────────────────────────────────────────── */}
      <FilterOptionsModal
        visible={showOptions}
        onClose={() => setShowOptions(false)}
        activeRange={activeRange}
        onSelectRange={handleRangeSelect}
        customFrom={customFrom}
        customTo={customTo}
        onSelectCustomFrom={setCustomFrom}
        onSelectCustomTo={setCustomTo}
        onApplyCustom={handleApplyCustom}
      />
    </SafeAreaView>
  );
}

// ── Estilos principales ─────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen:         { flex: 1, backgroundColor: "#F5F6FA" },
  headerOverride: { marginBottom: 0 },
  dotsBtn:        { padding: 4 },

  // Tabs
  tabsBar:     { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  tabsContent: { paddingHorizontal: 8, paddingVertical: 4 },
  tab:         { alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginHorizontal: 2 },
  tabActive:   { backgroundColor: "#EBF4FF" },
  tabLabel:    { fontSize: 11, color: "#9CA3AF", fontWeight: "500" },
  tabLabelActive: { color: "#007AFF", fontWeight: "700" },

  // Placeholder
  placeholderPanel: { flex: 1, alignItems: "center", justifyContent: "center" },
  placeholderText:  { color: "#9CA3AF" },
});

// ── Estilos del modal ───────────────────────────────────────────────────────
const ms = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center", marginBottom: 14,
  },
  sheetTitle: { fontSize: 17, fontWeight: "700", color: "#111827", marginBottom: 16 },

  sectionLabel: {
    fontSize: 11, fontWeight: "700", color: "#9CA3AF",
    letterSpacing: 0.8, marginBottom: 6,
  },

  optionRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 11, paddingHorizontal: 12,
    borderRadius: 10, marginBottom: 4,
    backgroundColor: "#F9FAFB",
    gap: 10,
  },
  optionRowActive: { backgroundColor: "#EBF4FF" },
  optionLabel:     { fontSize: 14, color: "#374151", fontWeight: "500", flex: 1 },
  optionLabelActive: { color: "#007AFF", fontWeight: "700" },

  dateRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  dateBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: "#F3F4F6", borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 12, gap: 6,
  },
  dateBtnLabel: { fontSize: 11, color: "#6B7280", fontWeight: "600" },
  dateBtnValue: { fontSize: 13, color: "#111827", fontWeight: "700", marginLeft: "auto" },
  dateSep:      { width: 1, backgroundColor: "#E5E7EB" },

  applyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#007AFF", borderRadius: 12,
    paddingVertical: 12, gap: 8,
  },
  applyBtnDisabled: { backgroundColor: "#B0C4DE" },
  applyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
