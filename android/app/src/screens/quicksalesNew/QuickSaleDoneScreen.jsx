import React, { useEffect, useState, useContext } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import firestore from "@react-native-firebase/firestore";
import styles from "./styles/doneReceiptStyles";
import SaleReceipt from "../../screens/sales/components/SaleReceipt";

import { QuickSaleContext } from "./context/quickSaleContext";

export default function QuickSaleDoneScreen({ navigation, route }) {

  const { resetQuickSale } = useContext(QuickSaleContext);
  const { saleId } = route.params;

  const [sale, setSale] = useState(null);
  const [bonuses, setBonuses] = useState([]); // State for bonus items
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!saleId) return;

    // 1. Fetch the main sale document
    const unsubSale = firestore()
      .collection("sales")
      .doc(saleId)
      .onSnapshot((snap) => {
        if (snap.exists) {
          setSale({ id: snap.id, ...snap.data() });
        }
        setLoading(false);
      });

    // 2. Fetch associated bonus items
    const unsubBonuses = firestore()
      .collection("inventoryMovements")
      .where("relatedSaleId", "==", saleId)
      .where("type", "==", "BONUS_OUT")
      .onSnapshot((querySnap) => {
        const bonusItems = querySnap.docs.map(doc => doc.data());
        setBonuses(bonusItems);
      });

    // Cleanup subscriptions on unmount
    return () => {
      unsubSale();
      unsubBonuses();
    };
  }, [saleId]);

  if (loading) {
    return (
      <View style={localStyles.loadingBox}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={localStyles.loadingText}>Cargando recibo...</Text>
      </View>
    );
  }

  if (!sale) {
    return (
      <View style={localStyles.loadingBox}>
        <Text style={localStyles.loadingText}>No se encontró la venta.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Venta Completada</Text>
      </View>

      {/* Pass both sale and bonuses to the receipt component */}
      <SaleReceipt sale={sale} bonuses={bonuses} />

      <TouchableOpacity style={styles.shareButton}>
        <Icon name="print-outline" size={20} color="#fff" />
        <Text style={styles.shareText}>Imprimir / Compartir</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.newSaleButton}
        onPress={() => {
          resetQuickSale();
          navigation.reset({
            index: 0,
            routes: [{ name: "QuickSaleProducts" }],
          });
        }}
      >
        <Text style={styles.newSaleText}>Nueva Venta</Text>
      </TouchableOpacity>
    </View>
  );
}

// Local styles for loading/error states to avoid breaking doneReceiptStyles
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