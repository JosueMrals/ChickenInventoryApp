import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import globalStyles from '../../../styles/globalStyles';
import { useUsers } from '../hooks/useUsers';
import { deleteUser as deleteUserService } from '../services/userService';
import { useAdaptiveBottom } from '../../../hooks/useAdaptiveBottom';

const ROLE_COLORS = {
  admin:      { bg: '#EFF6FF', text: '#1D4ED8', icon: 'shield-checkmark' },
  vendedor:   { bg: '#F0FDF4', text: '#16A34A', icon: 'cart' },
  entregador: { bg: '#FFF7ED', text: '#EA580C', icon: 'bicycle' },
  bodeguero:  { bg: '#F5F3FF', text: '#7C3AED', icon: 'cube' },
};

const formatDate = (value) => {
  if (!value) return null;
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('es-NI', { year: 'numeric', month: 'long', day: 'numeric' });
};

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Icon name={icon} size={15} color="#9A93AA" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || 'No registrado'}</Text>
      </View>
    </View>
  );
}

export default function UserDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId, userData: initialUserData, role: currentRole, currentUser } = route.params ?? {};
  const { users, loading, updateUser } = useUsers();
  const { bottomPadding } = useAdaptiveBottom();
  const [deleting, setDeleting] = useState(false);

  const user = users.find((u) => u.id === userId)
    || (initialUserData?.id === userId ? initialUserData : null);

  useEffect(() => {
    if (!loading && !user) {
      Alert.alert('Usuario no encontrado', 'El usuario solicitado ya no existe.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  }, [loading, user]);

  if (!user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const roleColor = ROLE_COLORS[user.role] ?? { bg: '#F1F5F9', text: '#475569', icon: 'person' };
  const initials = `${user.nombre?.charAt(0) ?? ''}${user.apellido?.charAt(0) ?? ''}`.toUpperCase()
    || user.email?.charAt(0)?.toUpperCase() || '?';
  const fullName = [user.nombre, user.apellido].filter(Boolean).join(' ') || 'Sin nombre';
  const isSelf = user.id === currentUser?.uid;

  const handleEdit = () => {
    navigation.navigate('EditUser', { userData: user, onUpdateUser: updateUser });
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar usuario',
      `¿Estás seguro de que quieres eliminar a ${user.email}? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteUserService(user.id);
              Alert.alert('Usuario eliminado', `${user.email} ha sido eliminado.`);
              navigation.goBack();
            } catch (e) {
              Alert.alert('Error', e?.message || 'No se pudo eliminar el usuario.');
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.flex}>
      {/* Header */}
      <View style={globalStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={[globalStyles.title, { flex: 1 }]} numberOfLines={1}>Perfil de usuario</Text>
        <TouchableOpacity onPress={handleEdit} style={styles.headerBtn}>
          <Icon name="create-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPadding + 90 }]}
        showsVerticalScrollIndicator={false}>

        {/* Avatar + info */}
        <View style={styles.avatarCard}>
          <View style={[styles.avatar, { backgroundColor: roleColor.bg }]}>
            <Text style={[styles.avatarText, { color: roleColor.text }]}>{initials}</Text>
          </View>
          <View style={styles.avatarInfo}>
            <Text style={styles.avatarName}>{fullName}</Text>
            <Text style={styles.avatarEmail}>{user.email}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.roleBadge, { backgroundColor: roleColor.bg }]}>
                <Icon name={roleColor.icon} size={11} color={roleColor.text} />
                <Text style={[styles.roleBadgeText, { color: roleColor.text }]}>
                  {user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'N/A'}
                </Text>
              </View>
              <View style={[styles.verifiedBadge, user.verified ? styles.verifiedOk : styles.verifiedPending]}>
                <Icon
                  name={user.verified ? 'checkmark-circle' : 'time-outline'}
                  size={11}
                  color={user.verified ? '#16A34A' : '#B45309'}
                />
                <Text style={[styles.verifiedText, { color: user.verified ? '#16A34A' : '#B45309' }]}>
                  {user.verified ? 'Verificado' : 'Pendiente'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Información de acceso */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionIcon}>
              <Icon name="key-outline" size={16} color="#007AFF" />
            </View>
            <Text style={styles.sectionTitle}>Información de acceso</Text>
          </View>
          <InfoRow icon="at-outline" label="Usuario" value={user.user} />
          <InfoRow icon="mail-outline" label="Correo electrónico" value={user.email} />
        </View>

        {/* Información personal */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIcon, { backgroundColor: '#F5F3FF' }]}>
              <Icon name="person-outline" size={16} color="#7C3AED" />
            </View>
            <Text style={styles.sectionTitle}>Información personal</Text>
          </View>
          <InfoRow icon="card-outline" label="Cédula" value={user.cedula} />
          <InfoRow icon="call-outline" label="Teléfono" value={user.telefono} />
        </View>

        {/* Actividad */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIcon, { backgroundColor: '#FFF7ED' }]}>
              <Icon name="time-outline" size={16} color="#EA580C" />
            </View>
            <Text style={styles.sectionTitle}>Actividad</Text>
          </View>
          <InfoRow icon="calendar-outline" label="Miembro desde" value={formatDate(user.createdAt)} />
          <InfoRow icon="refresh-outline" label="Última actualización" value={formatDate(user.updatedAt)} />
          {!!user.passwordChangedAt && (
            <InfoRow icon="lock-closed-outline" label="Contraseña cambiada" value={formatDate(user.passwordChangedAt)} />
          )}
        </View>
      </ScrollView>

      {/* Footer con acciones */}
      <View style={[styles.footer, { paddingBottom: bottomPadding }]}>
        <TouchableOpacity style={styles.editBtn} onPress={handleEdit}>
          <Icon name="create-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.editBtnText}>Editar perfil</Text>
        </TouchableOpacity>
        {!isSelf && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={deleting}>
            {deleting ? (
              <ActivityIndicator color="#EF4444" size="small" />
            ) : (
              <Icon name="trash-outline" size={18} color="#EF4444" />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F4F1FA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F1FA' },
  scroll: { padding: 14 },

  headerBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)',
  },

  avatarCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#EDE9F7',
    elevation: 6,
  },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarText: { fontSize: 22, fontWeight: '800' },
  avatarInfo: { flex: 1 },
  avatarName: { fontSize: 16, fontWeight: '800', color: '#332F3A', marginBottom: 2 },
  avatarEmail: { fontSize: 12, color: '#7A7488', marginBottom: 7 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '700' },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3,
  },
  verifiedOk: { backgroundColor: '#DCFCE7' },
  verifiedPending: { backgroundColor: '#FEF3E2' },
  verifiedText: { fontSize: 11, fontWeight: '700' },

  section: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#EDE9F7',
    elevation: 6,
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

  footer: {
    flexDirection: 'row', gap: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingTop: 11,
    borderTopWidth: 1.5,
    borderTopColor: '#EDE9F7',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 10,
  },
  editBtn: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },
  editBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  deleteBtn: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#FDF2F2',
    borderWidth: 1.5,
    borderColor: '#F5D9D9',
  },
});
