import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TextInput, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

// Fila de selección: el solicitante elige cuántas unidades devolver (0..cantidad)
function SelectRow({ line, qty, onChange, disabled, isBonus }) {
  const max = Number(line.quantity) || 0;
  const set = (v) => onChange(Math.max(0, Math.min(max, Math.round(Number(v) || 0))));
  return (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowName} numberOfLines={1}>
          {line.productName || line.name || 'Producto'}{isBonus ? ' (regalía)' : ''}
        </Text>
        <Text style={s.rowMeta}>Vendido: {max}</Text>
      </View>
      <View style={s.stepper}>
        <TouchableOpacity style={s.stepBtn} onPress={() => set(qty - 1)} disabled={disabled || qty <= 0}>
          <Icon name="remove" size={18} color={qty <= 0 ? '#C7C7CC' : '#007AFF'} />
        </TouchableOpacity>
        <TextInput
          style={[s.stepInput, qty > 0 && s.stepInputActive]}
          value={String(qty)}
          onChangeText={set}
          keyboardType="number-pad"
          editable={!disabled}
          selectTextOnFocus
        />
        <TouchableOpacity style={s.stepBtn} onPress={() => set(qty + 1)} disabled={disabled || qty >= max}>
          <Icon name="add" size={18} color={qty >= max ? '#C7C7CC' : '#007AFF'} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Clave de emparejamiento entre la línea de la venta y la línea ya solicitada.
const lineKey = (line) => String(line?.productId || line?.id || line?.productName || line?.name || '');

// Cantidades ya solicitadas, indexadas por posición en la lista de la venta.
const presetQtyByIndex = (saleLines, presetLines) => {
  const requested = (presetLines || []).reduce((acc, line) => {
    acc[lineKey(line)] = Number(line.quantity) || 0;
    return acc;
  }, {});
  return (saleLines || []).reduce((acc, line, index) => {
    const qty = requested[lineKey(line)];
    if (qty > 0) acc[index] = Math.min(qty, Number(line.quantity) || 0);
    return acc;
  }, {});
};

export default function ReturnRequestModal({
  visible, sale, onClose, onSubmit, submitting,
  preset = null,                       // solicitud existente → el modal edita en vez de crear
  title = 'Solicitar Devolución',
  submitLabel = 'Enviar solicitud',
}) {
  const items = useMemo(() => (sale?.items || []), [sale]);
  const bonuses = useMemo(() => (sale?.bonusesAwarded || sale?.bonuses || []), [sale]);

  const [reason, setReason] = useState('');
  const [itemQty, setItemQty] = useState({});     // index -> qty
  const [bonusQty, setBonusQty] = useState({});

  useEffect(() => {
    if (!visible) {
      setReason('');
      setItemQty({});
      setBonusQty({});
      return;
    }
    if (preset) {
      setReason(preset.reason || '');
      setItemQty(presetQtyByIndex(items, preset.items));
      setBonusQty(presetQtyByIndex(bonuses, preset.bonuses));
    }
  }, [visible, preset, items, bonuses]);

  const totalSelected =
    Object.values(itemQty).reduce((a, b) => a + b, 0) +
    Object.values(bonusQty).reduce((a, b) => a + b, 0);

  const selectAll = () => {
    setItemQty(Object.fromEntries(items.map((it, i) => [i, Number(it.quantity) || 0])));
    setBonusQty(Object.fromEntries(bonuses.map((b, i) => [i, Number(b.quantity) || 0])));
  };

  const handleSubmit = () => {
    // Doble red: el padre ya usa useSubmitLock, pero `submitting` llega aquí
    // como prop y no debe reenviar mientras el envío anterior sigue en vuelo.
    if (submitting) return;
    if (totalSelected <= 0) {
      Alert.alert('Selecciona productos', 'Elige al menos un producto y una cantidad para devolver.');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Campo requerido', 'Debes ingresar una razón detallada para la devolución.');
      return;
    }
    const selItems = items
      .map((it, i) => ({ ...it, quantity: itemQty[i] || 0 }))
      .filter((it) => it.quantity > 0);
    const selBonuses = bonuses
      .map((b, i) => ({ ...b, quantity: bonusQty[i] || 0 }))
      .filter((b) => b.quantity > 0);
    onSubmit(reason.trim(), selItems, selBonuses);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !submitting && onClose()}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.header}>
            <Text style={s.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} disabled={submitting}>
              <Icon name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={s.sectionRow}>
              <Text style={s.sectionLabel}>Productos a devolver</Text>
              <TouchableOpacity onPress={selectAll} disabled={submitting}>
                <Text style={s.selectAll}>Seleccionar todo</Text>
              </TouchableOpacity>
            </View>

            {items.map((it, i) => (
              <SelectRow
                key={`item-${i}`}
                line={it}
                qty={itemQty[i] || 0}
                onChange={(v) => setItemQty((p) => ({ ...p, [i]: v }))}
                disabled={submitting}
              />
            ))}

            {bonuses.length > 0 && (
              <>
                <Text style={[s.sectionLabel, { marginTop: 12 }]}>Regalías</Text>
                {bonuses.map((b, i) => (
                  <SelectRow
                    key={`bonus-${i}`}
                    line={b}
                    qty={bonusQty[i] || 0}
                    onChange={(v) => setBonusQty((p) => ({ ...p, [i]: v }))}
                    disabled={submitting}
                    isBonus
                  />
                ))}
              </>
            )}

            <Text style={[s.sectionLabel, { marginTop: 16 }]}>Razón de devolución (obligatoria)</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Ej: El cliente rechazó 2 unidades por daño..."
              placeholderTextColor="#9CA3AF"
              style={s.reasonInput}
              multiline
              numberOfLines={4}
              editable={!submitting}
            />
          </ScrollView>

          <View style={s.actions}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={s.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} disabled={submitting}>
              {submitting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.submitText}>{submitLabel} ({totalSelected})</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
    maxHeight: '90%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#374151', textTransform: 'uppercase' },
  selectAll: { fontSize: 12, fontWeight: '700', color: '#007AFF' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 8,
  },
  rowName: { fontSize: 14, color: '#111827', fontWeight: '500' },
  rowMeta: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: {
    width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB',
  },
  stepInput: {
    minWidth: 44, height: 36, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#111827', paddingVertical: 0,
  },
  stepInputActive: { borderColor: '#007AFF', color: '#007AFF', backgroundColor: '#EFF6FF' },
  reasonInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, color: '#111827',
    minHeight: 80, textAlignVertical: 'top', marginTop: 6,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center',
  },
  cancelText: { color: '#374151', fontWeight: '600', fontSize: 14 },
  submitBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#D92D20', alignItems: 'center', justifyContent: 'center',
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
