import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import RoleSelector from './RoleSelector';
import { useAdaptiveBottom } from '../../../hooks/useAdaptiveBottom';

const PLACEHOLDER_COLOR = '#9CA3AF';
const EMPTY_FORM = {
  email:           '',
  password:        '',
  confirmPassword: '',
  nombre:          '',
  apellido:        '',
  user:            '',
  cedula:          '',
  telefono:        '',
  role:            'vendedor',
};

const AddUserModal = ({ visible, onClose, onAddUser }) => {
  const [form, setForm]       = useState(EMPTY_FORM);
  const [saving, setSaving]   = useState(false);
  const [showPass, setShowPass]         = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const { bottomPadding } = useAdaptiveBottom();

  useEffect(() => {
    if (visible) {
      setForm(EMPTY_FORM);
      setSaving(false);
      setShowPass(false);
      setShowConfirm(false);
    }
  }, [visible]);

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const validate = () => {
    if (!form.nombre.trim())    return 'El nombre es obligatorio.';
    if (!form.apellido.trim())  return 'El apellido es obligatorio.';
    if (!form.user.trim())      return 'El nombre de usuario es obligatorio.';
    if (!form.email.trim())     return 'El correo electrónico es obligatorio.';
    if (!/\S+@\S+\.\S+/.test(form.email.trim()))
      return 'El formato del correo no es válido.';
    if (!form.password)         return 'La contraseña es obligatoria.';
    if (form.password.length < 6)
      return 'La contraseña debe tener al menos 6 caracteres.';
    if (form.password !== form.confirmPassword)
      return 'Las contraseñas no coinciden.';
    return null;
  };

  const handleAdd = async () => {
    const error = validate();
    if (error) { Alert.alert('Validación', error); return; }

    setSaving(true);
    try {
      const payload = {
        email:    form.email.trim().toLowerCase(),
        password: form.password,
        nombre:   form.nombre.trim(),
        apellido: form.apellido.trim(),
        user:     form.user.trim(),
        role:     form.role,
      };
      if (form.cedula.trim())   payload.cedula   = form.cedula.trim();
      if (form.telefono.trim()) payload.telefono = form.telefono.trim();

      await onAddUser(payload);
      onClose();
    } catch (e) {
      const msg = e?.message || 'No se pudo crear el usuario. Intenta nuevamente.';
      Alert.alert('Error al crear usuario', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}>
        <View style={styles.sheet}>

          {/* Cabecera */}
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHandlebar} />
            <View style={styles.sheetTitleRow}>
              <View style={styles.sheetIconWrap}>
                <Icon name="person-add" size={20} color="#007AFF" />
              </View>
              <Text style={styles.sheetTitle}>Nuevo Usuario</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} disabled={saving}>
                <Icon name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

            {/* ── Datos personales ── */}
            <Text style={styles.groupLabel}>DATOS PERSONALES</Text>

            <View style={styles.rowInputs}>
              <View style={styles.halfField}>
                <Text style={styles.inputLabel}>Nombre *</Text>
                <TextInput
                  style={styles.input}
                  value={form.nombre}
                  onChangeText={(t) => setField('nombre', t)}
                  placeholder="Ej. Juan"
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  editable={!saving}
                />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.inputLabel}>Apellido *</Text>
                <TextInput
                  style={styles.input}
                  value={form.apellido}
                  onChangeText={(t) => setField('apellido', t)}
                  placeholder="Ej. Pérez"
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  editable={!saving}
                />
              </View>
            </View>

            <View style={styles.rowInputs}>
              <View style={styles.halfField}>
                <Text style={styles.inputLabel}>Cédula <Text style={styles.optional}>(opcional)</Text></Text>
                <TextInput
                  style={styles.input}
                  value={form.cedula}
                  onChangeText={(t) => setField('cedula', t)}
                  placeholder="000-000000-0000X"
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  editable={!saving}
                />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.inputLabel}>Teléfono <Text style={styles.optional}>(opcional)</Text></Text>
                <TextInput
                  style={styles.input}
                  value={form.telefono}
                  onChangeText={(t) => setField('telefono', t)}
                  placeholder="+505 0000-0000"
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  keyboardType="phone-pad"
                  editable={!saving}
                />
              </View>
            </View>

            {/* ── Acceso ── */}
            <Text style={[styles.groupLabel, { marginTop: 4 }]}>ACCESO A LA APP</Text>

            <Text style={styles.inputLabel}>Nombre de usuario *</Text>
            <TextInput
              style={styles.input}
              value={form.user}
              onChangeText={(t) => setField('user', t)}
              placeholder="usuario123"
              placeholderTextColor={PLACEHOLDER_COLOR}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!saving}
            />

            <Text style={styles.inputLabel}>Correo electrónico *</Text>
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(t) => setField('email', t)}
              placeholder="correo@ejemplo.com"
              placeholderTextColor={PLACEHOLDER_COLOR}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!saving}
            />

            <Text style={styles.inputLabel}>Contraseña * <Text style={styles.optional}>(mín. 6 caracteres)</Text></Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={styles.passwordInput}
                value={form.password}
                onChangeText={(t) => setField('password', t)}
                placeholder="••••••••"
                placeholderTextColor={PLACEHOLDER_COLOR}
                secureTextEntry={!showPass}
                editable={!saving}
              />
              <TouchableOpacity onPress={() => setShowPass((v) => !v)}>
                <Icon name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Confirmar contraseña *</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={styles.passwordInput}
                value={form.confirmPassword}
                onChangeText={(t) => setField('confirmPassword', t)}
                placeholder="••••••••"
                placeholderTextColor={PLACEHOLDER_COLOR}
                secureTextEntry={!showConfirm}
                editable={!saving}
              />
              <TouchableOpacity onPress={() => setShowConfirm((v) => !v)}>
                <Icon name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* ── Rol ── */}
            <Text style={[styles.groupLabel, { marginTop: 4 }]}>ROL DEL USUARIO</Text>
            <RoleSelector
              selectedRole={form.role}
              onSelectRole={(role) => setField('role', role)}
            />

            {/* Nota informativa */}
            <View style={styles.infoNote}>
              <Icon name="information-circle-outline" size={14} color="#3B82F6" />
              <Text style={styles.infoNoteText}>
                El usuario será creado en Authentication y Firestore automáticamente. Su cuenta estará pre-verificada.
              </Text>
            </View>

          </ScrollView>

          {/* Botones */}
          <View style={[styles.footer, { paddingBottom: Math.max(bottomPadding, 16) }]}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={saving}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createBtn, saving && styles.createBtnDisabled]}
              onPress={handleAdd}
              disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Icon name="person-add-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.createBtnText}>Crear Usuario</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
  },
  sheetHeader: {
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sheetHandlebar: {
    width: 40, height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sheetIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
  },
  sheetTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#1A1A2E' },
  closeBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center', justifyContent: 'center',
  },

  scrollContent: { padding: 16, paddingBottom: 8 },

  groupLabel: {
    fontSize: 10, fontWeight: '800', color: '#94A3B8',
    letterSpacing: 0.8, marginBottom: 10, marginTop: 4,
  },
  inputLabel: {
    fontSize: 11, fontWeight: '700', color: '#64748B',
    textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 5,
  },
  optional: { fontWeight: '500', textTransform: 'none', color: '#94A3B8' },

  rowInputs: { flexDirection: 'row', gap: 10 },
  halfField: { flex: 1 },

  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: '#1A1A2E',
    marginBottom: 12,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  passwordInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: '#1A1A2E' },

  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoNoteText: { flex: 1, fontSize: 12, color: '#1D4ED8', lineHeight: 17 },

  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    paddingBottom: 16, // overridden inline with useAdaptiveBottom
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: { color: '#475569', fontWeight: '700', fontSize: 15 },
  createBtn: {
    flex: 2,
    flexDirection: 'row',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    elevation: 3,
    shadowColor: '#007AFF',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  createBtnDisabled: { backgroundColor: '#A0AEC0', elevation: 0 },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

export default AddUserModal;
