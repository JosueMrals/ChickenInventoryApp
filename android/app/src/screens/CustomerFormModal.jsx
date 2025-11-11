import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, Alert, ScrollView,
} from 'react-native';
import styles from '../styles/CustomersStyles';
import { createCustomer, updateCustomer } from '../services/customersService';

export default function CustomerFormModal({ visible, onClose, customer, role }) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    cedula: '',
    creditLimit: '',
  });

  useEffect(() => {
    if (customer) setForm(customer);
  }, [customer]);

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.phone.trim()) {
      Alert.alert('Campos requeridos', 'Nombre y teléfono son obligatorios.');
      return;
    }

    try {
      const data = {
        ...form,
        creditLimit: parseFloat(form.creditLimit) || 0,
      };

      if (customer) {
        if (role !== 'admin' && form.creditLimit !== customer.creditLimit) {
          Alert.alert('No autorizado', 'Solo el admin puede cambiar el límite de crédito.');
          return;
        }
        await updateCustomer(customer.id, data);
      } else {
        await createCustomer(data);
      }

      Alert.alert('✅ Éxito', 'Datos del cliente guardados.');
      onClose();
    } catch (error) {
      console.log('🔥 Error guardando cliente:', error);
      Alert.alert('Error', error.message);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <ScrollView contentContainerStyle={styles.modalContainer}>
          <Text style={styles.modalTitle}>
            {customer ? 'Editar cliente' : 'Nuevo cliente'}
          </Text>

          <TextInput
            placeholder="Nombres"
            style={styles.input}
            value={form.firstName}
            onChangeText={(t) => setForm({ ...form, firstName: t })}
          />
          <TextInput
            placeholder="Apellidos"
            style={styles.input}
            value={form.lastName}
            onChangeText={(t) => setForm({ ...form, lastName: t })}
          />
          <TextInput
            placeholder="Teléfono"
            keyboardType="phone-pad"
            style={styles.input}
            value={form.phone}
            onChangeText={(t) => setForm({ ...form, phone: t })}
          />
          <TextInput
            placeholder="Cédula"
            style={styles.input}
            value={form.cedula}
            onChangeText={(t) => setForm({ ...form, cedula: t })}
          />
          <TextInput
            placeholder="Dirección"
            style={styles.input}
            value={form.address}
            onChangeText={(t) => setForm({ ...form, address: t })}
          />
          <TextInput
            placeholder="Límite de crédito"
            keyboardType="numeric"
            style={styles.input}
            editable={role === 'admin'}
            value={String(form.creditLimit)}
            onChangeText={(t) => setForm({ ...form, creditLimit: t })}
          />

          <View style={styles.rowButtons}>
            <TouchableOpacity style={styles.btnPrimary} onPress={handleSave}>
              <Text style={styles.btnText}>Guardar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnCancel} onPress={onClose}>
              <Text style={styles.btnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
