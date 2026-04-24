import React from 'react';
import { ActivityIndicator, Animated, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
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
  const name = selectedCredit?.customerName || selectedCredit?.clientName || 'Cliente';
  const pending = Number(selectedCredit?.pending || 0);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        {!selectedCredit ? (
          <ActivityIndicator size="large" color="#fff" />
        ) : (
          <Animated.View style={[styles.modalContent, { transform: [{ scale: animValue }] }]}>
            <Text style={styles.modalTitle}>Registrar Abono</Text>
            <Text style={styles.modalCustomer}>{name}</Text>

            {/* Pending badge */}
            <View style={styles.pendingBadge}>
              <Icon name="cash-clock" size={20} color="#D97706" />
              <View>
                <Text style={styles.pendingBadgeText}>Saldo pendiente</Text>
                <Text style={styles.pendingAmount}>C${pending.toFixed(2)}</Text>
              </View>
            </View>

            {/* Input */}
            <View style={styles.inputWrap}>
              <Icon name="cash" size={22} color={submitting ? '#bbb' : '#10B981'} />
              <TextInput
                placeholder="Monto a abonar"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                value={paymentAmount}
                onChangeText={onChangeAmount}
                editable={!submitting}
                style={styles.input}
              />
            </View>

            {/* Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.btnConfirm, submitting && { opacity: 0.7 }]}
                onPress={onConfirm}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Icon name="check-circle-outline" size={18} color="#fff" />
                    <Text style={styles.btnConfirmText}>Confirmar</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnCancel, submitting && { opacity: 0.5 }]}
                onPress={onCancel}
                disabled={submitting}
              >
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}
