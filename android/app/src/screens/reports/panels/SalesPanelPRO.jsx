import React from "react";
import { View, Text } from "react-native";
import LineChart from "../components/LineChartPRO";
import styles from "../styles/salesPanelStyles";

export default function SalesPanelPRO({ data, loading }) {

  /*****************************************
   * ⏳ 1. LOADING (SKELETON)
   *****************************************/
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.skeletonCard} />
        <View style={styles.skeletonCard} />
        <View style={styles.skeletonChart} />
      </View>
    );
  }

  /*****************************************
   * ❌ 2. DATA INVALIDA
   *****************************************/
  if (!data || typeof data !== "object") {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Sin datos disponibles</Text>
      </View>
    );
  }

  /*****************************************
   * ✔ 3. NORMALIZACIÓN PRO (V4.1)
   *****************************************/
  const safe = {
    totalIncome: Number(data.totalIncome ?? 0),
    profit: Number(data.profit ?? 0),
    totalSalesCount: Number(data.totalSalesCount ?? 0),
    avgPerSale: Number(data.avgPerSale ?? 0),
    timeseries: Array.isArray(data.timeseries) ? data.timeseries : [],
  };

  const noData =
    safe.timeseries.length === 0 ||
    isNaN(safe.totalIncome) ||
    isNaN(safe.profit);

  if (noData) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Sin datos disponibles</Text>
      </View>
    );
  }

  /*****************************************
   * 📊 4. RENDER PRINCIPAL
   *****************************************/
  return (
    <View style={styles.container}>

      {/* ===================== KPIs FILA 1 ===================== */}
      <View style={styles.row}>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Ingresos</Text>
          <Text style={styles.cardValue}>${safe.totalIncome.toFixed(2)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Ganancia</Text>
          <Text style={styles.cardValue}>${safe.profit.toFixed(2)}</Text>
        </View>

      </View>

      {/* ===================== KPIs FILA 2 ===================== */}
      <View style={styles.row}>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Ventas</Text>
          <Text style={styles.cardValue}>{safe.totalSalesCount}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Promedio</Text>
          <Text style={styles.cardValue}>${safe.avgPerSale.toFixed(2)}</Text>
        </View>

      </View>

      {/* ===================== GRÁFICA ===================== */}
      <View style={styles.chartBox}>
        <Text style={styles.chartTitle}>Tendencia de ventas</Text>
        <LineChart data={safe.timeseries} />
      </View>
    </View>
  );
}
