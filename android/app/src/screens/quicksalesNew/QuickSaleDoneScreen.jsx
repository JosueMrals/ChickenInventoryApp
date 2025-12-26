import React, { useEffect, useState, useContext } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import firestore from "@react-native-firebase/firestore";
import styles from "./styles/doneReceiptStyles";
import SaleReceipt from "../../screens/sales/components/SaleReceipt";

import { QuickSaleContext } from "./context/quickSaleContext";

export default function QuickSaleDoneScreen({ navigation, route }) {

  const { resetQuickSale } = useContext(QuickSaleContext);
  const { saleId } = route.params;

  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!saleId) return;

    const unsub = firestore()
      .collection("sales")
      .doc(saleId)
      .onSnapshot((snap) => {
        setSale({ id: snap.id, ...snap.data() });
        setLoading(false);
      });

    return unsub;
  }, [saleId]);

  if (loading || !sale) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pago Listo</Text>
      </View>

      <SaleReceipt sale={sale} />

      {/* BOTONES */}
      <TouchableOpacity style={styles.shareButton}>
        <Icon name="print-outline" size={20} color="#fff" />
        <Text style={styles.shareText}>Imprimir / Compartir ticket</Text>
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
        <Text style={styles.newSaleText}>Empezar nueva venta</Text>
      </TouchableOpacity>

    </View>
  );
}