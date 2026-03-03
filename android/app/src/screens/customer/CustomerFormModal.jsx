import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert, ScrollView, SafeAreaView, StyleSheet, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import styles from './styles/styles';
import globalStyles from '../../styles/globalStyles';
import * as customersService from '../../services/customersService';

/**
 * Props (via route params): customer (nullable), role
 */
export default function CustomerFormModal({ navigation, route }) {
  const { customer, customerId, role = 'vendedor' } = route?.params || {};
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    cedula: '',
    creditLimit: '',
    type: 'Común',
    discount: '',
  });
  const [loadingCustomer, setLoadingCustomer] = useState(false);

  const canEditSensitive = role === 'admin';
  const canEditCustomer = role === 'admin' || role === 'vendedor';

  const applyCustomerToForm = (value) => {
    if (!value) {
      setForm({
        firstName: '',
        lastName: '',
        phone: '',
        address: '',
        cedula: '',
        creditLimit: '',
        type: 'Común',
        discount: '',
      });
      return;
    }

    setForm({
      firstName: value.firstName || '',
      lastName: value.lastName || '',
      phone: value.phone || '',
      address: value.address || '',
      cedula: value.cedula || '',
      creditLimit: value.creditLimit != null ? String(value.creditLimit) : '',
      type: value.type || 'Común',
      discount: value.discount != null ? String(value.discount) : '',
    });
  };

  useEffect(() => {
    let isMounted = true;

    const loadCustomer = async () => {
      if (customer) {
        applyCustomerToForm(customer);
        return;
      }

      if (!customerId) {
        applyCustomerToForm(null);
        return;
      }

      setLoadingCustomer(true);
      try {
        const fetched = await customersService.getCustomerById(customerId);
        if (isMounted) {
          applyCustomerToForm(fetched);
        }
      } catch (error) {
        console.error('[CustomerFormModal] loadCustomer error:', error);
        if (isMounted) {
          Alert.alert('Error', 'No se pudo cargar el cliente.');
        }
      } finally {
        if (isMounted) {
          setLoadingCustomer(false);
        }
      }
    };

    loadCustomer();

    return () => {
      isMounted = false;
    };
  }, [customer, customerId]);

  const handleClose = () => navigation.goBack();

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.phone.trim()) {
      Alert.alert('Campos requeridos', 'Nombre y teléfono son obligatorios.');
      return;
    }

    if (!canEditCustomer) {
      Alert.alert('No autorizado', 'No tienes permisos para editar este cliente.');
      return;
    }

    if (customer && !canEditSensitive) {
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
      handleClose();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', e.message || 'No se pudo guardar');
    }
  };

  return (
    <SafeAreaView style={[globalStyles.container, localStyles.container]}>
      <View style={globalStyles.header}>
        <TouchableOpacity onPress={handleClose}>
          <Icon name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={globalStyles.title}>{(customer || customerId) ? 'Editar cliente' : 'Nuevo cliente'}</Text>
      </View>

      <ScrollView
        contentContainerStyle={localStyles.formContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {loadingCustomer && (
          <View style={localStyles.loadingRow}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={localStyles.loadingText}>Cargando cliente...</Text>
          </View>
        )}

        <View style={styles.rowBetween}>
          <TextInput
            placeholder="Nombres"
            placeholderTextColor="#999"
            style={[styles.input, { flex: 1, marginRight: 8 }]}
            value={form.firstName}
            onChangeText={(t) => setForm({ ...form, firstName: t })}
          />
          <TextInput
            placeholder="Apellidos"
            placeholderTextColor="#999"
            style={[styles.input, { flex: 1, marginLeft: 8 }]}
            value={form.lastName}
            onChangeText={(t) => setForm({ ...form, lastName: t })}
          />
        </View>

        <View style={styles.rowBetween}>
          <TextInput
            placeholder="Teléfono"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
            style={[styles.input, { flex: 1, marginRight: 8 }]}
            value={form.phone}
            onChangeText={(t) => setForm({ ...form, phone: t })}
          />
          <TextInput
            placeholder="Cédula"
            placeholderTextColor="#999"
            style={[styles.input, { flex: 1, marginLeft: 8 }]}
            value={form.cedula}
            onChangeText={(t) => setForm({ ...form, cedula: t })}
          />
        </View>

        <TextInput
          placeholder="Dirección"
          placeholderTextColor="#999"
          style={styles.input}
          value={form.address}
          onChangeText={(t) => setForm({ ...form, address: t })}
        />

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

        <View style={styles.rowBetween}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.label}>Descuento (%)</Text>
            <TextInput
              placeholder="Ej: 10"
              placeholderTextColor="#999"
              keyboardType="numeric"
              editable={canEditSensitive}
              style={[styles.input, !canEditSensitive && styles.inputDisabled]}
              value={String(form.discount)}
              onChangeText={(t) => setForm({ ...form, discount: t })}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.label}>Límite de crédito</Text>
            <TextInput
              placeholder="0.00"
              placeholderTextColor="#999"
              keyboardType="numeric"
              editable={canEditSensitive}
              style={[styles.input, !canEditSensitive && styles.inputDisabled]}
              value={String(form.creditLimit)}
              onChangeText={(t) => setForm({ ...form, creditLimit: t })}
            />
          </View>
        </View>

        <View style={styles.rowButtons}>
          <TouchableOpacity style={styles.btnPrimary} onPress={handleSave}>
            <Text style={styles.btnText}>Guardar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnCancel} onPress={handleClose}>
            <Text style={styles.btnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  container: {
    backgroundColor: '#F5F6FA',
  },
  formContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  loadingText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 12,
  },
});
