import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import styles from '../styles/saleModalStyles';

export default function PaymentSelector({ form, setForm, subtotal, discount, total }) {
  const methods = [
    { key: 'cash', label: 'Efectivo', icon: 'cash-outline', color: '#34A853' },
    { key: 'transfer', label: 'Transferencia', icon: 'swap-horizontal', color: '#4285F4' },
    { key: 'card', label: 'Tarjeta', icon: 'card-outline', color: '#F4B400' },
    { key: 'credit', label: 'Crédito', icon: 'time-outline', color: '#EA4335' },
  ];

  return (
    <View style={{ marginTop: 8 }}>
      <Text style={styles.sectionTitle}>Descuento</Text>
      <View style={styles.discountRow}>
        {['none', 'percent', 'amount'].map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setForm({ ...form, discountType: t })}
            style={[
              styles.discountBtn,
              {
                backgroundColor: form.discountType === t ? '#007AFF' : '#E0E0E0',
              },
            ]}
          >
            <Text
              style={{
                color: form.discountType === t ? '#fff' : '#333',
                fontWeight: '600',
              }}
            >
              {t === 'none' ? 'Sin Desc.' : t === 'percent' ? '% Descuento' : '$ Descuento'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {form.discountType !== 'none' && (
        <TextInput
          placeholder="Valor descuento"
          keyboardType="numeric"
          value={form.discountValue}
          onChangeText={(t) => setForm({ ...form, discountValue: t })}
          style={styles.input}
        />
      )}

      <Text style={styles.sectionTitle}>Método de pago</Text>
      <View style={styles.paymentRow}>
        {methods.map((m) => (
          <TouchableOpacity
            key={m.key}
            onPress={() => setForm({ ...form, paymentMethod: m.key })}
            style={[
              styles.paymentBtn,
              {
                backgroundColor:
                  form.paymentMethod === m.key ? m.color : '#E0E0E0',
              },
            ]}
          >
            <Ionicons
              name={m.icon}
              size={22}
              color={form.paymentMethod === m.key ? '#fff' : '#555'}
            />
            <Text
              style={{
                color: form.paymentMethod === m.key ? '#fff' : '#333',
                fontWeight: '600',
                fontSize: 12,
              }}
            >
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {form.paymentMethod === 'transfer' && (
        <TextInput
          placeholder="Número de transferencia"
          value={form.transferNumber}
          onChangeText={(t) => setForm({ ...form, transferNumber: t })}
          style={styles.input}
        />
      )}

      <TextInput
        placeholder="Monto pagado"
        keyboardType="numeric"
        value={form.paidAmount}
        onChangeText={(t) => setForm({ ...form, paidAmount: t })}
        style={styles.input}
      />

      {/* Totales */}
      <View style={styles.totalBox}>
        <Text style={styles.totalText}>Subtotal: ${subtotal.toFixed(2)}</Text>
        <Text style={styles.totalText}>Descuento: ${discount.toFixed(2)}</Text>
        <Text style={styles.totalMain}>Total a pagar: ${total.toFixed(2)}</Text>
      </View>
    </View>
  );
}
