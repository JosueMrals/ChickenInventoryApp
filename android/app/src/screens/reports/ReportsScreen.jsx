import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  ScrollView,
  Dimensions
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Icon from "react-native-vector-icons/Ionicons";

import firestore from "@react-native-firebase/firestore";
import styles from "./styles/reportsStyles";
import FilterBar from "./components/FilterBar";
import { getQuickRange } from "./utils/dateRanges";
import { getSalesSummaryOptimized } from "./services/reportsService";

// Paneles
import DashboardPanel from "./panels/DashboardPanel";
import SalesPanelPRO from "./panels/SalesPanelPRO";
import FinancialPanelPRO from "./panels/FinancialPanelPRO";
import ProductsPanelPRO from "./panels/ProductsPanelPRO";
import EmployeesPanelPRO from "./panels/EmployeesPanelPRO";
import ClientsPanelPRO from "./panels/ClientsPanelPRO";

const SCREEN_WIDTH = Dimensions.get("window").width;

const TABS = [
  { id: "dashboard", label: "Resumen" },
  { id: "sales", label: "Ventas" },
  { id: "financial", label: "Finanzas" },
  { id: "products", label: "Productos" },
  { id: "employees", label: "Empleados" },
  { id: "clients", label: "Clientes" },
];

export default function ReportsScreen() {

  /**********************************************
   * ESTADOS PRINCIPALES
   **********************************************/

  const [activeTab, setActiveTab] = useState("dashboard");

  // Lazy load storage (solo se cargan paneles una vez)
  const [loadedTabs, setLoadedTabs] = useState(["dashboard"]);

  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);

  // Datos del panel de ventas
  const [salesSummary, setSalesSummary] = useState(null);
  const [loadingSales, setLoadingSales] = useState(false);

  const slideX = useRef(new Animated.Value(0)).current;
  const currentIndex = TABS.findIndex(t => t.id === activeTab);

  /**********************************************
   * 🔥 RESET SIEMPRE A DASHBOARD AL ENTRAR
   **********************************************/
  useFocusEffect(
    useCallback(() => {
      setActiveTab("dashboard");
    }, [])
  );

  /**********************************************
   * 🔥 LAZY LOADING: MARCAR PANEL COMO CARGADO
   **********************************************/
  useEffect(() => {
    if (!loadedTabs.includes(activeTab)) {
      setLoadedTabs(prev => [...prev, activeTab]);
    }
  }, [activeTab]);

  /**********************************************
   * 🔥 ANIMACIÓN ENTRE PANELES
   **********************************************/
  useEffect(() => {
    Animated.spring(slideX, {
      toValue: -currentIndex * SCREEN_WIDTH,
      useNativeDriver: true
    }).start();
  }, [currentIndex]);

  /**********************************************
   * 🔥 CARGAR DATOS SOLO CUANDO SE NECESITAN
   **********************************************/
  useEffect(() => {
    async function loadSales() {
      if (!loadedTabs.includes("sales")) return; // Lazy loading real

      setLoadingSales(true);

      const summary = await getSalesSummaryOptimized({
        from: dateFrom,
        to: dateTo
      });

      setSalesSummary(summary);

      setLoadingSales(false);
    }

    loadSales();
  }, [dateFrom, dateTo, loadedTabs]);


  /**********************************************
   * 🔥 RENDER DE PANEL LAZY
   **********************************************/
  const renderTab = (id) => {
    const isLoaded = loadedTabs.includes(id);

    if (!isLoaded) {
      return (
        <View style={{ padding: 20 }}>
          <Text style={{ color: "#777" }}>Cargando...</Text>
        </View>
      );
    }

    switch (id) {
      case "dashboard":
        return <DashboardPanel dateFrom={dateFrom} dateTo={dateTo} />;

      case "sales":
        return (
          <SalesPanelPRO
            data={salesSummary}
            loading={loadingSales}
          />
        );

      case "financial":
        return <FinancialPanelPRO dateFrom={dateFrom} dateTo={dateTo} />;

      case "products":
        return <ProductsPanelPRO dateFrom={dateFrom} dateTo={dateTo} />;

      case "employees":
        return <EmployeesPanelPRO dateFrom={dateFrom} dateTo={dateTo} />;

      case "clients":
        return <ClientsPanelPRO dateFrom={dateFrom} dateTo={dateTo} />;
    }
  };


  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>Informes & Análisis</Text>
      </View>

      {/* FILTER BAR */}
      <FilterBar
        onQuickFilter={(key) => {
          const { from, to } = getQuickRange(key);
          setDateFrom(from);
          setDateTo(to);
        }}
        onRangeChange={(from, to) => {
          setDateFrom(from);
          setDateTo(to);
        }}
      />

      {/* TAB BAR */}
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        style={styles.tabsContainer}
      >
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tabButton, activeTab === t.id && styles.tabButtonActive]}
            onPress={() => setActiveTab(t.id)}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === t.id && styles.tabLabelActive
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* SLIDE PANELS */}
      <Animated.View
        style={{
          flexDirection: "row",
          width: SCREEN_WIDTH * TABS.length,
          transform: [{ translateX: slideX }],
          flex: 1
        }}
      >
        {TABS.map((t) => (
          <ScrollView      // 👈 SCROLL ÚNICO POR PANEL
            key={t.id}
            style={{ width: SCREEN_WIDTH }}
            contentContainerStyle={{ paddingBottom: 80 }}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}
          >
            {renderTab(t.id)}
          </ScrollView>
        ))}
      </Animated.View>


    </View>
  );
}
