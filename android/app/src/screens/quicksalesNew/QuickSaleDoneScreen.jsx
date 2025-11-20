import React, { useEffect, useState, useContext } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import firestore from "@react-native-firebase/firestore";
import styles from "./styles/doneReceiptStyles";

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

  const paymentLabels = {
    cash: "Efectivo",
    card: "Tarjeta",
  };

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pago Listo</Text>
      </View>

      <ScrollView style={styles.receiptBox} showsVerticalScrollIndicator={false}>

        <Text style={styles.bigCheck}>✓</Text>
        <Text style={styles.successText}>Venta completada</Text>

        {/* FECHA */}
        <View style={styles.section}>
          <Text style={styles.label}>Fecha:</Text>
          <Text style={styles.value}>
            {sale.createdAt.toDate().toLocaleString()}
          </Text>
        </View>

        {/* CLIENTE */}
        <View style={styles.section}>
          <Text style={styles.label}>Cliente:</Text>
          <Text style={styles.value}>{sale.customerName}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Recibo #:</Text>
          <Text style={styles.value}>{sale.receiptNumber}</Text>
        </View>

        <View style={styles.separator} />

        {/* PRODUCTOS */}
        <Text style={styles.sectionTitle}>Productos</Text>

        {sale.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemDetails}>
                {item.quantity} x C${item.unitPrice.toFixed(2)}
              </Text>
            </View>

            <Text style={styles.itemTotal}>
              C${item.total.toFixed(2)}
            </Text>
          </View>
        ))}

        <View style={styles.separator} />

        {/* RESUMEN */}
        <View style={styles.summaryRow}>
          <Text style={styles.label}>Subtotal</Text>
          <Text style={styles.value}>C${sale.subtotal.toFixed(2)}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>C${sale.total.toFixed(2)}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.label}>Pagado</Text>
          <Text style={styles.value}>C${sale.amountPaid.toFixed(2)}</Text>
        </View>

        {sale.change > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.label}>Cambio</Text>
            <Text style={styles.value}>C${sale.change.toFixed(2)}</Text>
          </View>
        )}

        <View style={styles.summaryRow}>
          <Text style={styles.label}>Método de pago</Text>
          <Text style={styles.value}>{paymentLabels[sale.paymentMethod]}</Text>
        </View>

        <View style={styles.separator} />

        <Text style={styles.footerText}>¡Gracias por su compra!</Text>
      </ScrollView>

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
