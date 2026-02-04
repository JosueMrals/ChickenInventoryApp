// src/components/ProductFormStep1.jsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Button,
  StyleSheet,
  Alert,
  Platform,
  AccessibilityInfo,
} from 'react-native';

export default function ProductFormStep1({
  values = {},
  setField,
  onNext,
  onCancel,
  onOpenScanner,
  syncValidateName,
}) {
  // safe setter fallback
  const safeSetField = (field, value) => {
    if (typeof setField === 'function') return setField(field, value);
    if (__DEV__) console.warn('ProductFormStep1: setField no proporcionado.');
    return null;
  };

  const [touched, setTouched] = useState({ name: false, barcode: false });
  const [errors, setErrors] = useState({ name: null, barcode: null });

  useEffect(() => {
    // validation runs on values change (sync)
    const newErrors = { name: null, barcode: null };
    const nameVal = (values?.name ?? '').toString().trim();

    if (!nameVal) {
      newErrors.name = 'El nombre es obligatorio';
    } else if (syncValidateName) {
      try {
        const res = syncValidateName(nameVal);
        if (res && res.ok === false) newErrors.name = res.msg || 'Nombre inválido';
      } catch (err) {
        // if validator throws, we log and ignore (no block)
        if (__DEV__) console.error('syncValidateName error:', err);
      }
    } else if (nameVal.length < 2) {
      newErrors.name = 'El nombre debe tener al menos 2 caracteres';
    }

    const barcodeVal = values?.barcode ?? '';
    if (barcodeVal && typeof barcodeVal !== 'string') {
      newErrors.barcode = 'Código inválido';
    } else if (barcodeVal && /[\s]/.test(barcodeVal)) {
      // normalization wise we allow but warn about spaces
      newErrors.barcode = 'El código no debe contener espacios';
    }

    setErrors(newErrors);
  }, [values, syncValidateName]);

  function handleNext() {
    setTouched({ name: true, barcode: true });
    if (errors.name) {
      // announce for accessibility
      AccessibilityInfo.announceForAccessibility(errors.name);
      Alert.alert('Error', errors.name);
      return;
    }
    onNext && onNext();
  }

  function handleCancel() {
    const hasData =
      (values?.name && values.name.toString().trim() !== '') ||
      (values?.barcode && values.barcode.toString().trim() !== '') ||
      (values?.description && values.description.toString().trim() !== '');

    if (hasData) {
      Alert.alert(
        'Descartar cambios?',
        'Si cancelas, los datos ingresados se perderán.',
        [
          { text: 'Seguir editando', style: 'cancel' },
          {
            text: 'Descartar',
            style: 'destructive',
            onPress: () => onCancel && onCancel(),
          },
        ]
      );
    } else {
      onCancel && onCancel();
    }
  }

  function handleOpenScanner() {
    if (onOpenScanner) onOpenScanner();
    else Alert.alert('Lector no disponible', 'Implementa onOpenScanner en el componente padre.');
  }

  return (
    <View style={styles.container}>

      <Text style={styles.label}>Nombre del Producto</Text>
      <TextInput
        style={[styles.input, touched.name && errors.name ? styles.inputError : null]}
        placeholder="Ej: Jabón azul"
        value={values?.name ?? ''}
        onChangeText={(t) => {
          safeSetField('name', t);
        }}
        onBlur={() => setTouched((s) => ({ ...s, name: true }))}
        returnKeyType="next"
        accessible
        accessibilityLabel="Nombre del producto"
        autoCapitalize="sentences"
      />
      {touched.name && errors.name ? <Text style={styles.error}>{errors.name}</Text> : null}

      <Text style={[styles.label, { marginTop: 14 }]}>Código de barras</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { flex: 1 }, touched.barcode && errors.barcode ? styles.inputError : null]}
          placeholder="123456789012"
          value={values?.barcode ?? ''}
          onChangeText={(t) => {
            const normalized = typeof t === 'string' ? t.trim() : t;
            safeSetField('barcode', normalized);
          }}
          onBlur={() => setTouched((s) => ({ ...s, barcode: true }))}
          keyboardType={Platform.OS === 'android' ? 'default' : 'ascii-capable'}
          accessible
          accessibilityLabel="Código de barras"
        />

        <TouchableOpacity onPress={handleOpenScanner} style={styles.scanButton} accessibilityLabel="Abrir lector de código de barras">
          <Text style={styles.scanIcon}>📷</Text>
        </TouchableOpacity>
      </View>
      {touched.barcode && errors.barcode ? <Text style={styles.error}>{errors.barcode}</Text> : null}

      <Text style={[styles.label, { marginTop: 14 }]}>Descripción</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        placeholder="Descripción (opcional)"
        value={values?.description ?? ''}
        onChangeText={(t) => safeSetField('description', t)}
        multiline
        textAlignVertical="top"
        accessible
        accessibilityLabel="Descripción"
      />

      <View style={styles.footer}>
        <View style={styles.leftButton}>
          <Button title="Cancelar" color="#777" onPress={handleCancel} style={styles.cancelButton} />
        </View>
        <View style={styles.rightButton}>
          <Button title="Siguiente" onPress={handleNext} disabled={!!errors.name} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, backgroundColor: '#fff', flex: 1 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: '#111' },
  label: { fontWeight: '600', marginBottom: 6, color: '#222' },
  input: {
    borderWidth: 1,
    borderColor: '#e6e6e6',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#fafafa',
  },
  textarea: { height: 110 },
  inputError: { borderColor: '#e53935' },
  error: { color: '#e53935', marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  scanButton: {
    marginLeft: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e6e6e6',
    backgroundColor: '#fff',
  },
  scanIcon: { fontSize: 18 },
  footer: { marginTop: 22, flexDirection: 'row', justifyContent: 'space-between' },
  leftButton: { flex: 1, marginRight: 20 },
  rightButton: { flex: 1 },
});
