import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import styles from "../../styles/numericKeyboardStyles";

export default function NumericKeyboard({ value = "0", onChange, onSubmit, infoComponent }) {
  const keys = [
    "1", "2", "3",
    "4", "5", "6",
    "7", "8", "9",
    ".", "0", "ok"
  ];

  const press = (key) => {
    if (key === "ok") {
      onSubmit && onSubmit();
      return;
    }

    if (key === ".") {
      if (value.includes(".")) return;
      return onChange(value + ".");
    }

    if (value === "0") {
      if (key === "0") return;
      return onChange(key);
    }

    onChange(value + key);
  };

  return (
    <View>
      {infoComponent && (
        <View style={{ marginBottom: 10 }}>
          {infoComponent}
        </View>
      )}
      <View style={styles.container}>
        {keys.map((k) => (
          <View key={k} style={styles.keyWrapper}>
            <TouchableOpacity
              style={[
                styles.key,
                k === "ok" && styles.keyConfirm
              ]}
              onPress={() => press(k)}
            >
              {k === "ok" ? (
                <Icon name="checkmark" size={28} color="#fff" />
              ) : (
                <Text style={styles.keyText}>{k}</Text>
              )}
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );
}
