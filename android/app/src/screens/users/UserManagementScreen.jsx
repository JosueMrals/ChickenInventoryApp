import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useUsers } from './hooks/useUsers';
import AddUserModal from './components/AddUserModal';
import globalStyles from '../../styles/globalStyles';
import { useAdaptiveBottom } from '../../hooks/useAdaptiveBottom';

const ROLE_COLORS = {
  admin:      { bg: '#EFF6FF', text: '#1D4ED8', icon: 'shield-checkmark' },
  vendedor:   { bg: '#F0FDF4', text: '#16A34A', icon: 'cart' },
  entregador: { bg: '#FFF7ED', text: '#EA580C', icon: 'bicycle' },
  bodeguero:  { bg: '#F5F3FF', text: '#7C3AED', icon: 'cube' },
};

function UserCard({ item, currentUser, onEdit, onDelete }) {
  const roleColor = ROLE_COLORS[item.role] ?? { bg: '#F1F5F9', text: '#475569', icon: 'person' };
  const initials  = `${item.nombre?.charAt(0) ?? ''}${item.apellido?.charAt(0) ?? ''}`.toUpperCase() || item.email?.charAt(0)?.toUpperCase() || '?';
  const fullName  = [item.nombre, item.apellido].filter(Boolean).join(' ') || '—';
  const isSelf    = item.id === currentUser?.uid;

  return (
    <TouchableOpacity style={styles.card} onPress={() => onEdit(item)} activeOpacity={0.75}>
      {/* Avatar */}
      <View style={[styles.cardAvatar, { backgroundColor: roleColor.bg }]}>
        <Text style={[styles.cardAvatarText, { color: roleColor.text }]}>{initials}</Text>
      </View>

      {/* Info */}
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>{fullName}</Text>
        <Text style={styles.cardEmail} numberOfLines={1}>{item.email}</Text>
        <View style={styles.cardMeta}>
          <View style={[styles.rolePill, { backgroundColor: roleColor.bg }]}>
            <Icon name={roleColor.icon} size={10} color={roleColor.text} />
            <Text style={[styles.rolePillText, { color: roleColor.text }]}>
              {item.role ? item.role.charAt(0).toUpperCase() + item.role.slice(1) : 'N/A'}
            </Text>
          </View>
          <View style={[styles.verifiedPill, item.verified ? styles.verifiedOk : styles.verifiedPending]}>
            <Icon
              name={item.verified ? 'checkmark-circle' : 'time-outline'}
              size={10}
              color={item.verified ? '#16A34A' : '#B45309'}
            />
            <Text style={[styles.verifiedText, { color: item.verified ? '#16A34A' : '#B45309' }]}>
              {item.verified ? 'Verificado' : 'Pendiente'}
            </Text>
          </View>
          {item.cedula ? (
            <Text style={styles.cardSub} numberOfLines={1}>CI: {item.cedula}</Text>
          ) : null}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.editIconBtn} onPress={() => onEdit(item)}>
          <Icon name="create-outline" size={18} color="#007AFF" />
        </TouchableOpacity>
        {!isSelf && (
          <TouchableOpacity style={styles.deleteIconBtn} onPress={() => onDelete(item.id, item.email)}>
            <Icon name="trash-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function UserManagementScreen({ route, navigation }) {
  const { role: currentRole, user: currentUser } = route.params || {};
  const { users, loading, addUser, deleteUser, updateUser } = useUsers();
  const { bottomPadding } = useAdaptiveBottom();

  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (currentRole !== 'admin') {
      Alert.alert('Acceso denegado', 'Solo los administradores pueden ver esta sección.');
      navigation.goBack();
    }
  }, [currentRole, navigation]);

  if (currentRole !== 'admin') return null;

  const handleEditPress = (user) => {
    navigation.navigate('EditUser', { userData: user, onUpdateUser: updateUser });
  };

  // Filtro de búsqueda
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      (u.nombre?.toLowerCase()   ?? '').includes(q) ||
      (u.apellido?.toLowerCase() ?? '').includes(q) ||
      (u.email?.toLowerCase()    ?? '').includes(q) ||
      (u.user?.toLowerCase()     ?? '').includes(q) ||
      (u.role?.toLowerCase()     ?? '').includes(q),
    );
  }, [users, searchQuery]);

  const stats = useMemo(() => {
    const total   = users.length;
    const active  = users.filter((u) => u.verified).length;
    const byRole  = users.reduce((acc, u) => {
      acc[u.role] = (acc[u.role] ?? 0) + 1;
      return acc;
    }, {});
    return { total, active, byRole };
  }, [users]);

  const renderEmpty = () => {
    if (loading) return <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 40 }} />;
    return (
      <View style={styles.emptyContainer}>
        <Icon name="people-outline" size={64} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>
          {searchQuery ? 'Sin resultados' : 'Sin usuarios'}
        </Text>
        <Text style={styles.emptyDesc}>
          {searchQuery
            ? `No se encontraron usuarios para "${searchQuery}"`
            : 'Agrega el primer usuario con el botón +'}
        </Text>
      </View>
    );
  };

  return (
    <View style={globalStyles.container}>
      {/* Header */}
      <View style={[globalStyles.header, styles.header]}>
        <TouchableOpacity onPress={() => navigation.openDrawer()}>
          <Icon name="menu" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={[globalStyles.title, { flex: 1 }]}>Usuarios</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{stats.total}</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Icon name="people" size={14} color="#007AFF" />
          <Text style={styles.statText}>{stats.total} total</Text>
        </View>
        <View style={styles.statChip}>
          <Icon name="checkmark-circle" size={14} color="#16A34A" />
          <Text style={styles.statText}>{stats.active} verificados</Text>
        </View>
        {Object.entries(stats.byRole).map(([role, count]) => {
          const c = ROLE_COLORS[role] ?? { bg: '#F1F5F9', text: '#475569' };
          return (
            <View key={role} style={[styles.statChip, { backgroundColor: c.bg }]}>
              <Text style={[styles.statText, { color: c.text }]}>
                {count} {role}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Búsqueda */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Icon name="search" size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre, correo o rol..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Lista */}
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <UserCard
            item={item}
            currentUser={currentUser}
            onEdit={handleEditPress}
            onDelete={deleteUser}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: bottomPadding + 80, flexGrow: 1 }}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: bottomPadding + 20 }]}
        onPress={() => setAddModalVisible(true)}>
        <Icon name="person-add-outline" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Modal agregar */}
      <AddUserModal
        visible={isAddModalVisible}
        onClose={() => setAddModalVisible(false)}
        onAddUser={addUser}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 0 },
  headerBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    minWidth: 28,
    alignItems: 'center',
  },
  headerBadgeText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statText: { fontSize: 11, fontWeight: '700', color: '#475569' },

  /* Search */
  searchSection: {
    backgroundColor: '#F7F9FC',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1A1A2E' },

  /* User Card */
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  cardAvatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardAvatarText: { fontSize: 18, fontWeight: '800' },
  cardInfo: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#1A1A2E', marginBottom: 1 },
  cardEmail: { fontSize: 12, color: '#64748B', marginBottom: 5 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center' },
  cardSub: { fontSize: 10, color: '#94A3B8', fontWeight: '500' },

  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  rolePillText: { fontSize: 10, fontWeight: '700' },

  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  verifiedOk: { backgroundColor: '#DCFCE7' },
  verifiedPending: { backgroundColor: '#FEF3C7' },
  verifiedText: { fontSize: 10, fontWeight: '700' },

  cardActions: { gap: 6, alignItems: 'center' },
  editIconBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
  },
  deleteIconBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#FEF2F2',
    alignItems: 'center', justifyContent: 'center',
  },

  /* Empty */
  emptyContainer: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#9CA3AF' },
  emptyDesc: { fontSize: 13, color: '#C4C9D4', textAlign: 'center', maxWidth: 260 },

  /* FAB */
  fab: {
    position: 'absolute',
    right: 20,
    backgroundColor: '#007AFF',
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#007AFF',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});

