import React from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import styles from '../styles/quickPaymentStyles';

export default function PaymentMethodSelector({
  paymentMethod,
  setPaymentMethod,
  paidAmount,
  setPaidAmount,
  discountPercent,
  setDiscountPercent,
  transferNumber,
  setTransferNumber,
}) {
  const methods = [
    { key: 'cash', label: 'Efectivo', icon: 'cash-outline' },
    { key: 'card', label: 'Tarjeta', icon: 'card-outline' },
    { key: 'transfer', label: 'Transferencia', icon: 'swap-horizontal' }
  ];

  return (
    <View>
      <Text style={styles.sectionTitle}>Descuento (%)</Text>

      <TextInput
        placeholder="0.00"
        keyboardType="numeric"
        value={discountPercent}
        onChangeText={setDiscountPercent}
        style={styles.input}
      />

      <Text style={styles.sectionTitle}>Método de Pago</Text>
      <View style={styles.methodsRow}>
        {methods.map((m) => (
          <TouchableOpacity
            key={m.key}
            onPress={() => setPaymentMethod(m.key)}
            style={[
              styles.methodBtn,
              paymentMethod === m.key && { backgroundColor: '#007AFF' }
            ]}
          >
            <Ionicons
              name={m.icon}
              size={20}
              color={paymentMethod === m.key ? '#fff' : '#555'}
            />
            <Text
              style={[
                styles.methodLabel,
                paymentMethod === m.key && { color: '#fff' }
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

      <Text style={styles.sectionTitle}>Monto Pagado</Text>
      <TextInput
        placeholder="0.00"
        keyboardType="numeric"
        value={paidAmount}
        onChangeText={setPaidAmount}
        style={styles.input}
      />
    </View>
  );
}
