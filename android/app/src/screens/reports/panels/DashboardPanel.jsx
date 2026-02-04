import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import styles from "../styles/dashboardPanelStyles";

// Card component for reusability
const InfoCard = ({ iconName, label, value, iconColor, backgroundColor }) => (
  <View style={styles.card}>
    <View style={[styles.iconContainer, { backgroundColor }]}>
      <Icon name={iconName} size={24} color={iconColor} />
    </View>
    <View style={styles.textContainer}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  </View>
);

export default function DashboardPanel({ data, loading }) {
  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={{ marginTop: 10 }}>Cargando…</Text>
      </View>
    );
  }

  const safe = {
    totalIncome: Number(data?.totalIncome || 0),
    totalCost: Number(data?.totalCost || 0),
    profit: Number(data?.profit || 0),
    totalSalesCount: Number(data?.totalSalesCount || 0),
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Resumen Financiero</Text>

      <View style={styles.row}>
        <InfoCard
          iconName="arrow-up-bold-circle"
          label="Ingresos"
          value={`$${safe.totalIncome.toFixed(2)}`}
          iconColor="#4CAF50"
          backgroundColor="rgba(76, 175, 80, 0.2)"
        />
        <InfoCard
          iconName="arrow-down-bold-circle"
          label="Costos"
          value={`$${safe.totalCost.toFixed(2)}`}
          iconColor="#F44336"
          backgroundColor="rgba(244, 67, 54, 0.2)"
        />
      </View>

      <View style={styles.row}>
        <InfoCard
          iconName="chart-line"
          label="Ganancia"
          value={`$${safe.profit.toFixed(2)}`}
          iconColor="#FFC107"
          backgroundColor="rgba(255, 193, 7, 0.2)"
        />
        <InfoCard
          iconName="cart-outline"
          label="Ventas"
          value={safe.totalSalesCount.toString()}
          iconColor="#2196F3"
          backgroundColor="rgba(33, 150, 243, 0.2)"
        />
      </View>
    </View>
  );
}
