import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, TextInput } from "react-native";
import styles from "../../styles/QuickSaleDiscountStyles";

export default function DiscountModal({ visible, onClose, product, onApply }) {
  const [type, setType] = useState(product.discountType ?? "none");
  const [value, setValue] = useState(product.discountValue?.toString() ?? "");

  const apply = () => {
    onApply({
      discountType: type,
      discountValue: parseFloat(value) || 0,
    });
    onClose();
  };

  return (
    <Modal animationType="slide" transparent visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.box}>

          <Text style={styles.title}>Discount for {product.name}</Text>

          <View style={styles.row}>
            {["none", "percent", "amount"].map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setType(t)}
                style={[
                  styles.typeButton,
                  type === t && styles.typeSelected
                ]}
              >
                <Text style={styles.typeText}>
                  {t === "none" ? "No Discount" :
                   t === "percent" ? "% Percent" :
                   "Amount (C$)"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {type !== "none" && (
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="Enter value"
              value={value}
              onChangeText={setValue}
            />
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnCancel} onPress={onClose}>
              <Text style={styles.btnCancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnApply} onPress={apply}>
              <Text style={styles.btnApplyText}>Apply</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}
