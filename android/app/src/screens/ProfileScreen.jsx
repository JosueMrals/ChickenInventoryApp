import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { firestore, functions } from '../services/firebaseConfig';
import auth from '@react-native-firebase/auth';
import globalStyles from '../styles/globalStyles';
import { useAdaptiveBottom } from '../hooks/useAdaptiveBottom';

const EMPTY_FORM = { nombre: '', apellido: '', user: '', cedula: '', telefono: '' };

const ROLE_COLORS = {
  admin:      { bg: '#EFF6FF', text: '#1D4ED8', icon: 'shield-checkmark' },
  vendedor:   { bg: '#F0FDF4', text: '#16A34A', icon: 'cart' },
  entregador: { bg: '#FFF7ED', text: '#EA580C', icon: 'bicycle' },
  bodeguero:  { bg: '#F5F3FF', text: '#7C3AED', icon: 'cube' },
};

const formatDate = (value) => {
  if (!value) return null;
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value.seconds ? value.seconds * 1000 : value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('es-NI', { year: 'numeric', month: 'long', day: 'numeric' });
};

function InfoRow({ icon, label, value }) {
  return (
    <View style={ls.infoRow}>
      <View style={ls.infoIconWrap}>
        <Icon name={icon} size={15} color="#9A93AA" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ls.infoLabel}>{label}</Text>
        <Text style={ls.infoValue}>{value || 'No registrado'}</Text>
      </View>
    </View>
  );
}

function EditField({ label, value, onChangeText, placeholder, keyboard, optional }) {
  return (
    <View style={ls.fieldWrap}>
      <Text style={ls.label}>
        {label} {optional && <Text style={ls.optional}>(opcional)</Text>}
      </Text>
      <View style={ls.inputRow}>
        <TextInput
          style={ls.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#B0AABF"
          keyboardType={keyboard}
          autoCapitalize={keyboard ? 'sentences' : 'none'}
        />
      </View>
    </View>
  );
}

export default function ProfileScreen({ route, navigation }) {
  const { user: routeUser, role: routeRole } = route.params || {};
  const [user] = useState(routeUser || auth().currentUser);
  const [role] = useState(routeRole || '');
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const { bottomPadding } = useAdaptiveBottom();

  // Evita que un snapshot en vivo (propio o de un admin editando en paralelo)
  // sobreescriba lo que el usuario está tecleando en modo edición.
  const editingRef = useRef(editing);
  useEffect(() => { editingRef.current = editing; }, [editing]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    setLoading(true);
    const unsubscribe = firestore()
      .collection('users')
      .doc(user.uid)
      .onSnapshot(
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setProfileData(data);
            if (!editingRef.current) {
              setForm({
                nombre: data.nombre || '',
                apellido: data.apellido || '',
                user: data.user || '',
                cedula: data.cedula || '',
                telefono: data.telefono || '',
              });
            }
          }
          setLoading(false);
        },
        (error) => {
          console.error('🔥 Error escuchando perfil:', error);
          setLoading(false);
        }
      );
    return () => unsubscribe();
  }, [user?.uid]);

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const startEditing = () => {
    if (profileData) {
      setForm({
        nombre: profileData.nombre || '',
        apellido: profileData.apellido || '',
        user: profileData.user || '',
        cedula: profileData.cedula || '',
        telefono: profileData.telefono || '',
      });
    }
    setEditing(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.apellido.trim() || !form.user.trim()) {
      Alert.alert('Campos incompletos', 'Nombre, apellido y usuario son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      const updateFn = functions().httpsCallable('updateOwnProfile');
      await updateFn({ data: form });
      setProfileData((prev) => ({ ...prev, ...form }));
      setEditing(false);
      Alert.alert('✅ Perfil actualizado');
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo actualizar el perfil.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro de que deseas cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          await auth().signOut();
          navigation.replace('Login');
        },
      },
    ]);
  };

  const roleKey = (role || profileData?.role || 'user').toLowerCase();
  const roleColor = ROLE_COLORS[roleKey] ?? { bg: '#F1F5F9', text: '#475569', icon: 'person' };
  const initials = `${profileData?.nombre?.charAt(0) ?? ''}${profileData?.apellido?.charAt(0) ?? ''}`.toUpperCase()
    || user?.email?.charAt(0)?.toUpperCase() || '?';
  const fullName = [profileData?.nombre, profileData?.apellido].filter(Boolean).join(' ') || 'Sin nombre';

  return (
    <View style={ls.flex}>
      {/* Header */}
      <View style={globalStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={ls.headerBtn}>
          <Icon name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={[globalStyles.title, { flex: 1 }]} numberOfLines={1}>Mi Perfil</Text>
        {!editing && (
          <TouchableOpacity onPress={startEditing} style={ls.headerBtn}>
            <Icon name="create-outline" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[ls.scroll, { paddingBottom: bottomPadding + 90 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={ls.center}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        ) : (
          <>
            {/* Avatar + info */}
            <View style={ls.avatarCard}>
              <View style={[ls.avatar, { backgroundColor: roleColor.bg }]}>
                <Text style={[ls.avatarText, { color: roleColor.text }]}>{initials}</Text>
              </View>
              <View style={ls.avatarInfo}>
                <Text style={ls.avatarName}>{fullName}</Text>
                <Text style={ls.avatarEmail}>{user?.email}</Text>
                <View style={[ls.roleBadge, { backgroundColor: roleColor.bg }]}>
                  <Icon name={roleColor.icon} size={11} color={roleColor.text} />
                  <Text style={[ls.roleBadgeText, { color: roleColor.text }]}>
                    {roleKey.charAt(0).toUpperCase() + roleKey.slice(1)}
                  </Text>
                </View>
              </View>
            </View>

            {editing ? (
              <View style={ls.section}>
                <View style={ls.sectionTitleRow}>
                  <View style={ls.sectionIcon}>
                    <Icon name="create-outline" size={16} color="#007AFF" />
                  </View>
                  <Text style={ls.sectionTitle}>Editar información</Text>
                </View>

                <View style={ls.row}>
                  <View style={{ flex: 1 }}>
                    <EditField label="Nombre" value={form.nombre} onChangeText={(t) => setField('nombre', t)} placeholder="Nombre" />
                  </View>
                  <View style={{ width: 8 }} />
                  <View style={{ flex: 1 }}>
                    <EditField label="Apellido" value={form.apellido} onChangeText={(t) => setField('apellido', t)} placeholder="Apellido" />
                  </View>
                </View>

                <EditField label="Usuario" value={form.user} onChangeText={(t) => setField('user', t)} placeholder="usuario123" />
                <EditField label="Cédula" value={form.cedula} onChangeText={(t) => setField('cedula', t)} placeholder="000-000000-0000X" optional />
                <EditField label="Teléfono" value={form.telefono} onChangeText={(t) => setField('telefono', t)} placeholder="+505 0000-0000" keyboard="phone-pad" optional />
              </View>
            ) : (
              <>
                <View style={ls.section}>
                  <View style={ls.sectionTitleRow}>
                    <View style={ls.sectionIcon}>
                      <Icon name="key-outline" size={16} color="#007AFF" />
                    </View>
                    <Text style={ls.sectionTitle}>Información de acceso</Text>
                  </View>
                  <InfoRow icon="at-outline" label="Usuario" value={profileData?.user} />
                  <InfoRow icon="mail-outline" label="Correo electrónico" value={user?.email} />
                </View>

                <View style={ls.section}>
                  <View style={ls.sectionTitleRow}>
                    <View style={[ls.sectionIcon, { backgroundColor: '#F5F3FF' }]}>
                      <Icon name="person-outline" size={16} color="#7C3AED" />
                    </View>
                    <Text style={ls.sectionTitle}>Información personal</Text>
                  </View>
                  <InfoRow icon="card-outline" label="Cédula" value={profileData?.cedula} />
                  <InfoRow icon="call-outline" label="Teléfono" value={profileData?.telefono} />
                </View>

                <View style={ls.section}>
                  <View style={ls.sectionTitleRow}>
                    <View style={[ls.sectionIcon, { backgroundColor: '#FFF7ED' }]}>
                      <Icon name="shield-checkmark-outline" size={16} color="#EA580C" />
                    </View>
                    <Text style={ls.sectionTitle}>Cuenta</Text>
                  </View>
                  <InfoRow icon="finger-print-outline" label="ID de usuario" value={user?.uid} />
                  {!!formatDate(profileData?.createdAt) && (
                    <InfoRow icon="calendar-outline" label="Miembro desde" value={formatDate(profileData?.createdAt)} />
                  )}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Footer con acciones */}
      {!loading && (
        <View style={[ls.footer, { paddingBottom: bottomPadding }]}>
          {editing ? (
            <>
              <TouchableOpacity style={ls.btnCancel} onPress={() => setEditing(false)} disabled={saving}>
                <Text style={ls.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ls.btnSave} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <Icon name="save-outline" size={18} color="#fff" />
                    <Text style={ls.btnSaveText}>Guardar</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={ls.btnSave} onPress={startEditing}>
                <Icon name="create-outline" size={18} color="#fff" />
                <Text style={ls.btnSaveText}>Editar perfil</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ls.logoutBtn} onPress={handleLogout}>
                <Icon name="log-out-outline" size={19} color="#EF4444" />
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const ls = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F4F1FA' },
  center: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  scroll: { padding: 14 },
  row: { flexDirection: 'row' },

  headerBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)',
  },

  avatarCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12,
    borderWidth: 1.5, borderColor: '#EDE9F7', elevation: 6,
  },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarText: { fontSize: 22, fontWeight: '800' },
  avatarInfo: { flex: 1 },
  avatarName: { fontSize: 16, fontWeight: '800', color: '#332F3A', marginBottom: 2 },
  avatarEmail: { fontSize: 12, color: '#7A7488', marginBottom: 7 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '700' },

  section: {
    backgroundColor: '#fff', borderRadius: 20, padding: 14, marginBottom: 12,
    borderWidth: 1.5, borderColor: '#EDE9F7', elevation: 6,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  sectionIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#E1EFFF', alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#332F3A', flex: 1 },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  infoIconWrap: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#F4F1FA', alignItems: 'center', justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 10, color: '#9A93AA', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2,
  },
  infoValue: { fontSize: 14, color: '#332F3A', fontWeight: '600' },

  fieldWrap: { marginBottom: 10, flex: 1 },
  label: { fontSize: 11, fontWeight: '700', color: '#635F69', marginBottom: 5, marginLeft: 3 },
  optional: { fontWeight: '500', color: '#9A93AA', textTransform: 'none' },
  inputRow: {
    backgroundColor: '#F4F1FA', borderRadius: 13, paddingHorizontal: 12,
    minHeight: 44, justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#E3DEF5',
  },
  input: { fontSize: 14, color: '#332F3A', fontWeight: '600', padding: 0 },

  footer: {
    flexDirection: 'row', gap: 10, padding: 14,
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 1.5, borderColor: '#EDE9F7', elevation: 10,
  },
  btnSave: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#007AFF', borderRadius: 16, paddingVertical: 14, elevation: 6,
  },
  btnSaveText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  btnCancel: {
    flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16, paddingVertical: 14,
    backgroundColor: '#F4F1FA', borderWidth: 1.5, borderColor: '#E3DEF5',
  },
  btnCancelText: { color: '#635F69', fontSize: 15, fontWeight: '700' },
  logoutBtn: {
    width: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 16,
    backgroundColor: '#FDF2F2', borderWidth: 1.5, borderColor: '#F5D9D9',
  },
});
