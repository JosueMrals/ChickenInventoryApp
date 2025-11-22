import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal } from "react-native";
import styles from "../../styles/productFormStyles";
import { addStockToProduct } from "../../services/productService";

export default function ProductStockSection({ isAdmin, stock, setStock, product, onClose }) {
  const [input, setInput] = useState("");
  const [modal, setModal] = useState(false);

  const handleAdd = async () => {
    if (!input.trim()) return;

    await addStockToProduct(product.id, parseFloat(input));
    setInput("");
    setModal(false);
    onClose();
  };

  return (
    <>
      <Text style={styles.label}>Stock actual: {stock}</Text>

      {isAdmin && (
        <TouchableOpacity style={styles.stockBtn} onPress={() => setModal(true)}>
          <Text style={styles.stockText}>➕ Ingresar al inventario</Text>
        </TouchableOpacity>
      )}

      <Modal visible={modal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.stockModalBox}>
            <Text style={styles.title}>Ingreso de productos</Text>

            <TextInput
              keyboardType="numeric"
              value={input}
              onChangeText={setInput}
              style={styles.input}
              placeholder="Cantidad"
            />

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModal(false)}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveBtn} onPress={handleAdd}>
                <Text style={styles.saveText}>Ingresar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
