import React, { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, TextInput, Alert, ScrollView, ActivityIndicator } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import styles from "../quicksalesNew/styles/quickPaymentStyles"; // Reusing styles
import { convertPreSaleToSale } from "../../services/preSaleService";

export default function PreSalePaymentScreen({ navigation, route }) {
  const { presale } = route.params;
  const total = Number(presale?.total) || 0;

  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [loading, setLoading] = useState(false);

  const change = useMemo(() => {
    const paid = parseFloat(amountPaid || 0);
    return Math.max(paid - total, 0);
  }, [amountPaid, total]);

  const handlePay = async () => {
    const paid = parseFloat(amountPaid || 0);
    if (isNaN(paid) || paid <= 0 || paid < total) {
      return Alert.alert("Monto Inválido", "El monto recibido debe ser mayor o igual al total.");
    }

    setLoading(true);
    try {
      const paymentDetails = {
        paymentMethod,
        amountPaid: paid,
        change,
      };
      
      const newSaleId = await convertPreSaleToSale(presale, paymentDetails);
      
      // --- FIX: Navigate to the new PreSaleDone screen ---
      navigation.replace("PreSaleDone", { saleId: newSaleId });

    } catch (error) {
      console.error("Failed to convert pre-sale to sale:", error);
      Alert.alert("Error", "No se pudo procesar el pago. Inténtalo de nuevo.");
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Finalizar Pre-Venta</Text>
        <View style={{width: 26}} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.amountBox}>
          <Text style={styles.amountCurrency}>$</Text>
          <Text style={styles.amountValue}>{total.toFixed(2)}</Text>
        </View>

        <View style={styles.methodsGrid}>
          {["cash", "card"].map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.methodBox, paymentMethod === m && styles.methodBoxActive]}
              onPress={() => setPaymentMethod(m)}
            >
              <Icon name={m === 'cash' ? 'cash-outline' : 'card-outline'} size={26} color={paymentMethod === m ? "#007AFF" : "#333"} />
              <Text style={[styles.methodText, paymentMethod === m && styles.methodTextActive]}>
                {m === 'cash' ? 'Efectivo' : 'Tarjeta'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.payInputBox}>
          <Text style={styles.payInputLabel}>Monto recibido</Text>
          <TextInput
            style={styles.payInput}
            keyboardType="numeric"
            placeholder="0.00"
            value={amountPaid}
            onChangeText={setAmountPaid}
          />
        </View>

        {change > 0 && (
          <View style={styles.changeBox}>
            <Text style={styles.changeLabel}>Cambio:</Text>
            <Text style={styles.changeValue}>${change.toFixed(2)}</Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.payButton, loading && { backgroundColor: '#A5A5A5' }]}
        onPress={handlePay}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.payButtonText}>Confirmar Pago</Text>}
      </TouchableOpacity>
    </View>
  );
}