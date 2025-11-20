import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import styles from '../styles/discountModalStyles';

export default function DiscountModal({ visible, product, onClose, onApply }) {
  const [type, setType] = useState(product?.discountType ?? 'none');
  const [value, setValue] = useState(product?.discountValue?.toString() ?? '');

  useEffect(() => {
    setType(product?.discountType ?? 'none');
    setValue(product?.discountValue?.toString() ?? '');
  }, [product]);

  const apply = () => {
    onApply({ discountType: type, discountValue: parseFloat(value) || 0 });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Descuento — {product?.name}</Text>

          <View style={styles.types}>
            <TouchableOpacity onPress={() => setType('none')} style={[styles.typeBtn, type === 'none' && styles.typeActive]}>
              <Text style={type === 'none' ? styles.typeActiveText : styles.typeText}>Sin descuento</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setType('percent')} style={[styles.typeBtn, type === 'percent' && styles.typeActive]}>
              <Text style={type === 'percent' ? styles.typeActiveText : styles.typeText}>% Porc.</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setType('amount')} style={[styles.typeBtn, type === 'amount' && styles.typeActive]}>
              <Text style={type === 'amount' ? styles.typeActiveText : styles.typeText}>Monto</Text>
            </TouchableOpacity>
          </View>

          {type !== 'none' && (
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder={type === 'percent' ? 'Valor %' : 'Valor C$'}
              value={value}
              onChangeText={setValue}
            />
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.applyBtn} onPress={() => { apply(); onClose(); }}>
              <Text style={styles.applyText}>Aplicar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
