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

const BonusSetup = ({ bonusData, onChange }) => {
  const [modalVisible, setModalVisible] = useState(false);

  const handleToggle = (isEnabled) => {
    onChange({ ...bonusData, enabled: isEnabled });
  };

  const handleFieldChange = (field, value) => {
    // Solo permitir números en los campos de cantidad
    const sanitizedValue = value.replace(/[^0-9]/g, '');
    onChange({ ...bonusData, [field]: sanitizedValue });
  };

  const handleProductSelect = (product) => {
    onChange({
      ...bonusData,
      bonusProductId: product.id,
      bonusProductName: product.name,
    });
  };

  return (
    <View style={inheritedStyles.section}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={inheritedStyles.sectionTitle}>Bonificaciones</Text>
        <Switch
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={bonusData?.enabled ? "#007AFF" : "#f4f3f4"}
          onValueChange={handleToggle}
          value={bonusData?.enabled || false}
        />
      </View>

      {bonusData?.enabled && (
        <View style={{ marginTop: 16 }}>
          <Text style={inheritedStyles.label}>Por cada...</Text>
          <TextInput
            style={inheritedStyles.input}
            keyboardType="numeric"
            value={String(bonusData.threshold || '')}
            onChangeText={t => handleFieldChange('threshold', t)}
            placeholder="Ej. 10 unidades vendidas"
            placeholderTextColor="#999"
          />

          <Text style={inheritedStyles.label}>...regalar producto</Text>
          <TouchableOpacity
            style={styles.productSelector}
            onPress={() => setModalVisible(true)}
          >
            <Text
              style={[styles.productSelectorText, !bonusData.bonusProductName && styles.placeholderText]}
            >
              {bonusData.bonusProductName || 'Seleccionar producto de regalo'}
            </Text>
            <Icon name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>

          <Text style={inheritedStyles.label}>...en cantidad de</Text>
          <TextInput
            style={inheritedStyles.input}
            keyboardType="numeric"
            value={String(bonusData.bonusQuantity || '')}
            onChangeText={t => handleFieldChange('bonusQuantity', t)}
            placeholder="Ej. 1 unidad"
            placeholderTextColor="#999"
          />
        </View>
      )}

      <BonusProductSelectModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
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
});

export default BonusSetup;
