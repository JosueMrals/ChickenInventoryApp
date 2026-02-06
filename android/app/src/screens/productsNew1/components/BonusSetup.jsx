import React, { useState } from 'react';
import { View, Text, Switch, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import BonusProductSelectModal from './BonusProductSelectModal';

// Extraemos los estilos de los componentes padre para reutilizarlos.
const inheritedStyles = StyleSheet.create({
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 16 },
  label: { fontSize: 13, color: '#666', marginBottom: 6, fontWeight: '600', textTransform: 'uppercase' },
  input: { backgroundColor: '#F5F6FA', padding: 12, borderRadius: 10, fontSize: 16, color: '#333', marginBottom: 16, borderWidth: 1, borderColor: '#F0F0F0' },
});

const emptyBonus = () => ({ enabled: true, threshold: '', bonusProductId: null, bonusProductName: '', bonusQuantity: '' });

const BonusSetup = ({ bonuses = [], onChange }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [modalIndex, setModalIndex] = useState(null);

  const callOnChange = (newBonuses) => {
    if (typeof onChange === 'function') onChange(newBonuses);
  };

  const addBonus = () => {
    if (bonuses.length >= 5) return;
    const newBonuses = [...bonuses, emptyBonus()];
    callOnChange(newBonuses);
  };

  const removeBonus = (index) => {
    const newBonuses = bonuses.filter((_, i) => i !== index);
    callOnChange(newBonuses);
  };

  const updateBonus = (index, field, value) => {
    const newBonuses = bonuses.map((b, i) => i === index ? { ...b, [field]: value } : b);
    callOnChange(newBonuses);
  };

  const toggleBonus = (index, isEnabled) => {
    const newBonuses = bonuses.map((b, i) => i === index ? { ...b, enabled: isEnabled } : b);
    callOnChange(newBonuses);
  };

  const openProductModal = (index) => {
    setModalIndex(index);
    setModalVisible(true);
  };

  const handleProductSelect = (product) => {
    if (modalIndex === null) return;
    const newBonuses = bonuses.map((b, i) => i === modalIndex ? { ...b, bonusProductId: product.id, bonusProductName: product.name } : b);
    callOnChange(newBonuses);
    setModalVisible(false);
    setModalIndex(null);
  };

  const sanitizeNumber = (text) => text.replace(/[^0-9]/g, '');

  return (
    <View style={inheritedStyles.section}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={inheritedStyles.sectionTitle}>Bonificaciones</Text>
        {/* No hay switch global: cada bonificación tiene su propio switch */}
      </View>

      {bonuses.length === 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ color: '#666', fontStyle: 'italic' }}>Sin bonificaciones configuradas.</Text>
        </View>
      )}

      {bonuses.map((b, idx) => (
        <View key={idx} style={{ marginTop: 12, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: '#f0f0f0', paddingTop: idx === 0 ? 0 : 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[inheritedStyles.label, { marginBottom: 0 }]}>Bonificación #{idx + 1}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => removeBonus(idx)} style={{ marginRight: 12 }}>
                <Icon name="trash-outline" size={20} color="#FF3B30" />
              </TouchableOpacity>
              <Switch
                trackColor={{ false: "#767577", true: "#81b0ff" }}
                thumbColor={b?.enabled ? "#007AFF" : "#f4f3f4"}
                onValueChange={(val) => toggleBonus(idx, val)}
                value={b?.enabled || false}
              />
            </View>
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={inheritedStyles.label}>Por cada...</Text>
            <TextInput
              style={inheritedStyles.input}
              keyboardType="numeric"
              value={String(b.threshold || '')}
              onChangeText={t => updateBonus(idx, 'threshold', sanitizeNumber(t))}
              placeholder="Ej. 10 unidades vendidas"
              placeholderTextColor="#999"
            />

            <Text style={inheritedStyles.label}>...regalar producto</Text>
            <TouchableOpacity
              style={styles.productSelector}
              onPress={() => openProductModal(idx)}
            >
              <Text
                style={[styles.productSelectorText, !b.bonusProductName && styles.placeholderText]}
              >
                {b.bonusProductName || 'Seleccionar producto de regalo'}
              </Text>
              <Icon name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>

            <Text style={inheritedStyles.label}>...en cantidad de</Text>
            <TextInput
              style={inheritedStyles.input}
              keyboardType="numeric"
              value={String(b.bonusQuantity || '')}
              onChangeText={t => updateBonus(idx, 'bonusQuantity', sanitizeNumber(t))}
              placeholder="Ej. 1 unidad"
              placeholderTextColor="#999"
            />
          </View>
        </View>
      ))}

      <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'flex-end' }}>
        {bonuses.length < 5 && (
          <TouchableOpacity onPress={addBonus} style={styles.addBtn}>
            <Icon name="add" size={16} color="#fff" />
            <Text style={styles.addBtnText}>Agregar bonificación</Text>
          </TouchableOpacity>
        )}
      </View>

      <BonusProductSelectModal
        visible={modalVisible}
        onClose={() => { setModalVisible(false); setModalIndex(null); }}
        onProductSelect={handleProductSelect}
      />
    </View>
  );
};

const styles = StyleSheet.create({
    productSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F5F6FA',
        padding: 12,
        borderRadius: 10,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    productSelectorText: {
        fontSize: 16,
        color: '#333',
    },
    placeholderText: {
        color: '#999',
    },
    addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#007AFF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
    addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 6 },
});

export default BonusSetup;
