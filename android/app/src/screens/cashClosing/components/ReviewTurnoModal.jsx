import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import styles, { COLORS, formatMoney } from '../styles/cashClosingStyles';

/** Registrar el faltante de un turno: cuánto dinero no coincidió. */
export default function ReviewTurnoModal({ visible, turno, saving = false, onClose, onSubmit }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) {
      setAmount('');
      setError(null);
    }
  }, [visible]);

  if (!turno) return null;

  const handleSubmit = () => {
    const parsed = Number((amount || '').replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Ingresa un monto mayor a cero.');
      return;
    }
    setError(null);
    onSubmit(parsed);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Registrar faltante</Text>
            <Text style={styles.modalSubtitle}>
              {turno.userName} · Esperado: {formatMoney(turno.expectedAmount)}
            </Text>

            <Text style={styles.modalLabel}>Monto faltante (C$)</Text>
            <TextInput
              style={styles.modalInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={COLORS.muted}
              autoFocus
            />

            {!!error && (
              <Text style={{ color: COLORS.danger, fontSize: 12, fontWeight: '600', marginTop: -8, marginBottom: 10 }}>
                {error}
              </Text>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.secondaryButton, { flex: 1 }]} onPress={onClose} disabled={saving}>
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, { flex: 1 }, saving && styles.disabledButton]}
                onPress={handleSubmit}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color={COLORS.surface} />
                ) : (
                  <Text style={styles.primaryButtonText}>Registrar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
