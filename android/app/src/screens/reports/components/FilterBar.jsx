import React, { useState } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import styles from "../styles/filterBarStyles";
import { getQuickRange } from "../utils/dateRanges";

export default function FilterBar({
  onQuickFilter = () => {},
  onRangeChange = () => {},
}) {
  const [active, setActive] = useState("today");

  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [rangeFrom, setRangeFrom] = useState(null);
  const [rangeTo, setRangeTo] = useState(null);

  const quickButtons = [
    { id: "today", label: "Hoy" },
    { id: "yesterday", label: "Ayer" },
    { id: "week", label: "Semana" },
    { id: "month", label: "Mes" },
    { id: "year", label: "Año" },
  ];

  const applyQuick = (id) => {
    setActive(id);
    const { from, to } = getQuickRange(id);
    setRangeFrom(from);
    setRangeTo(to);
    onQuickFilter(id);
  };

  const applyRange = (from, to) => {
    setActive(null);
    setRangeFrom(from);
    setRangeTo(to);
    onRangeChange(from, to);
  };

  return (
    <View style={styles.container}>

      {/* Quick Filter Pills */}
      <View style={styles.pillsRow}>
        {quickButtons.map((b) => (
          <TouchableOpacity
            key={b.id}
            style={[
              styles.pill,
              active === b.id && styles.pillActive,
            ]}
            onPress={() => applyQuick(b.id)}
          >
            <Text
              style={[
                styles.pillLabel,
                active === b.id && styles.pillLabelActive,
              ]}
            >
              {b.label}
            </Text>
          </TouchableOpacity>
        ))}

        {/* RANGE BUTTON */}
        <TouchableOpacity
          style={[styles.pill, active === null && styles.pillActive]}
          onPress={() => setShowFromPicker(true)}
        >
          <Text
            style={[
              styles.pillLabel,
              active === null && styles.pillLabelActive,
            ]}
          >
            Rango
          </Text>
        </TouchableOpacity>
      </View>

      {/* Display selected range */}
      {rangeFrom && rangeTo && (
        <View style={styles.rangeRow}>
          <Text style={styles.rangeText}>
            {rangeFrom.toLocaleDateString()} → {rangeTo.toLocaleDateString()}
          </Text>

          <TouchableOpacity
            onPress={() => {
              setRangeFrom(null);
              setRangeTo(null);
              setActive("today");
              applyQuick("today");
            }}
          >
            <Text style={styles.clearText}>Limpiar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* DATE PICKERS */}
      <DateTimePickerModal
        isVisible={showFromPicker}
        mode="date"
        onConfirm={(date) => {
          setShowFromPicker(false);
          setShowToPicker(true);
          setRangeFrom(date);
        }}
        onCancel={() => setShowFromPicker(false)}
      />

      <DateTimePickerModal
        isVisible={showToPicker}
        mode="date"
        onConfirm={(date) => {
          setShowToPicker(false);
          setRangeTo(date);
          applyRange(rangeFrom, date);
        }}
        onCancel={() => setShowToPicker(false)}
      />

    </View>
  );
}
