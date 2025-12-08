import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import styles from "./styles/quickPaymentStyles";
import { registerQuickSaleFull } from "./services/quickSaleService";


export default function QuickSalePaymentScreen({ navigation, route }) {
  const {
    cart = [],
    subtotal = 0,
    total: rawTotal = 0,
    discount = 0,
    customer = null,
    setCustomer = () => {},
  } = route?.params ?? {};

  // ⚠️ Aseguramos total válido siempre
  const total = Number(rawTotal) || 0;

  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [tip, setTip] = useState("");

  // 🔹 Calcular cambio
  const change = useMemo(() => {
    const paid = parseFloat(amountPaid || 0);
    const tipValue = parseFloat(tip || 0);
    const totalPay = total + tipValue;
    return Math.max(paid - totalPay, 0);
  }, [amountPaid, tip, total]);

  // 🔹 Texto dinámico del botón
  const paymentText = useMemo(() => {
    switch (paymentMethod) {
      case "cash":
        return "Pagar con Efectivo";
      case "card":
        return "Pagar con Tarjeta";
      default:
        return "Finalizar Pago";
    }
  }, [paymentMethod]);

  // 🔹 Validar y procesar pago
  const handlePay = () => {
    const paid = parseFloat(amountPaid || 0);

    if (isNaN(paid) || paid <= 0) {
      return Alert.alert("Monto inválido", "Ingresa un monto válido para pagar.");
    }

    if (paid < total) {
      Alert.alert("Pago incompleto", "El monto es menor que el total.");
      return;
    }

    const sale = {
      items: cart,
      subtotal,
      discount,
      total,
      tip: parseFloat(tip || 0),
      paymentMethod,
      amountPaid: paid,
      change,
      customer: customer ?? { name: "Venta rápida" },
      date: new Date(),
    };

    registerQuickSaleFull({
      cart,
      subtotal,
      total,
      tip,
      paymentMethod,
      amountPaid: paid,
      change,
      customer
    })
    .then((id) => {
      navigation.replace("QuickSaleDone", { saleId: id });
    })
    .catch((e) => {
      Alert.alert("Error", "No se pudo registrar la venta");
    });
  };

  return (
    <View style={styles.container}>
      {/* 🔹 HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Pago</Text>

      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* TOTAL */}
        <View style={styles.amountBox}>
          <Text style={styles.amountCurrency}>C$</Text>
          <Text style={styles.amountValue}>{total.toFixed(2)}</Text>
        </View>

        {/* SUBTOTAL / DESCUENTO (opcional mostrar) */}
        <View style={{ marginTop: 10, alignItems: "center" }}>

          {discount > 0 && (
            <Text style={{ fontSize: 16, color: "#D00", marginTop: 4 }}>
              Descuento: -C${discount.toFixed(2)}
            </Text>
          )}
        </View>

        {/* MÉTODOS DE PAGO */}
        <View style={styles.methodsGrid}>
          {[
            { key: "cash", icon: "cash-outline", label: "Efectivo" },
            { key: "card", icon: "card-outline", label: "Tarjeta" },
          ].map((m) => (
            <TouchableOpacity
              key={m.key}
              style={[
                styles.methodBox,
                paymentMethod === m.key && styles.methodBoxActive,
              ]}
              onPress={() => setPaymentMethod(m.key)}
            >
              <Icon
                name={m.icon}
                size={26}
                color={paymentMethod === m.key ? "#007AFF" : "#333"}
              />
              <Text
                style={[
                  styles.methodText,
                  paymentMethod === m.key && styles.methodTextActive,
                ]}
              >
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* INGRESAR MONTO */}
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

        {/* CAMBIO */}
        {change > 0 && (
          <View style={styles.changeBox}>
            <Text style={styles.changeLabel}>Cambio:</Text>
            <Text style={styles.changeValue}>
              C${change.toFixed(2)}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* BOTÓN DE PAGO */}
      <TouchableOpacity
        style={styles.payButton}
        onPress={handlePay}
        activeOpacity={0.8}
      >
        <Text style={styles.payButtonText}>{paymentText}</Text>
      </TouchableOpacity>
    </View>
  );
}
