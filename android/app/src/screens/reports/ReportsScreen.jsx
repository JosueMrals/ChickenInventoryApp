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
import styles from "./styles/reportsStyles";
import { getQuickRange } from "./utils/dateRanges";
import { useReportsData } from "./hooks/useReportsData";

// Paneles
import DashboardPanel from "./panels/DashboardPanel";
import FinancialPanelPRO from "./panels/FinancialPanelPRO";
import ProductsPanelPRO from "./panels/ProductsPanelPRO";
import EmployeesPanelPRO from "./panels/EmployeesPanelPRO";
import ClientsPanelPRO from "./panels/ClientsPanelPRO";
import ProductOperationsPanel from "./panels/ProductOperationsPanel";
import SalesPanel from "./panels/SalesPanel";

const SCREEN_WIDTH = Dimensions.get("window").width;

const TABS = [
  { id: "dashboard", label: "Resumen" },
  { id: "product-operations", label: "Operaciones de Producto" },
  { id: "sales", label: "Ventas" },
  { id: "financial", label: "Finanzas" },
  { id: "products", label: "Productos" },
  { id: "employees", label: "Empleados" },
  { id: "clients", label: "Clientes" },
];

export default function ReportsScreen() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loadedTabs, setLoadedTabs] = useState(["dashboard"]);

  const initialDates = getQuickRange("today");
  const [dateFrom, setDateFrom] = useState(initialDates.from);
  const [dateTo, setDateTo] = useState(initialDates.to);

  const {
    summary,
    financial,
    operations,
    loading,
    loadingMore,
    loadMoreOperations,
    hasMore,
  } = useReportsData(dateFrom, dateTo);

  const slideX = useRef(new Animated.Value(0)).current;
  const currentIndex = TABS.findIndex((t) => t.id === activeTab);

  useFocusEffect(
    useCallback(() => {
      // No es necesario resetear el tab activo aquí
    }, [])
  );

  useEffect(() => {
    if (!loadedTabs.includes(activeTab)) {
      setLoadedTabs((prev) => [...prev, activeTab]);
    }
  }, [activeTab]);

  useEffect(() => {
    Animated.spring(slideX, {
      toValue: -currentIndex * SCREEN_WIDTH,
      useNativeDriver: true,
    }).start();
  }, [currentIndex]);

  const renderTab = (id) => {
    if (!loadedTabs.includes(id)) {
      return (
        <View style={{ padding: 20 }}>
          <Text style={{ color: "#777" }}>Cargando...</Text>
        </View>
      );
    }

    const combinedSalesData = {
      summary: summary,
      operations: operations,
    };

    switch (id) {
      case "dashboard":
        return <DashboardPanel summary={summary} financial={financial} loading={loading} />;
      case "product-operations":
        return <ProductOperationsPanel operations={operations} loading={loading} />;
      case "sales":
        return <SalesPanel data={combinedSalesData} loading={loading || loadingMore} loadMore={loadMoreOperations} hasMore={hasMore} />;
      case "financial":
        return <FinancialPanelPRO data={financial} loading={loading} />;
      case "products":
        return <ProductsPanelPRO data={summary?.topProducts} loading={loading} />;
      case "employees":
        return <EmployeesPanelPRO data={summary?.salesByEmployee} loading={loading} />;
      case "clients":
        return <ClientsPanelPRO data={summary?.bestClients} loading={loading} />;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Informes & Análisis</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
      >
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tabButton, activeTab === t.id && styles.tabButtonActive]}
            onPress={() => setActiveTab(t.id)}
          >
            <Text style={[styles.tabLabel, activeTab === t.id && styles.tabLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
            {renderTab(t.id)}
          </View>
        ))}
      </Animated.View>
    </View>
  );
}