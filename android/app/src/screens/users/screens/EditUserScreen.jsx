import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import globalStyles from '../../../styles/globalStyles';
import RoleSelector from '../components/RoleSelector';
import { useAdaptiveBottom } from '../../../hooks/useAdaptiveBottom';

const PLACEHOLDER_COLOR = '#9CA3AF';

const ROLE_COLORS = {
  admin:      { bg: '#EFF6FF', text: '#1D4ED8' },
  vendedor:   { bg: '#F0FDF4', text: '#16A34A' },
  entregador: { bg: '#FFF7ED', text: '#EA580C' },
  bodeguero:  { bg: '#F5F3FF', text: '#7C3AED' },
};

export default function EditUserScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userData, onUpdateUser } = route.params ?? {};
  const { bottomPadding } = useAdaptiveBottom();

  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({
    nombre:          '',
    apellido:        '',
    user:            '',
    cedula:          '',
    telefono:        '',
    role:            'vendedor',
    password:        '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (userData) {
      setForm({
        nombre:          userData.nombre          || '',
        apellido:        userData.apellido         || '',
        user:            userData.user             || '',
        cedula:          userData.cedula           || '',
        telefono:        userData.telefono         || '',
        role:            userData.role             || 'vendedor',
        password:        '',
        confirmPassword: '',
      });
    }
  }, [userData]);

  const setField = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    const { password, confirmPassword } = form;

    if (password || confirmPassword) {
      if (password !== confirmPassword) {
        Alert.alert('Error', 'Las contraseñas no coinciden.');
        return;
      }
      if (password.length < 6) {
        Alert.alert('Error', 'La nueva contraseña debe tener al menos 6 caracteres.');
        return;
      }
    }

    setSaving(true);
    try {
      await onUpdateUser(userData.id, form);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo actualizar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  const roleColor = ROLE_COLORS[form.role] ?? { bg: '#F1F5F9', text: '#475569' };
  const initials = `${form.nombre?.charAt(0) ?? ''}${form.apellido?.charAt(0) ?? ''}`.toUpperCase() || '??';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex}>

      {/* Header */}
      <View style={globalStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Icon name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={[globalStyles.title, { flex: 1 }]} numberOfLines={1}>Editar Usuario</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPadding + 90 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* Avatar + info */}
        <View style={styles.avatarCard}>
          <View style={[styles.avatar, { backgroundColor: roleColor.bg }]}>
            <Text style={[styles.avatarText, { color: roleColor.text }]}>{initials}</Text>
          </View>
          <View style={styles.avatarInfo}>
            <Text style={styles.avatarName}>
              {form.nombre || form.apellido
                ? `${form.nombre} ${form.apellido}`.trim()
                : 'Sin nombre'}
            </Text>
            <Text style={styles.avatarEmail}>{userData?.email}</Text>
            <View style={[styles.roleBadge, { backgroundColor: roleColor.bg }]}>
              <Text style={[styles.roleBadgeText, { color: roleColor.text }]}>
                {form.role.charAt(0).toUpperCase() + form.role.slice(1)}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Información Personal ── */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionIcon}>
              <Icon name="person-outline" size={17} color="#007AFF" />
            </View>
            <Text style={styles.sectionTitle}>Información Personal</Text>
          </View>

          <View style={styles.rowInputs}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Nombre</Text>
              <TextInput
                style={styles.input}
                value={form.nombre}
                onChangeText={(t) => setField('nombre', t)}
                placeholder="Nombre"
                placeholderTextColor={PLACEHOLDER_COLOR}
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Apellido</Text>
              <TextInput
                style={styles.input}
                value={form.apellido}
                onChangeText={(t) => setField('apellido', t)}
                placeholder="Apellido"
                placeholderTextColor={PLACEHOLDER_COLOR}
              />
            </View>
          </View>

          <Text style={styles.label}>Usuario (nombre de acceso)</Text>
          <TextInput
            style={styles.input}
            value={form.user}
            onChangeText={(t) => setField('user', t)}
            placeholder="usuario123"
            placeholderTextColor={PLACEHOLDER_COLOR}
            autoCapitalize="none"
          />

          <View style={styles.rowInputs}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Cédula <Text style={styles.optional}>(opcional)</Text></Text>
              <TextInput
                style={styles.input}
                value={form.cedula}
                onChangeText={(t) => setField('cedula', t)}
                placeholder="000-000000-0000X"
                placeholderTextColor={PLACEHOLDER_COLOR}
                keyboardType="default"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Teléfono <Text style={styles.optional}>(opcional)</Text></Text>
              <TextInput
                style={styles.input}
                value={form.telefono}
                onChangeText={(t) => setField('telefono', t)}
                placeholder="+505 0000-0000"
                placeholderTextColor={PLACEHOLDER_COLOR}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </View>

        {/* ── Rol ── */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIcon, { backgroundColor: '#F5F3FF' }]}>
              <Icon name="shield-checkmark-outline" size={17} color="#7C3AED" />
            </View>
            <Text style={styles.sectionTitle}>Rol del Usuario</Text>
          </View>
          <RoleSelector selectedRole={form.role} onSelectRole={(r) => setField('role', r)} />
        </View>

        {/* ── Cambiar contraseña ── */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIcon, { backgroundColor: '#FFF7ED' }]}>
              <Icon name="lock-closed-outline" size={17} color="#EA580C" />
            </View>
            <Text style={styles.sectionTitle}>Cambiar Contraseña</Text>
            <Text style={styles.optionalBadge}>Opcional</Text>
          </View>
          <Text style={styles.helperText}>
            Deja en blanco para mantener la contraseña actual.
          </Text>

          <Text style={styles.label}>Nueva contraseña</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              style={styles.passwordInput}
              value={form.password}
              onChangeText={(t) => setField('password', t)}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor={PLACEHOLDER_COLOR}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
              <Icon name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Confirmar contraseña</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              style={styles.passwordInput}
              value={form.confirmPassword}
              onChangeText={(t) => setField('confirmPassword', t)}
              placeholder="Repetir contraseña"
              placeholderTextColor={PLACEHOLDER_COLOR}
              secureTextEntry={!showConfirm}
            />
            <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} style={styles.eyeBtn}>
              <Icon name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      {/* Botón fijo inferior */}
      <View style={[styles.footer, { paddingBottom: bottomPadding }]}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Icon name="save-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.saveBtnText}>Guardar Cambios</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F5F6FA' },
  scroll: { padding: 16 },

  /* Avatar card */
  avatarCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 22, fontWeight: '800' },
  avatarInfo: { flex: 1 },
  avatarName: { fontSize: 17, fontWeight: '800', color: '#1A1A2E', marginBottom: 2 },
  avatarEmail: { fontSize: 13, color: '#64748B', marginBottom: 6 },
  roleBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  roleBadgeText: { fontSize: 12, fontWeight: '700' },

  /* Sections */
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  sectionIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A2E', flex: 1 },
  optionalBadge: {
    fontSize: 11, fontWeight: '700', color: '#94A3B8',
    backgroundColor: '#F1F5F9', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },

  /* Inputs */
  label: {
    fontSize: 11, color: '#64748B', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6,
  },
  optional: { fontWeight: '500', textTransform: 'none', color: '#94A3B8' },
  helperText: { fontSize: 12, color: '#94A3B8', marginBottom: 12 },
  input: {
    backgroundColor: '#F5F6FA',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#1A1A2E',
    marginBottom: 12,
  },
  rowInputs: { flexDirection: 'row', gap: 10 },
  halfInput: { flex: 1 },

  /* Password field */
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F6FA',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    marginBottom: 12,
    paddingRight: 10,
  },
  passwordInput: { flex: 1, padding: 12, fontSize: 15, color: '#1A1A2E' },
  eyeBtn: { padding: 6 },

  /* Footer */
  footer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -3 },
    paddingBottom: 20,
    borderRadius: 14,
  },
  saveBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#007AFF',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  saveBtnDisabled: { backgroundColor: '#A0AEC0', elevation: 0 },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});

