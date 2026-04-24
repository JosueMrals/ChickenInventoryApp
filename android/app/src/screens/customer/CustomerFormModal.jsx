import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert, ScrollView,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as customersService from '../../services/customersService';
import globalStyles from '../../styles/globalStyles';
import ls from './styles/customerFormStyles';

const Field = React.memo(({ icon, label, value, onChangeText, placeholder, keyboard, editable = true, half }) => (
  <View style={[ls.fieldWrap, half && { flex: 1 }]}>
    <Text style={ls.label}>{label}</Text>
    <View style={[ls.inputRow, !editable && ls.inputDisabled]}>
      {icon && <Icon name={icon} size={18} color={editable ? '#007AFF' : '#bbb'} style={{ marginRight: 8 }} />}
      <TextInput
        placeholder={placeholder}
        placeholderTextColor="#bbb"
        keyboardType={keyboard}
        editable={editable}
        value={value}
        onChangeText={onChangeText}
        style={ls.input}
      />
    </View>
  </View>
));

export default function CustomerFormModal({ navigation, route }) {
  const { customer, customerId, role = 'vendedor' } = route?.params || {};
  const isEditing = !!(customer || customerId);

  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', address: '',
    cedula: '', creditLimit: '', type: 'Común', discount: '',
  });
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [saving, setSaving] = useState(false);

  const canEditSensitive = role === 'admin';
  const canEditCustomer = role === 'admin' || role === 'vendedor';

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const applyCustomerToForm = (value) => {
    if (!value) {
      setForm({ firstName: '', lastName: '', phone: '', address: '', cedula: '', creditLimit: '', type: 'Común', discount: '' });
      return;
    }
    setForm({
      firstName: value.firstName || '', lastName: value.lastName || '',
      phone: value.phone || '', address: value.address || '',
      cedula: value.cedula || '',
      creditLimit: value.creditLimit != null ? String(value.creditLimit) : '',
      type: value.type || 'Común',
      discount: value.discount != null ? String(value.discount) : '',
    });
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      if (customer) { applyCustomerToForm(customer); return; }
      if (!customerId) { applyCustomerToForm(null); return; }
      setLoadingCustomer(true);
      try {
        const fetched = await customersService.getCustomerById(customerId);
        if (alive) applyCustomerToForm(fetched);
      } catch (e) {
        if (alive) Alert.alert('Error', 'No se pudo cargar el cliente.');
      } finally {
        if (alive) setLoadingCustomer(false);
      }
    })();
    return () => { alive = false; };
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
      if (parseFloat(form.creditLimit || 0) !== (customer.creditLimit ?? 0)) {
        Alert.alert('No autorizado', 'Solo admin puede cambiar el límite de crédito.'); return;
      }
      if (parseFloat(form.discount || 0) !== (customer.discount ?? 0)) {
        Alert.alert('No autorizado', 'Solo admin puede cambiar el descuento.'); return;
      }
    }

    const payload = {
      firstName: form.firstName.trim(), lastName: form.lastName.trim(),
      phone: form.phone.trim(), address: form.address.trim(),
      cedula: form.cedula.trim(),
      creditLimit: parseFloat(form.creditLimit) || 0,
      type: form.type, discount: parseFloat(form.discount) || 0,
    };

    setSaving(true);
    try {
      if (customer) await customersService.updateCustomer(customer.id, payload);
      else await customersService.createCustomer(payload);
      Alert.alert('✅ Cliente guardado');
      handleClose();
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };


  const customerTypes = ['Común', 'Semi-mayorista', 'Mayorista'];

  return (
    <SafeAreaView style={ls.safe}>
      {/* Header */}
      <View style={globalStyles.header}>
        <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={globalStyles.title}>{isEditing ? 'Editar cliente' : 'Nuevo cliente'}</Text>
      </View>

      <ScrollView contentContainerStyle={ls.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {loadingCustomer && (
          <View style={ls.loadingRow}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={ls.loadingText}>Cargando...</Text>
          </View>
        )}

        {/* ── Información personal ── */}
        <Text style={ls.sectionTitle}>Información personal</Text>
        <View style={ls.card}>
          <View style={ls.row}>
            <Field icon="account" label="Nombres" value={form.firstName} onChangeText={set('firstName')} placeholder="Nombres" half />
            <View style={{ width: 10 }} />
            <Field icon="account-outline" label="Apellidos" value={form.lastName} onChangeText={set('lastName')} placeholder="Apellidos" half />
          </View>
          <View style={ls.row}>
            <Field icon="phone" label="Teléfono *" value={form.phone} onChangeText={set('phone')} placeholder="8888-0000" keyboard="phone-pad" half />
            <View style={{ width: 10 }} />
            <Field icon="card-account-details-outline" label="Cédula" value={form.cedula} onChangeText={set('cedula')} placeholder="000-000000-0000X" half />
          </View>
          <Field icon="map-marker-outline" label="Dirección" value={form.address} onChangeText={set('address')} placeholder="Dirección del cliente" />
        </View>

        {/* ── Tipo de cliente ── */}
        <Text style={ls.sectionTitle}>Tipo de cliente</Text>
        <View style={ls.card}>
          <View style={ls.typesRow}>
            {customerTypes.map((t) => {
              const active = form.type === t;
              return (
                <TouchableOpacity key={t} onPress={() => set('type')(t)} style={[ls.typeChip, active && ls.typeChipActive]}>
                  <Icon name={active ? 'check-circle' : 'circle-outline'} size={16} color={active ? '#fff' : '#999'} />
                  <Text style={[ls.typeChipText, active && ls.typeChipTextActive]}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Configuración financiera ── */}
        <Text style={ls.sectionTitle}>Configuración financiera</Text>
        <View style={ls.card}>
          {!canEditSensitive && (
            <View style={ls.lockBanner}>
              <Icon name="lock-outline" size={14} color="#FF9500" />
              <Text style={ls.lockText}>Solo admin puede modificar estos campos</Text>
            </View>
          )}
          <View style={ls.row}>
            <Field icon="percent" label="Descuento (%)" value={String(form.discount)} onChangeText={set('discount')} placeholder="0" keyboard="numeric" editable={canEditSensitive} half />
            <View style={{ width: 10 }} />
            <Field icon="cash" label="Límite de crédito" value={String(form.creditLimit)} onChangeText={set('creditLimit')} placeholder="0.00" keyboard="numeric" editable={canEditSensitive} half />
          </View>
        </View>

        {/* ── Botones ── */}
        <TouchableOpacity style={ls.btnSave} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : (
            <>
              <Icon name="content-save-outline" size={20} color="#fff" />
              <Text style={ls.btnSaveText}>Guardar cliente</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={ls.btnCancel} onPress={handleClose} activeOpacity={0.8}>
          <Text style={ls.btnCancelText}>Cancelar</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

