import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, Alert, ScrollView,
} from 'react-native';
import styles from './styles/styles';
import * as customersService from '../../services/customersService';

/**
 * Props:
 *  visible, onClose, customer (nullable), role
 */
export default function CustomerFormModal({ visible, onClose, customer, role, onSaved }) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    cedula: '',
    creditLimit: '',
    type: 'Común', // Común | Semi-mayorista | Mayorista
    discount: '', // porcentaje discount (ej: 10 para 10%)
  });

  useEffect(() => {
    if (customer) {
      setForm({
        firstName: customer.firstName || '',
        lastName: customer.lastName || '',
        phone: customer.phone || '',
        address: customer.address || '',
        cedula: customer.cedula || '',
        creditLimit: customer.creditLimit != null ? String(customer.creditLimit) : '',
        type: customer.type || 'Común',
        discount: customer.discount != null ? String(customer.discount) : '',
      });
    } else {
      setForm((f) => ({ ...f, firstName: '', lastName: '', phone: '', address: '', cedula: '', creditLimit: '', type: 'Común', discount: '' }));
    }
  }, [customer, visible]);

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.phone.trim()) {
      Alert.alert('Campos requeridos', 'Nombre y teléfono son obligatorios.');
      return;
    }

    // Si usuario no es admin, evitar cambios en creditLimit y discount
    if (customer && role !== 'admin') {
      // block editing sensitive fields by non-admin
      const originalCredit = customer.creditLimit ?? 0;
      const originalDiscount = customer.discount ?? 0;
      if (parseFloat(form.creditLimit || 0) !== originalCredit) {
        Alert.alert('No autorizado', 'Solo admin puede cambiar el límite de crédito.');
        return;
      }
      if (parseFloat(form.discount || 0) !== originalDiscount) {
        Alert.alert('No autorizado', 'Solo admin puede cambiar el descuento.');
        return;
      }
    }

    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      cedula: form.cedula.trim(),
      creditLimit: parseFloat(form.creditLimit) || 0,
      type: form.type,
      discount: parseFloat(form.discount) || 0,
    };

    try {
      if (customer) {
        await customersService.updateCustomer(customer.id, payload);
      } else {
        await customersService.createCustomer(payload);
      }
      Alert.alert('✅ Cliente guardado');
      onSaved && onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', e.message || 'No se pudo guardar');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <ScrollView contentContainerStyle={styles.modalContainer}>
          <Text style={styles.modalTitle}>{customer ? 'Editar cliente' : 'Nuevo cliente'}</Text>

          <TextInput placeholder="Nombres" style={styles.input} value={form.firstName} onChangeText={(t) => setForm({ ...form, firstName: t })} />
          <TextInput placeholder="Apellidos" style={styles.input} value={form.lastName} onChangeText={(t) => setForm({ ...form, lastName: t })} />
          <TextInput placeholder="Teléfono" keyboardType="phone-pad" style={styles.input} value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} />
          <TextInput placeholder="Cédula" style={styles.input} value={form.cedula} onChangeText={(t) => setForm({ ...form, cedula: t })} />
          <TextInput placeholder="Dirección" style={styles.input} value={form.address} onChangeText={(t) => setForm({ ...form, address: t })} />

          <Text style={styles.label}>Tipo de cliente</Text>
          <View style={styles.rowBetween}>
            {['Común', 'Semi-mayorista', 'Mayorista'].map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setForm({ ...form, type: t })}
                style={[styles.typeButton, form.type === t && styles.typeButtonActive]}
              >
                <Text style={[styles.typeText, form.type === t && styles.typeTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Descuento (%)</Text>
          <TextInput
            placeholder="Ej: 10"
            keyboardType="numeric"
            editable={role === 'admin'}
            style={[styles.input, role !== 'admin' && styles.inputDisabled]}
            value={String(form.discount)}
            onChangeText={(t) => setForm({ ...form, discount: t })}
          />

          <Text style={styles.label}>Límite de crédito</Text>
          <TextInput
            placeholder="0.00"
            keyboardType="numeric"
            editable={role === 'admin'}
            style={[styles.input, role !== 'admin' && styles.inputDisabled]}
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
