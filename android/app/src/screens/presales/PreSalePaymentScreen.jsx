import React, { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, TextInput, Alert, ScrollView, ActivityIndicator } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import styles from "../quicksalesNew/styles/quickPaymentStyles"; // Reusing styles
import { convertPreSaleToSale } from "../../services/preSaleService";
import { createCreditFromPreSale } from "../credits/services/creditsService";
import CreditDueDatePicker from "./components/CreditDueDatePicker";
import { toDateSafe } from "../../utils/creditUtils";
import { useSubmitLock } from "../../hooks/useSubmitLock";

export default function PreSalePaymentScreen({ navigation, route }) {
  const { presale } = route.params;
  const total = Number(presale?.total) || 0;

  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [creditDueDate, setCreditDueDate] = useState(toDateSafe(presale?.creditDueDate));
  // Cerrojo por ref: `disabled` solo aplica tras el re-render y dos toques
  // rápidos alcanzaban a cobrar dos veces la misma preventa.
  const { submitting: loading, runLocked } = useSubmitLock();

  const change = useMemo(() => {
    const paid = parseFloat(amountPaid || 0);
    return Math.max(paid - total, 0);
  }, [amountPaid, total]);

  const handlePay = async () => {
    if (paymentMethod === 'credit') {
      if (!creditDueDate) {
        return Alert.alert(
          "Fecha de pago requerida",
          "Selecciona la fecha en la que el cliente se compromete a pagar el crédito."
        );
      }
      return runLocked(async () => {
        try {
          await createCreditFromPreSale(presale, presale?.createdBy, { dueDate: creditDueDate });
          navigation.replace("PreSaleDone", { saleId: presale.id, isCredit: true });
        } catch (error) {
          console.error("Failed to create credit pre-sale:", error);
          Alert.alert("Error", "No se pudo generar el credito. Intentalo de nuevo.");
          throw error;
        }
      }, { keepLockedOnSuccess: true }).catch(() => {});
    }

    const paid = parseFloat(amountPaid || 0);
    if (isNaN(paid) || paid <= 0 || paid < total) {
      return Alert.alert("Monto Inválido", "El monto recibido debe ser mayor o igual al total.");
    }

    return runLocked(async () => {
      try {
        const newSaleId = await convertPreSaleToSale(presale, {
          paymentMethod,
          amountPaid: paid,
          change,
        });
        navigation.replace("PreSaleDone", { saleId: newSaleId });
      } catch (error) {
        console.error("Failed to convert pre-sale to sale:", error);
        Alert.alert("Error", "No se pudo procesar el pago. Inténtalo de nuevo.");
        throw error;
      }
    }, { keepLockedOnSuccess: true }).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('PreSaleDetail', { presale })}>
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
          {["cash", "card", "credit"].map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.methodBox, paymentMethod === m && styles.methodBoxActive]}
              onPress={() => setPaymentMethod(m)}
            >
              <Icon name={m === 'cash' ? 'cash-outline' : m === 'card' ? 'card-outline' : 'cash-outline'} size={26} color={paymentMethod === m ? "#007AFF" : "#333"} />
              <Text style={[styles.methodText, paymentMethod === m && styles.methodTextActive]}>
                {m === 'cash' ? 'Efectivo' : m === 'card' ? 'Tarjeta' : 'Crédito'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {paymentMethod === 'credit' && (
          <View style={{ paddingHorizontal: 16 }}>
            <CreditDueDatePicker value={creditDueDate} onChange={setCreditDueDate} />
          </View>
        )}

        {paymentMethod !== 'credit' && (
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
        )}

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