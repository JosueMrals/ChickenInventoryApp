import React from "react";
import { View, Text, TouchableOpacity, Modal } from "react-native";
import styles from "./styles/printerStyles";

export default function PrinterTestModal({ visible, onClose, onTest }) {
  return (
    <Modal visible={visible} transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>Probar Impresión</Text>

          <TouchableOpacity style={styles.testButton} onPress={onTest}>
            <Text style={styles.testText}>Imprimir Ticket de Prueba</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
