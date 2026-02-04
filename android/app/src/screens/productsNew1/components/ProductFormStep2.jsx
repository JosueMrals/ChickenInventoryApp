// src/components/ProductFormStep2.jsx
import React from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  Button,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

export default function ProductFormStep2({
  values = {},
  setField,
  onBack,
  onSubmit,
  onCancel,
}) {
  const safeSetField = (field, value) => {
    if (typeof setField === 'function') return setField(field, value);
    if (__DEV__) console.warn('ProductFormStep2: setField not provided');
    return null;
  };

  const parseNumericInput = (text) => {
    if (text === '' || text == null) return '';
    // allow decimals with dot or comma
    const normalized = text.replace(',', '.').trim();
    const n = Number(normalized);
    return Number.isFinite(n) ? n : '';
  };

  const handlePurchasePrice = (t) => safeSetField('purchasePrice', parseNumericInput(t));
  const handleProfitMargin = (t) => safeSetField('profitMargin', parseNumericInput(t));
  const handleSalePrice = (t) => safeSetField('salePrice', parseNumericInput(t));
  const toggleAuto = (v) => safeSetField('autoSalePrice', !!v);
  const setMeasure = (m) => safeSetField('measureType', m);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>

        <Text style={styles.label}>Precio de compra *</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="0.00"
          value={values.purchasePrice !== undefined && values.purchasePrice !== null ? String(values.purchasePrice) : ''}
          onChangeText={handlePurchasePrice}
        />

        <Text style={styles.label}>Margen de ganancia (%) *</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="30"
          value={values.profitMargin !== undefined && values.profitMargin !== null ? String(values.profitMargin) : ''}
          onChangeText={handleProfitMargin}
        />

        <View style={styles.row}>
          <Text style={{ flex: 1 }}>Calcular precio de venta automáticamente</Text>
          <Switch value={!!values.autoSalePrice} onValueChange={toggleAuto} />
        </View>

        {values.autoSalePrice ? (
          <View style={{ marginBottom: 8 }}>
            <Text style={styles.helper}>Precio de venta calculado: {values.salePrice !== '' && values.salePrice != null ? Number(values.salePrice).toFixed(2) : '—'}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.label}>Precio de venta (manual) *</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="0.00"
              value={values.salePrice !== undefined && values.salePrice !== null ? String(values.salePrice) : ''}
              onChangeText={handleSalePrice}
            />
          </>
        )}

        <Text style={[styles.label, { marginTop: 12 }]}>Tipo de medida</Text>
        <View style={styles.measureRow}>
          <TouchableOpacity style={[styles.measureBtn, values.measureType === 'unit' ? styles.measureBtnActive : null]} onPress={() => setMeasure('unit')}>
            <Text style={values.measureType === 'unit' ? styles.measureTextActive : styles.measureText}>Unidad</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.measureBtn, values.measureType === 'weight' ? styles.measureBtnActive : null]} onPress={() => setMeasure('weight')}>
            <Text style={values.measureType === 'weight' ? styles.measureTextActive : styles.measureText}>Peso</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 12 }} />

        <View style={styles.actionsRow}>
          <View style={{ width: 12 }} />
          <Button title="Cancelar" color="#777" onPress={onCancel} />
          <View style={{ width: 12 }} />
          <Button title="Guardar producto" onPress={onSubmit} />
        </View>
      </View>
    </KeyboardAvoidingView>
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
    marginBottom: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  helper: { color: '#444', fontStyle: 'italic' },
  measureRow: { flexDirection: 'row', marginTop: 6 },
  measureBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  measureBtnActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  measureText: { color: '#222' },
  measureTextActive: { color: '#fff', fontWeight: '700' },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 18, alignItems: 'center' },
});
