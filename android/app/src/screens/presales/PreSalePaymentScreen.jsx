import React, { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, TextInput, Alert, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import styles from "../quicksalesNew/styles/quickPaymentStyles"; // Reusing styles
import { convertPreSaleToSale } from "../../services/preSaleService";
import { createCreditFromPreSale } from "../credits/services/creditsService";
import CreditDueDatePicker from "./components/CreditDueDatePicker";
import { toDateSafe, computeCreditDueDate, getEffectiveCreditLimit } from "../../utils/creditUtils";
import { useCreditExposure } from "../../hooks/useCreditExposure";
import { useSubmitLock } from "../../hooks/useSubmitLock";
import { formatCurrency } from "../../utils/formatMoney";

export default function PreSalePaymentScreen({ navigation, route }) {
  const { presale } = route.params;
  const total = Number(presale?.total) || 0;

  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState("");
  // Ya no la elige el vendedor: si la preventa no traía una fecha acordada
  // (era contado), se calcula del plazo configurado por el admin en el cliente.
  const [creditDueDate] = useState(
    () => toDateSafe(presale?.creditDueDate) || computeCreditDueDate(presale?.customer)
  );
  // Cerrojo por ref: `disabled` solo aplica tras el re-render y dos toques
  // rápidos alcanzaban a cobrar dos veces la misma preventa.
  const { submitting: loading, runLocked } = useSubmitLock();

  // Esta pantalla convertía una preventa entregada a crédito SIN chequear la
  // exposición acumulada del cliente (a diferencia del carrito y su edición,
  // que ya usan este hook): un cobro aquí podía superar el límite sin aviso.
  const effectiveCredit = getEffectiveCreditLimit(presale?.customer);
  const customerCreditLimit = effectiveCredit.total;
  const canUseCredit = customerCreditLimit > 0;
  const creditExposure = useCreditExposure(presale?.customer, total);

  const change = useMemo(() => {
    const paid = parseFloat(amountPaid || 0);
    return Math.max(paid - total, 0);
  }, [amountPaid, total]);

  const handlePay = async () => {
    if (paymentMethod === 'credit') {
      if (!canUseCredit) {
        return Alert.alert("Crédito no disponible", "Este cliente no tiene crédito habilitado.");
      }
      // Mientras la consulta esté en vuelo no se sabe si el saldo es 0 o si no
      // se pudo leer: confirmar aquí se saltaría el tope acumulado.
      if (creditExposure.loading) {
        return Alert.alert(
          "Verificando saldo",
          "Estamos consultando la deuda del cliente. Intenta de nuevo en un momento."
        );
      }
      if (creditExposure.exceeded) {
        return Alert.alert(
          "Crédito insuficiente",
          creditExposure.verified
            ? `Este cliente ya debe ${formatCurrency(creditExposure.outstanding)} y su límite es ${formatCurrency(customerCreditLimit)}.\n\nCon esta venta de ${formatCurrency(total)} lo superaría.`
            : `El crédito permitido es ${formatCurrency(customerCreditLimit)} y el total es ${formatCurrency(total)}.`
        );
      }
      if (!creditDueDate) {
        return Alert.alert(
          "No se pudo calcular la fecha de pago",
          "Revisa el plazo de crédito configurado para este cliente."
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
          {["cash", "card", "credit"].map((m) => {
            const disabled = m === 'credit' && !canUseCredit;
            return (
              <TouchableOpacity
                key={m}
                style={[styles.methodBox, paymentMethod === m && styles.methodBoxActive, disabled && localStyles.methodBoxDisabled]}
                onPress={() => setPaymentMethod(m)}
                disabled={disabled}
              >
                <Icon name={m === 'cash' ? 'cash-outline' : m === 'card' ? 'card-outline' : 'cash-outline'} size={26} color={disabled ? "#C7C7CC" : (paymentMethod === m ? "#007AFF" : "#333")} />
                <Text style={[styles.methodText, paymentMethod === m && styles.methodTextActive, disabled && { color: "#C7C7CC" }]}>
                  {m === 'cash' ? 'Efectivo' : m === 'card' ? 'Tarjeta' : 'Crédito'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {paymentMethod === 'credit' && (
          <View style={{ paddingHorizontal: 16 }}>
            <Text style={localStyles.creditHint}>
              Límite: {formatCurrency(customerCreditLimit)}
              {effectiveCredit.extra > 0 ? ` (incluye sobregiro ${formatCurrency(effectiveCredit.extra)})` : ''}
              {creditExposure.verified && creditExposure.outstanding > 0
                ? `${' · '}Ya debe: ${formatCurrency(creditExposure.outstanding)}`
                : ''}
              {' · '}Disponible: {formatCurrency(creditExposure.available)}
            </Text>
            {creditExposure.exceeded && (
              <Text style={localStyles.creditWarning}>
                {creditExposure.verified
                  ? 'Con su deuda actual, esta venta supera el límite permitido.'
                  : 'El total supera el límite permitido.'}
              </Text>
            )}
            {!creditExposure.verified && !creditExposure.loading && (
              <Text style={localStyles.creditWarning}>
                Sin conexión: no se pudo verificar la deuda actual del cliente.
              </Text>
            )}
            <CreditDueDatePicker customer={presale?.customer} dueDate={creditDueDate} />
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

const localStyles = StyleSheet.create({
  methodBoxDisabled: { opacity: 0.5 },
  creditHint: { fontSize: 11, color: '#6B7280', marginTop: 2, marginBottom: 4 },
  creditWarning: { fontSize: 11, color: '#C0392B', marginTop: 2, marginBottom: 4, fontWeight: '600' },
});