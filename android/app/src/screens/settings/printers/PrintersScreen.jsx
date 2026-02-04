import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import styles from "./styles/printerStyles";
import {
  savePrinter,
  loadPrinter,
  clearPrinter,
  build58mmReceipt,
} from "./services/printerService";
import { requestBluetoothPermissions } from "./utils/requestBluetoothPermissions";
import { getBondedDevices } from "../../../helpers/getBondedDevices";
import { BluetoothPrinter } from "@tillpos/react-native-bluetooth-printer";

export default function PrintersScreen() {
  const [devices, setDevices] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const ok = await requestBluetoothPermissions();
    if (!ok) return Alert.alert("Permiso requerido", "Debe aceptar permisos Bluetooth.");

    const saved = await loadPrinter();
    if (saved) setSelectedPrinter(saved);

    scan();
  };

  const scan = async () => {
    setLoading(true);

    const list = await getBondedDevices();
    console.log("EMPAREJADOS:", list);

    if (!list || list.length === 0) {
      Alert.alert("Aviso", "No se encontraron dispositivos emparejados.");
    }

    setDevices(list);
    setLoading(false);
  };

  const selectPrinter = async (dev) => {
    setSelectedPrinter(dev);
    await savePrinter(dev);
    Alert.alert("Seleccionada", dev.name);
  };

  const testPrint = async () => {
    if (!selectedPrinter) return Alert.alert("Seleccione una impresora.");

    try {
      await BluetoothPrinter.connectDevice(selectedPrinter.address);

      await BluetoothPrinter.printBill(`
      PRUEBA DE IMPRESIÓN
      -----------------------
      ${selectedPrinter.name}
      OK
      `);

      Alert.alert("Impreso", "Ticket enviado.");
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Impresoras Bluetooth</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" />
      ) : devices.length === 0 ? (
        <Text style={{ color: "#666", marginTop: 20 }}>
          No hay impresoras emparejadas.
        </Text>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(item) => item.address}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.deviceCard}
              onPress={() => selectPrinter(item)}
            >
              <Icon name="print-outline" size={24} color="#007AFF" />
              <Text style={styles.deviceName}>{item.name}</Text>

              {selectedPrinter?.address === item.address && (
                <Icon name="checkmark-circle" size={24} color="#34C759" />
              )}
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={styles.testBtn} onPress={testPrint}>
        <Icon name="print" size={20} color="#fff" />
        <Text style={styles.testText}>Imprimir prueba</Text>
      </TouchableOpacity>
    </View>
  );
}
