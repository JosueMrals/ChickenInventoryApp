import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import styles from '../styles/quickPaymentSelectorStyles';

export default function QuickPaymentSelector({
  paymentMethod,
  setPaymentMethod,
  paidAmount,
  setPaidAmount,
  transferNumber,
  setTransferNumber,
  discountPercent,
  setDiscountPercent,
  total,
}) {
  const methods = [
    { key: 'cash', label: 'Efectivo', icon: 'cash-outline', color: '#34A853' },
    { key: 'transfer', label: 'Transferencia', icon: 'swap-horizontal', color: '#4285F4' },
    { key: 'card', label: 'Tarjeta', icon: 'card-outline', color: '#F4B400' },
  ];

  const paid = parseFloat(paidAmount || 0);
  const discountAmt = +(total * (discountPercent / 100)).toFixed(2);
  const finalTotal = +(total - discountAmt).toFixed(2);
  const pending = Math.max(finalTotal - paid, 0);

  return (
    <View style={{ marginTop: 10 }}>
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

      <Text style={styles.sectionTitle}>Método de Pago</Text>
      <View style={styles.methodsRow}>
        {methods.map((m) => (
          <TouchableOpacity
            key={m.key}
            onPress={() => setPaymentMethod(m.key)}
            style={[
              styles.methodBtn,
              paymentMethod === m.key && { backgroundColor: m.color },
            ]}
          >
            <Ionicons name={m.icon} size={20} color={paymentMethod === m.key ? '#fff' : '#444'} />
            <Text style={[
              styles.methodLabel,
              paymentMethod === m.key && { color: '#fff' },
            ]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {paymentMethod === 'transfer' && (
        <TextInput
          style={styles.input}
          placeholder="Número de transferencia"
          value={transferNumber}
          onChangeText={setTransferNumber}
        />
      )}

      <Text style={styles.sectionTitle}>Monto Pagado</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={paidAmount}
        onChangeText={setPaidAmount}
        placeholder="0.00"
      />

      <View style={styles.totalBox}>
        <Text style={styles.totalRow}>Total: C${finalTotal.toFixed(2)}</Text>
        <Text style={[
          styles.pendingRow,
          pending > 0 && { color: '#EA4335' },
        ]}>
          Pendiente: C${pending.toFixed(2)}
        </Text>
      </View>
    </View>
  );
}
