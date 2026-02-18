import React, { useEffect, useState, useContext, useRef } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import firestore from "@react-native-firebase/firestore";
import SaleReceipt from "../../screens/sales/components/SaleReceipt"; // Reusing the receipt component
import styles from "../quicksalesNew/styles/doneReceiptStyles"; // Reusing styles
import { PreSaleContext } from "./context/preSaleContext";
import ViewShot from "react-native-view-shot";
import { printPngImageFromBase64 } from "../settings/printers/services/printerService";

export default function PreSaleDoneScreen({ navigation, route }) {
  const { loadPreSales } = useContext(PreSaleContext);
  const { saleId } = route.params;

  const [sale, setSale] = useState(null);
  const [bonuses, setBonuses] = useState([]); // State for bonus items
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const viewShotRef = useRef();

  useEffect(() => {
    if (!saleId) return;

    // 1. Fetch the main sale document
    const unsubSale = firestore().collection("sales").doc(saleId).onSnapshot((snap) => {
      if (snap.exists) {
        setSale({ id: snap.id, ...snap.data() });
      }
      setLoading(false);
    });

    // 2. Fetch associated bonus items using the saleId
    const unsubBonuses = firestore()
      .collection("inventoryMovements")
      .where("relatedSaleId", "==", saleId)
      .where("type", "==", "BONUS_OUT")
      .onSnapshot((querySnap) => {
        const bonusItems = querySnap.docs.map(doc => doc.data());
        setBonuses(bonusItems);
      });

    return () => {
      unsubSale();
      unsubBonuses();
    };
  }, [saleId]);

  if (loading || !sale) {
    return (
      <View style={localStyles.loadingBox}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={localStyles.loadingText}>Cargando Recibo...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pre-Venta Pagada</Text>
      </View>

      {/* --- FIX: Pass both sale and bonuses to the receipt component --- */}
      <ViewShot
        ref={viewShotRef}
        options={{ format: "png", quality: 1, result: "base64" }}
        style={{ backgroundColor: "#fff" }}
      >
        <SaleReceipt sale={sale} bonuses={bonuses} />
      </ViewShot>

      <TouchableOpacity
        style={styles.shareButton}
        disabled={printing}
        onPress={async () => {
          if (printing) return;
          try {
            setPrinting(true);
            const base64 = await viewShotRef.current.capture();
            await printPngImageFromBase64(base64, { threshold: 170, mode: "escstar" });
          } catch (e) {
            console.error("[PRESALE] Error al imprimir:", e);
            Alert.alert("Error de Impresion", e.message || "Verifique la conexion con la impresora");
          } finally {
            setPrinting(false);
          }
        }}
      >
        <Icon name="print-outline" size={20} color="#fff" />
        <Text style={styles.shareText}>Imprimir / Compartir</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.newSaleButton}
        onPress={() => {
          loadPreSales();
          navigation.reset({
            index: 0,
            routes: [{ name: "PreSalesList" }],
          });
        }}
      >
        <Text style={styles.newSaleText}>Volver a Pre-Ventas</Text>
      </TouchableOpacity>
    </View>
  );
}

const localStyles = StyleSheet.create({
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F8FA'
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666'
  }
});