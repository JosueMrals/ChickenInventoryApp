import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import styles from '../styles/paymentSelectorStyles';

export default function PaymentSelector({
  paymentMethod,
  setPaymentMethod,
  paidAmount,
  setPaidAmount,
  transferNumber,
  setTransferNumber,
  saleDiscount,
  setSaleDiscount,
  total,
  customer,
}) {
  const methods = [
    { key: 'cash', label: 'Efectivo', icon: 'cash-outline', color: '#34A853' },
    { key: 'transfer', label: 'Transferencia', icon: 'swap-horizontal', color: '#4285F4' },
    { key: 'card', label: 'Tarjeta', icon: 'card-outline', color: '#F4B400' },
    { key: 'credit', label: 'Crédito', icon: 'time-outline', color: '#EA4335' },
  ];

  const paid = parseFloat(paidAmount || 0);
  const discount = parseFloat(saleDiscount || 0);
  const discountAmount = +(total * (discount / 100)).toFixed(2);
  const finalTotal = +(total - discountAmount).toFixed(2);
  const pending = Math.max(finalTotal - paid, 0);

  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.sectionTitle}>Descuento por Venta</Text>

      <TextInput
        placeholder="% descuento"
        keyboardType="numeric"
        value={saleDiscount}
        onChangeText={setSaleDiscount}
        style={styles.input}
      />

      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Método de Pago</Text>

      <View style={styles.paymentRow}>
        {methods.map((m) => (
          <TouchableOpacity
            key={m.key}
            onPress={() => setPaymentMethod(m.key)}
            style={[
              styles.paymentBtn,
              paymentMethod === m.key && { backgroundColor: m.color },
            ]}
          >
            <Ionicons
              name={m.icon}
              size={22}
              color={paymentMethod === m.key ? '#fff' : '#555'}
            />
            <Text
              style={[
                styles.paymentLabel,
                paymentMethod === m.key && { color: '#fff' },
              ]}
            >
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {paymentMethod === 'transfer' && (
        <TextInput
          placeholder="Número de transferencia"
          value={transferNumber}
          onChangeText={setTransferNumber}
          style={styles.input}
        />
      )}

      {paymentMethod !== 'credit' && (
        <>
          <Text style={styles.label}>Monto pagado</Text>
          <TextInput
            placeholder="0.00"
            keyboardType="numeric"
            value={paidAmount}
            onChangeText={setPaidAmount}
            style={styles.input}
          />
        </>
      )}

      {customer && paymentMethod === 'credit' && (
        <View style={styles.creditBox}>
          <Text style={styles.creditText}>
            Límite disponible:{' '}
            <Text style={{ fontWeight: '700' }}>
              C${(customer.creditLimit - (customer.currentCredit || 0)).toFixed(2)}
            </Text>
          </Text>
        </View>
      )}

      <View style={styles.totalBox}>
        <Text style={styles.totalText}>
          Total: <Text style={{ fontWeight: '700' }}>C${finalTotal.toFixed(2)}</Text>
        </Text>

        <Text
          style={[
            styles.pendingText,
            pending > 0 && { color: '#EA4335' },
          ]}
        >
          Pendiente: C${pending.toFixed(2)}
        </Text>
      </View>
    </View>
  );
}
