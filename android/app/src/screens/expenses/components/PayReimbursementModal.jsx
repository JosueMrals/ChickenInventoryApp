import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { REIMBURSEMENT_PAYMENT_METHODS, validatePaymentData } from '../services/reimbursementService';
import { formatCurrency } from '../../../utils/formatMoney';
import styles, { COLORS } from '../styles/expensesStyles';

const METHOD_LABELS = { CASH: 'Efectivo', TRANSFER: 'Transferencia' };

/** Captura método/referencia/notas del pago de un reembolso — mismo patrón que ReviewTurnoModal. */
export default function PayReimbursementModal({ visible, reimbursement, saving = false, onClose, onSubmit }) {
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) {
      setPaymentMethod('CASH');
      setReference('');
      setNotes('');
      setError(null);
    }
  }, [visible]);

  if (!reimbursement) return null;

  const handleSubmit = () => {
    const validation = validatePaymentData({ paymentMethod, reference });
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    setError(null);
    onSubmit({ paymentMethod, reference: reference.trim() || null, notes: notes.trim() || null });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalBackdrop}>
          <ScrollView style={styles.modalCard} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Marcar como pagado</Text>
            <Text style={styles.modalSubtitle}>Monto a reembolsar: {formatCurrency(reimbursement.amount)}</Text>

            <Text style={styles.modalLabel}>Método de pago</Text>
            <View style={styles.chipsRow}>
              {REIMBURSEMENT_PAYMENT_METHODS.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.chip, paymentMethod === m && styles.chipActive]}
                  onPress={() => setPaymentMethod(m)}
                >
                  <Text style={[styles.chipText, paymentMethod === m && styles.chipTextActive]}>{METHOD_LABELS[m]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {paymentMethod === 'TRANSFER' && (
              <>
                <Text style={styles.modalLabel}>Referencia de transferencia *</Text>
                <TextInput
                  style={styles.modalInput}
                  value={reference}
                  onChangeText={setReference}
                  placeholder="N.º de comprobante o referencia"
                  placeholderTextColor={COLORS.muted}
                />
              </>
            )}

            <Text style={styles.modalLabel}>Notas (opcional)</Text>
            <TextInput
              style={[styles.modalInput, styles.inputMultiline]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Notas del pago"
              placeholderTextColor={COLORS.muted}
              multiline
            />

            {!!error && (
              <Text style={{ color: COLORS.red, fontSize: 12, fontWeight: '600', marginTop: 8 }}>{error}</Text>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={onClose} disabled={saving}>
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1, marginTop: 0 }, saving && styles.primaryBtnDisabled]}
                onPress={handleSubmit}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Continuar</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
