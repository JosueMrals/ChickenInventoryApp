import React from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import styles from "../../styles/productFormStyles";

export default function ProductPricingSection({
  isAdmin,
  purchasePrice,
  setPurchasePrice,
  profitMargin,
  setProfitMargin,
  salePrice,
  setSalePrice,
  autoSalePrice,
  setAutoSalePrice,
}) {
  return (
    <>
      <Text style={styles.label}>Precio de compra (Costo)</Text>
      <TextInput
        editable={isAdmin}
        keyboardType="numeric"
        value={purchasePrice}
        onChangeText={setPurchasePrice}
        style={styles.input}
      />

      <Text style={styles.label}>Margen de ganancia (%)</Text>
      <TextInput
        editable={isAdmin}
        keyboardType="numeric"
        value={profitMargin}
        onChangeText={setProfitMargin}
        style={styles.input}
      />

      <View style={styles.measureRow}>
        <TouchableOpacity
          style={[styles.measureBtn, autoSalePrice && styles.measureActive]}
          onPress={() => setAutoSalePrice(true)}
        >
          <Text>Automático</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.measureBtn, !autoSalePrice && styles.measureActive]}
          onPress={() => setAutoSalePrice(false)}
        >
          <Text>Manual</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Precio de venta</Text>
      <TextInput
        editable={isAdmin && !autoSalePrice}
        keyboardType="numeric"
        value={salePrice}
        onChangeText={setSalePrice}
        style={[styles.input, autoSalePrice && { opacity: 0.5 }]}
      />
    </>
  );
}
