import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import styles, { COLORS } from '../styles/payrollStyles';

interface Props {
  visible: boolean;
  staffName: string;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (amount: number, note: string) => void;
}

/** Registro de un adelanto de salario: monto y el detalle de para qué fue. */
const AdvanceModal = ({ visible, staffName, saving = false, onClose, onSubmit }: Props) => {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  // El modal no se desmonta al cerrarse, así que sin esto el siguiente adelanto
  // aparecería con el monto del anterior ya escrito.
  useEffect(() => {
    if (visible) {
      setAmount('');
      setNote('');
      setError(null);
    }
  }, [visible]);

  const handleSubmit = () => {
    const parsed = Number(amount.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Ingresa un monto mayor a cero.');
      return;
    }
    setError(null);
    onSubmit(parsed, note);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nuevo adelanto</Text>
            <Text style={styles.modalSubtitle}>Se descontará del pago de {staffName}.</Text>

            <Text style={styles.modalLabel}>Monto (C$)</Text>
            <TextInput
              style={styles.modalInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={COLORS.muted}
              autoFocus
            />

            <Text style={styles.modalLabel}>Detalle</Text>
            <TextInput
              style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
              value={note}
              onChangeText={setNote}
              placeholder="Motivo del adelanto (opcional)"
              placeholderTextColor={COLORS.muted}
              multiline
            />

            {!!error && (
              <Text style={{ color: COLORS.danger, fontSize: 12, fontWeight: '600', marginBottom: 10 }}>
                {error}
              </Text>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, { flex: 1 }]}
                onPress={onClose}
                disabled={saving}
              >
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
};

export default AdvanceModal;
