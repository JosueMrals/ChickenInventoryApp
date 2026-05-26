import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Linking,
  AppState,
  ScrollView,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import styles from "./styles/printerStyles";
import globalStyles from "../../../styles/globalStyles";
import {
  savePrinter,
  loadPrinter,
  printTest,
  printTicket,
  getSavedPrintersList,
  addSavedPrinter,
  removeSavedPrinter,
  updatePrinterName,
} from "./services/printerService";
import { requestBluetoothPermissions } from "./utils/requestBluetoothPermissions";
import { getBondedDevices } from "../../../helpers/getBondedDevices";
import EditPrinterNameModal from "./EditPrinterNameModal";
import PrinterTestModal from "./PrinterTestModal"; // Use simpler modal

export default function PrintersScreen({ navigation }) {
  const [bondedDevices, setBondedDevices] = useState([]);
  const [savedPrinters, setSavedPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [loading, setLoading] = useState(false);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [printerToEdit, setPrinterToEdit] = useState(null);

  // Test State
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  useEffect(() => {
    init();

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        scan();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const init = async () => {
    const ok = await requestBluetoothPermissions();
    if (!ok) return Alert.alert("Permiso requerido", "Debe aceptar permisos Bluetooth.");

    await refreshSavedPrinters();
    const saved = await loadPrinter();
    if (saved) setSelectedPrinter(saved);

    scan();
  };

  const refreshSavedPrinters = async () => {
    const list = await getSavedPrintersList();
    setSavedPrinters(list);
  };

  const scan = async () => {
    setLoading(true);

    try {
      const list = await getBondedDevices();
      console.log("Bonded List:", list);
      setBondedDevices(list || []);
    } catch (error) {
      console.error("Scan error:", error);
      Alert.alert("Error de Bluetooth", "No se pudieron obtener los dispositivos vinculados: " + error.message);
      setBondedDevices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPrinter = async (dev) => {
    const newList = await addSavedPrinter(dev);
    setSavedPrinters(newList);
    // Auto select on add if it's the first one? Maybe not.
  };

  const handleDeletePrinter = async (dev) => {
    Alert.alert(
      "Eliminar Impresora",
      `¿Desea eliminar la impresora "${dev.customName || dev.name}" de la lista?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
             const newList = await removeSavedPrinter(dev.address);
             setSavedPrinters(newList);
             if (selectedPrinter?.address === dev.address) {
               setSelectedPrinter(null);
             }
          }
        },
      ]
    );
  };

  const handleEditPrinter = (dev) => {
    setPrinterToEdit(dev);
    setIsEditing(true);
  };

  const saveEditName = async (newName) => {
    if (!printerToEdit) return;
    const finalName = newName.trim() || printerToEdit.name;
    const newList = await updatePrinterName(printerToEdit.address, finalName);

    setSavedPrinters(newList);

    // Si editamos la seleccionada, actualizar estado local
    if (selectedPrinter?.address === printerToEdit.address) {
       setSelectedPrinter({ ...selectedPrinter, customName: finalName });
    }

    setIsEditing(false);
    setPrinterToEdit(null);
  };

  const selectPrinter = async (dev) => {
    try {
        setSelectedPrinter(dev);
        await savePrinter(dev);
        // Alert.alert("Seleccionada", dev.customName || dev.name);
    } catch (e) {
        console.error(e);
    }
  };

  const openBluetoothSettings = () => {
    Linking.sendIntent("android.settings.BLUETOOTH_SETTINGS");
  };

  const testPrint = async () => {
    if (!selectedPrinter) return Alert.alert("Seleccione una impresora.");
    setIsTestModalOpen(true);
  };

  const handleTestOption = async (type) => {
      if (!selectedPrinter) {
          Alert.alert("Error", "Seleccione una impresora primero");
          return;
      }

      try {
          setLoading(true);
          console.log(`[TEST] Iniciando prueba tipo: ${type} en impresora: ${selectedPrinter.name}`);

          await printTest(selectedPrinter, type);

          if (type !== "feed") {
            Alert.alert("Enviado", "Prueba de imagen enviada.");
          }

          setIsTestModalOpen(false);

      } catch (e) {
          console.error("[TEST] Error fatal:", e);
          Alert.alert("Error", "Verifique conexión o papel. \n" + (e.message || ""));
      } finally {
          setLoading(false);
      }
  };

  // Filtrar dispositivos bonded que NO están en saved
  const availableDevices = bondedDevices.filter(
      d => !savedPrinters.some(s => s.address === d.address)
  );

  return (
    <View style={styles.container}>

      <View style={globalStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={globalStyles.title}>Impresoras</Text>
        <TouchableOpacity onPress={() => { scan(); refreshSavedPrinters(); }}>
          <Icon name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.settingsBtn} onPress={openBluetoothSettings}>
        <Icon name="bluetooth" size={20} color="#fff" />
        <Text style={styles.settingsText}>Vincular nueva impresora</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>

         {/* SECCION: IMPRESORA ACTIVA */}
         {selectedPrinter && (
            <View style={styles.selectedBox}>
              <View style={styles.rowBetween}>
                <View>
                    <Text style={styles.selectedLabel}>IMPRESORA ACTIVA</Text>
                    <Text style={styles.selectedName}>{selectedPrinter.customName || selectedPrinter.name}</Text>
                    <Text style={styles.selectedAddress}>{selectedPrinter.address}</Text>
                </View>
                <TouchableOpacity onPress={testPrint} style={{ alignItems: 'center' }}>
                    <Icon name="print" size={28} color="#007AFF" />
                    <Text style={{ fontSize: 10, color: "#007AFF" }}>Probar</Text>
                </TouchableOpacity>
              </View>
            </View>
         )}

         {/* SECCION: MIS IMPRESORAS */}
         <Text style={styles.subTitle}>Mis Impresoras ({savedPrinters.length})</Text>
         {savedPrinters.length === 0 ? (
             <Text style={styles.noPrinter}>No tienes impresoras guardadas.</Text>
         ) : (
             savedPrinters.map((item) => (
                <TouchableOpacity
                  key={item.address}
                  style={[
                      styles.deviceCard,
                      selectedPrinter?.address === item.address && { borderColor: '#007AFF', borderWidth: 1 }
                  ]}
                  onPress={() => selectPrinter(item)}
                >
                  <Icon name="print-outline" size={24} color="#007AFF" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deviceName}>{item.customName || item.name}</Text>
                    <Text style={styles.selectedAddress}>{item.address}</Text>
                  </View>

                  <View style={styles.rowActions}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => handleEditPrinter(item)}>
                        <Icon name="pencil" size={20} color="#666" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => handleDeletePrinter(item)}>
                        <Icon name="trash-outline" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
             ))
         )}

         <View style={{ height: 20 }} />

         {/* SECCION: DISPONIBLES */}
         <Text style={styles.subTitle}>Disponibles para agregar ({availableDevices.length})</Text>
         {loading ? (
           <ActivityIndicator size="small" color="#007AFF" style={{ marginTop: 10 }} />
         ) : availableDevices.length === 0 ? (
           <Text style={styles.noPrinter}>No hay otros dispositivos Bluetooth.</Text>
         ) : (
           availableDevices.map((item) => (
             <View key={item.address} style={styles.deviceCard}>
                <Icon name="bluetooth" size={24} color="#999" />
                <View style={{ flex: 1 }}>
                    <Text style={styles.deviceName}>{item.name}</Text>
                    <Text style={styles.selectedAddress}>{item.address}</Text>
                </View>
                <TouchableOpacity onPress={() => handleAddPrinter(item)}>
                    <Icon name="add-circle" size={28} color="#34C759" />
                </TouchableOpacity>
             </View>
           ))
         )}

      </ScrollView>

      {/* Modal Editar */}
      <EditPrinterNameModal
        visible={isEditing}
        currentName={printerToEdit?.customName || printerToEdit?.name}
        onClose={() => setIsEditing(false)}
        onSave={saveEditName}
      />

      <PrinterTestModal
        visible={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        onTest={handleTestOption}
      />

    </View>
  );
}
