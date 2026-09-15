import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSuppliers } from '../hooks/useSuppliers';
import styles, { COLORS } from '../styles/receptionStyles';

const EMPTY_FORM = { id: null, name: '', phone: '', address: '', notes: '' };

export default function ManageSuppliersScreen({ navigation, route }) {
  const { role } = route?.params ?? {};
  const insets = useSafeAreaInsets();
  const isAdmin = role === 'admin';
  const { suppliers, loading, saveSupplier, removeSupplier } = useSuppliers();

  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const openCreate = () => { setForm(EMPTY_FORM); setFormVisible(true); };
  const openEdit = (supplier) => {
    setForm({
      id: supplier.id,
      name: supplier.name || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
    });
    setFormVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Falta el nombre', 'Ingresa el nombre del proveedor.');
      return;
    }
    setSaving(true);
    try {
      await saveSupplier(form);
      setFormVisible(false);
    } catch (err) {
      Alert.alert('Error', err?.message || 'No se pudo guardar el proveedor.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (supplier) => {
    Alert.alert(
      'Eliminar proveedor',
      `Se eliminará "${supplier.name}". Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeSupplier(supplier.id);
            } catch (err) {
              Alert.alert('Error', err?.message || 'No se pudo eliminar el proveedor.');
            }
          },
        },
      ],
    );
  };

  const renderSupplier = ({ item }) => (
    <View style={styles.rowCard}>
      <View style={styles.rowIconWrap}>
        <Icon name="business-outline" size={20} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
        {(item.phone || item.address) && (
          <Text style={styles.productStock} numberOfLines={1}>
            {[item.phone, item.address].filter(Boolean).join('  ·  ')}
          </Text>
        )}
      </View>
      {isAdmin && (
        <View style={styles.rowActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(item)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Icon name="create-outline" size={19} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(item)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Icon name="trash-outline" size={19} color={COLORS.red} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Proveedores</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={suppliers}
          keyExtractor={(item) => item.id}
          renderItem={renderSupplier}
          contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Icon name="business-outline" size={48} color={COLORS.faint} />
              <Text style={styles.emptyText}>
                {isAdmin ? 'Aún no hay proveedores. Toca + para registrar el primero.' : 'Aún no hay proveedores registrados.'}
              </Text>
            </View>
          }
        />
      )}

      {isAdmin && (
        <TouchableOpacity style={styles.fab} onPress={openCreate}>
          <Icon name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      <Modal visible={formVisible} transparent animationType="slide" onRequestClose={() => setFormVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{form.id ? 'Editar proveedor' : 'Nuevo proveedor'}</Text>
              <TouchableOpacity onPress={() => setFormVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="close" size={26} color={COLORS.ink} />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 16, paddingBottom: 20 }}>
              <Text style={styles.label}>Nombre *</Text>
              <TextInput
                style={styles.input}
                placeholder="Nombre del proveedor"
                placeholderTextColor={COLORS.muted}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              />

              <Text style={styles.label}>Teléfono</Text>
              <TextInput
                style={styles.input}
                placeholder="Teléfono"
                placeholderTextColor={COLORS.muted}
                value={form.phone}
                onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Dirección</Text>
              <TextInput
                style={styles.input}
                placeholder="Dirección"
                placeholderTextColor={COLORS.muted}
                value={form.address}
                onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
              />

              <Text style={styles.label}>Notas</Text>
              <TextInput
                style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
                placeholder="Notas (opcional)"
                placeholderTextColor={COLORS.muted}
                value={form.notes}
                onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
                multiline
              />

              <TouchableOpacity
                style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.primaryBtnText}>{saving ? 'Guardando…' : 'Guardar'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setFormVisible(false)}>
                <Text style={styles.ghostBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
