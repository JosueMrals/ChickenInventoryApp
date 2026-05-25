import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import styles from "../../styles/numericKeyboardStyles";

export default function NumericKeyboard({ value = "0", onChange, onSubmit, infoComponent }) {
  const keys = [
    "1", "2", "3",
    "4", "5", "6",
    "7", "8", "9",
    ".", "0", "⌫"
  ];

  const press = (key) => {
    if (key === "ok") {
      onSubmit && onSubmit();
      return;
    }

    if (key === "⌫") {
      if (!value || value === "0") return;
      const next = value.slice(0, -1);
      onChange(next === "" ? "" : next);
      return;
    }

    if (key === ".") {
      if (value.includes(".")) return;
      onChange((value || "0") + ".");
      return;
    }

    if (value === "0") {
      if (key === "0") return;
      onChange(key);
      return;
    }

    onChange(value + key);
  };

  return (
    <View>
      {infoComponent && (
        <View style={{ marginBottom: 6 }}>
          {infoComponent}
        </View>
      )}
      <View style={styles.container}>
        {keys.map((k) => (
          <View key={k} style={styles.keyWrapper}>
            <TouchableOpacity
              style={[styles.key, k === "ok" && styles.keyConfirm]}
              onPress={() => press(k)}
              activeOpacity={0.7}
            >
              {k === "⌫" ? (
                <Icon name="backspace-outline" size={22} color="#DC2626" />
              ) : (
                <Text style={styles.keyText}>{k}</Text>
              )}
            </TouchableOpacity>
          </View>
        ))}
        {/* Fila final: vacío · 00 · OK */}
        <View style={[styles.keyWrapper, { opacity: 0 }]} pointerEvents="none" />
        <View style={styles.keyWrapper}>
          <TouchableOpacity
            style={styles.key}
            onPress={() => {
              if (!value || value === "0") return;
              onChange(value + "00");
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.keyText}>00</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.keyWrapper}>
          <TouchableOpacity
            style={[styles.key, styles.keyConfirm]}
            onPress={() => onSubmit && onSubmit()}
            activeOpacity={0.7}
          >
            <Icon name="checkmark" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
