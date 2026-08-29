import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import styles, { COLORS } from '../styles/receptionStyles';
import { formatCurrency } from '../../../utils/formatMoney';

// Solo dígitos y un punto decimal.
const clean = (val) => (val || '').replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');

// Ventana flotante para capturar/editar la cantidad y el costo unitario de un
// producto de la recepción. Mantiene su propio estado y lo entrega en onSave.
export default function LineItemModal({ visible, line, onClose, onSave, onRemove }) {
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');

  // Al abrirse (o cambiar de producto), precarga los valores de la línea.
  useEffect(() => {
    if (visible && line) {
      setQuantity(line.quantity != null ? String(line.quantity) : '');
      setUnitCost(line.unitCost != null ? String(line.unitCost) : '');
    }
  }, [visible, line]);

  if (!line) return null;

  const qty = Number(quantity) || 0;
  const cost = Number(unitCost) || 0;
  const canSave = qty > 0;
  const isEditing = line.existing;

  const handleSave = () => {
    onSave({ productId: line.productId, quantity: clean(quantity), unitCost: clean(unitCost) });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>{line.productName}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="close" size={26} color={COLORS.ink} />
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: 16, paddingBottom: 20 }}>
            <Text style={styles.lineSub}>Stock actual: {line.stock}</Text>

            <View style={[styles.rowBetween, { marginTop: 16 }]}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.label, { marginBottom: 6 }]}>Cantidad <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.muted}
                  value={quantity}
                  onChangeText={(v) => setQuantity(clean(v))}
                  autoFocus
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={[styles.label, { marginBottom: 6 }]}>Costo unitario (C$)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor={COLORS.muted}
                  value={unitCost}
                  onChangeText={(v) => setUnitCost(clean(v))}
                />
              </View>
            </View>

            <View style={[styles.rowBetween, { marginBottom: 4 }]}>
              <Text style={styles.lineSub}>Nuevo stock: {line.stock + qty}</Text>
              <Text style={styles.value}>Subtotal: {formatCurrency(qty * cost)}</Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, !canSave && styles.primaryBtnDisabled, { marginTop: 12 }]}
              onPress={handleSave}
              disabled={!canSave}
            >
              <Text style={styles.primaryBtnText}>{isEditing ? 'Guardar cambios' : 'Agregar a la recepción'}</Text>
            </TouchableOpacity>

            {isEditing && (
              <TouchableOpacity style={styles.ghostBtn} onPress={() => onRemove(line.productId)}>
                <Text style={[styles.ghostBtnText, { color: COLORS.red }]}>Quitar producto</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
