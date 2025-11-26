import React, { useEffect, useState, useMemo } from "react";
import { View, Text } from "react-native";
import Svg, { Path } from "react-native-svg";
import styles from "../styles/panelsStyles";
import { getFinancialSummary } from "../services/reportsService";

function AreaChart({ data = [], width = 320, height = 100, color = "#0A8F08" }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = Math.max(1, max - min);
  const step = width / Math.max(1, data.length - 1);
  const dPoints = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * height;
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");
  const d = `${dPoints} L ${width} ${height} L 0 ${height} Z`;
  return (
    <Svg width={width} height={height}>
      <Path d={d} fill={color + "33"} stroke={color} strokeWidth={2} />
    </Svg>
  );
}

export default function FinancialPanelPRO({ dateFrom, dateTo }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await getFinancialSummary({ from: dateFrom, to: dateTo });
        if (mounted) setData(r);
      } catch (e) {
        if (mounted) setData(null);
      }
    })();
    return () => { mounted = false; };
  }, [dateFrom, dateTo]);

  const incomes = data?.incomes ?? 0;
  const expenses = data?.expenses ?? 0;
  const balance = data?.balance ?? 0;

  const series = data?.series || [incomes, expenses]; // optional

  return (
    <View style={styles.container}>
      <View style={styles.smallHeaderRow}>
        <Text style={styles.panelTitle}>Finanzas</Text>
        <Text style={styles.panelSubtitle}>Ingresos / Gastos</Text>
      </View>

      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Ingresos</Text>
          <Text style={styles.kpiValue}>${incomes.toFixed(2)}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Gastos</Text>
          <Text style={styles.kpiValue}>${expenses.toFixed(2)}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Balance</Text>
          <Text style={[styles.kpiValue, { color: balance >= 0 ? "#0A8F08" : "#FF3B30" }]}>
            ${balance.toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.chartBox}>
        <Text style={styles.smallChartTitle}>Tendencia Ingresos/Gastos</Text>
        <AreaChart data={series} />
      </View>
    </View>
  );
}
