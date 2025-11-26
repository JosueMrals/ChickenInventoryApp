import React from "react";
import { View, TouchableOpacity, Text } from "react-native";
import styles from "../styles/reportsStyles";
import { getQuickRange } from "../utils/dateRanges";

export default function FilterPills({ quickFilter, setQuickFilter, onDateRangeChange }) {

  const handleSelect = (key) => {
    setQuickFilter(key);
    const { from, to } = getQuickRange(key);
    onDateRangeChange(from, to);
  };

  const pills = [
    { key: "today", label: "Hoy" },
    { key: "yesterday", label: "Ayer" },
    { key: "week", label: "Semana" },
    { key: "month", label: "Mes" },
    { key: "year", label: "Año" }
  ];

  return (
    <View style={styles.filterPills}>
      {pills.map(p => (
        <TouchableOpacity
          key={p.key}
          style={[
            styles.pill,
            quickFilter === p.key && styles.pillActive
          ]}
          onPress={() => handleSelect(p.key)}
        >
          <Text style={[
            styles.pillLabel,
            quickFilter === p.key && styles.pillLabelActive
          ]}>
            {p.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
