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
  submitting = false,
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
              Pendiente: C${Number(selectedCredit?.pending || 0).toFixed(2)}
            </Text>

            <TextInput
              placeholder="Monto a abonar"
              keyboardType="numeric"
              value={paymentAmount}
              onChangeText={onChangeAmount}
              editable={!submitting}
              style={styles.input}
            />

            <View style={styles.rowButtons}>
              <TouchableOpacity
                onPress={onConfirm}
                style={[styles.btn, styles.btnPrimary, submitting && { opacity: 0.7 }]}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Confirmar</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onCancel}
                style={[styles.btn, styles.btnDanger, submitting && { opacity: 0.5 }]}
                disabled={submitting}
              >
                <Text style={styles.btnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}
