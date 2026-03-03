import React from 'react';
import { ActivityIndicator, Animated, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import styles from '../styles/creditsStyles';

export default function CreditPaymentModal({
  visible,
  selectedCredit,
  animValue,
  paymentAmount,
  onChangeAmount,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        {!selectedCredit ? (
          <ActivityIndicator size="large" color="#fff" />
        ) : (
          <Animated.View style={[styles.modalContent, { transform: [{ scale: animValue }] }]}>
            <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 10 }}>Registrar Abono</Text>
            <Text style={{ color: '#007AFF', marginBottom: 8 }}>
              Pendiente: C${selectedCredit?.pending?.toFixed(2)}
            </Text>

            <TextInput
              placeholder="Monto a abonar"
              keyboardType="numeric"
              value={paymentAmount}
              onChangeText={onChangeAmount}
              style={styles.input}
            />

            <View style={styles.rowButtons}>
              <TouchableOpacity onPress={onConfirm} style={[styles.btn, styles.btnPrimary]}>
                <Text style={styles.btnText}>Confirmar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onCancel} style={[styles.btn, styles.btnDanger]}>
                <Text style={styles.btnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

