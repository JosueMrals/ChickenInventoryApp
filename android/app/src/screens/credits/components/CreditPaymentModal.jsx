import React, { useMemo } from 'react';
import { ActivityIndicator, Animated, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import styles from '../styles/creditsStyles';
import { getDaysOverdue, toDateSafe } from '../../../utils/creditUtils';

const parseAmount = (value) => {
  const num = Number((value || '').toString().replace(',', '.').trim());
  return Number.isFinite(num) && num > 0 ? num : 0;
};

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
  const daysOverdue = getDaysOverdue(selectedCredit);
  const dueDate = toDateSafe(selectedCredit?.dueDate);

  // Vista previa en vivo: cuánto se aplica, cuánto queda y el cambio si paga de más.
  const preview = useMemo(() => {
    const amount = parseAmount(paymentAmount);
    if (!amount) return null;
    const applied = Math.min(amount, pending);
    return {
      applied,
      remaining: Math.max(pending - amount, 0),
      change: Math.max(amount - pending, 0),
      settles: amount >= pending,
    };
  }, [paymentAmount, pending]);

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

            {/* Fecha de pago acordada / atraso */}
            {dueDate && (
              <View style={[styles.dueRow, daysOverdue > 0 && styles.dueRowLate]}>
                <Icon
                  name={daysOverdue > 0 ? 'alert-circle-outline' : 'calendar-check-outline'}
                  size={14}
                  color={daysOverdue > 0 ? '#DC2626' : '#6B7280'}
                />
                <Text style={[styles.dueRowText, daysOverdue > 0 && styles.dueRowTextLate]}>
                  Fecha de pago: {dueDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {daysOverdue > 0 ? `  ·  ${daysOverdue} día${daysOverdue !== 1 ? 's' : ''} de atraso` : ''}
                </Text>
              </View>
            )}

            {/* Input */}
            <View style={styles.inputWrap}>
              <Icon name="cash" size={22} color={submitting ? '#bbb' : '#10B981'} />
              <TextInput
                placeholder="Monto recibido"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                value={paymentAmount}
                onChangeText={onChangeAmount}
                editable={!submitting}
                style={styles.input}
              />
            </View>

            {/* Vista previa del abono */}
            {preview && (
              <View style={styles.previewBox}>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Se abona</Text>
                  <Text style={styles.previewValue}>C${preview.applied.toFixed(2)}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>{preview.settles ? 'Crédito' : 'Restante'}</Text>
                  <Text style={[styles.previewValue, preview.settles && styles.previewValueSuccess]}>
                    {preview.settles ? 'Saldado' : `C$${preview.remaining.toFixed(2)}`}
                  </Text>
                </View>
                {preview.change > 0 && (
                  <View style={styles.previewRow}>
                    <Text style={[styles.previewLabel, styles.previewChangeLabel]}>Cambio a devolver</Text>
                    <Text style={[styles.previewValue, styles.previewChangeValue]}>C${preview.change.toFixed(2)}</Text>
                  </View>
                )}
              </View>
            )}

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
