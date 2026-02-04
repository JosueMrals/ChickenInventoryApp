import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import styles from "../styles/panelsStyles";
import { getSalesByEmployee } from "../services/reportsService";

export default function EmployeesPanelPRO({ dateFrom, dateTo }) {
  const [byEmp, setByEmp] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getSalesByEmployee({ from: dateFrom, to: dateTo });
        if (mounted) setByEmp(res || []);
      } catch (e) {
        if (mounted) setByEmp([]);
      }
    })();
    return () => { mounted = false; };
  }, [dateFrom, dateTo]);

  // calculate max for bars
  const max = Math.max(1, ...(byEmp.map(b => b.total || 0)));

  return (
    <View style={styles.container}>
      <View style={styles.smallHeaderRow}>
        <Text style={styles.panelTitle}>Empleados</Text>
        <Text style={styles.panelSubtitle}>Rendimiento por vendedor</Text>
      </View>

      <View style={styles.chartBox}>
        {(byEmp || []).map((e, idx) => (
          <View key={`${e.id || idx}`} style={styles.barRow}>
            <Text style={styles.barLabel}>{e.name || e.id}</Text>
            <View style={styles.barContainer}>
              <View style={[styles.barFill, { width: `${Math.round(((e.total || 0) / max) * 100)}%`, backgroundColor: "#007AFF" }]} />
            </View>
            <Text style={{ width: 70, textAlign: "right", fontWeight: "700" }}>${(e.total||0).toFixed(2)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
