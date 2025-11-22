import React from "react";
import { Text, View, TouchableOpacity } from "react-native";
import styles from "../../styles/productFormStyles";

export default function ProductMeasureSection({ isAdmin, measureType, setMeasureType }) {
  return (
    <>
      <Text style={styles.label}>Tipo de medida</Text>

      <View style={styles.measureRow}>
        <TouchableOpacity
          disabled={!isAdmin}
          style={[styles.measureBtn, measureType === "unit" && styles.measureActive]}
          onPress={() => setMeasureType("unit")}
        >
          <Text>Unidad</Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={!isAdmin}
          style={[styles.measureBtn, measureType === "weight" && styles.measureActive]}
          onPress={() => setMeasureType("weight")}
        >
          <Text>Peso</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}
