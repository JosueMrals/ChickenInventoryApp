import React from "react";
import { View, Text, Modal, TouchableOpacity, ScrollView } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import styles from "./styles/printerStyles";

export default function AdvancedPrinterTestModal({
  visible,
  onClose,
  onPrintTest,
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, { width: "90%", maxHeight: "80%" }]}>
          <Text style={styles.modalTitle}>Pruebas de Impresión</Text>

          <ScrollView style={{ width: "100%" }}>

            {/* Prueba Estándar */}
            <TouchableOpacity
              style={[styles.testButton, { backgroundColor: "#007AFF" }]}
              onPress={() => onPrintTest("standard")}
            >
              <Icon name="receipt" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.saveText}>Ticket de Prueba (ESC/POS)</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 12, color: "#666", marginBottom: 16, textAlign:'center' }}>
              Usa comandos de negrita, centrado y corte.
            </Text>

            {/* Prueba Texto Plano */}
            <TouchableOpacity
              style={[styles.testButton, { backgroundColor: "#34C759" }]}
              onPress={() => onPrintTest("simple")}
            >
              <Icon name="document-text" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.saveText}>Texto Plano (Sin Comandos)</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 12, color: "#666", marginBottom: 16, textAlign:'center' }}>
              Envía solo texto ASCII simple. Útil si la impresora imprime "basura".
            </Text>

             {/* Prueba Feed */}
             <TouchableOpacity
              style={[styles.testButton, { backgroundColor: "#FF9500" }]}
              onPress={() => onPrintTest("feed")}
            >
              <Icon name="arrow-down-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.saveText}>Avance de Papel (Feed)</Text>
            </TouchableOpacity>

          </ScrollView>

          <TouchableOpacity style={[styles.closeBtn, { marginTop: 10 }]} onPress={onClose}>
            <Text style={styles.closeText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

