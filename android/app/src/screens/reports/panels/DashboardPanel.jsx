import React from "react";
import { View, Text } from "react-native";
import styles from "../styles/dashboardPanelStyles";

export default function DashboardPanel({ data, loading }) {

  if (loading) return <View style={styles.loading}><Text>Cargando…</Text></View>;

  const safe = {
    totalIncome: Number(data?.totalIncome || 0),
    totalCost: Number(data?.totalCost || 0),
    profit: Number(data?.profit || 0),
    totalSalesCount: Number(data?.totalSalesCount || 0),
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Resumen general</Text>

      <View style={styles.row}>
        <View style={styles.card}>
          <Text style={styles.label}>Ingresos</Text>
          <Text style={styles.value}>${safe.totalIncome.toFixed(2)}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Costos</Text>
          <Text style={styles.value}>${safe.totalCost.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.card}>
          <Text style={styles.label}>Ganancia</Text>
          <Text style={styles.value}>${safe.profit.toFixed(2)}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Ventas</Text>
          <Text style={styles.value}>{safe.totalSalesCount}</Text>
        </View>
      </View>

    </View>
  );
}
