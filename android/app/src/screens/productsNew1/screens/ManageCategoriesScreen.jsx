import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import globalStyles from '../../../styles/globalStyles';
import { useProductCategories } from '../hooks/useProductCategories';
import { getUserRole } from '../../../services/auth';
import auth from '@react-native-firebase/auth';

function formatTierSummary(tier) {
  const val = Number(tier.discountValue || 0);
  const prefix = tier.discountType === 'amount' ? 'C$' : '';
  const suffix = tier.discountType === 'percent' ? '%' : '';
  return `${tier.minQty}+ → ${prefix}${val}${suffix}`;
}

export default function ManageCategoriesScreen({ navigation, route }) {
  const [role, setRole] = useState(route?.params?.role || null);
  const [roleLoading, setRoleLoading] = useState(!route?.params?.role);
  const isAdmin = role === 'admin';

  // Verificar rol desde Firestore como fuente de verdad
  useEffect(() => {
    let cancelled = false;
    const currentUser = auth().currentUser;
    if (!currentUser) {
      setRole(null);
      setRoleLoading(false);
      return;
    }
    getUserRole(currentUser.uid, currentUser.email)
      .then((fetchedRole) => {
        if (!cancelled) {
          setRole(fetchedRole);
          setRoleLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setRoleLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const {
    categoryRows,
    loading,
    removeCategory,
    activateCategory,
    hardDeleteCategory,
  } = useProductCategories({ activeOnly: false });

  const [busy, setBusy] = useState(false);

  const orderedRows = useMemo(() => {
    return [...categoryRows].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [categoryRows]);

  // ── Navegación al formulario ────────────────────────────────────────────────
  const goToCreate = () => {
    navigation.navigate('CategoryForm', { role });
  };

  const goToEdit = (category) => {
    navigation.navigate('CategoryForm', { role, category });
  };

  // ── Acciones ────────────────────────────────────────────────────────────────
  const handleToggleActive = async (row) => {
    if (!isAdmin || !row?.id) return;
    setBusy(true);
    try {
      row.active ? await removeCategory(row.id) : await activateCategory(row.id);
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el estado de la categoría.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (row) => {
    if (!isAdmin || !row?.id) return;
    Alert.alert(
      'Eliminar categoría',
      `Se eliminará definitivamente "${row.name}". Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await hardDeleteCategory(row.id);
            } catch {
              Alert.alert('Error', 'No se pudo eliminar la categoría.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  // ── Render de una fila ──────────────────────────────────────────────────────
  const renderRow = ({ item }) => {
    const trs = Array.isArray(item.discountTiers)
      ? [...item.discountTiers].sort((a, b) => a.minQty - b.minQty)
      : [];

    return (
      <View style={[styles.rowCard, !item.active && styles.rowCardInactive]}>
        {/* Info */}
        <View style={styles.rowInfo}>
          <View style={styles.rowTitleRow}>
            <Text style={styles.rowTitle}>{item.name}</Text>
            {!item.active && (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveBadgeText}>Inactiva</Text>
              </View>
            )}
          </View>

          {trs.length > 0 ? (
            <View style={styles.tierChipRow}>
              {trs.map((tier) => (
                <View
                  key={tier.minQty}
                  style={[
                    styles.tierChip,
                    tier.discountType === 'amount' && styles.tierChipAmount,
                  ]}>
                  <Text
                    style={[
                      styles.tierChipText,
                      tier.discountType === 'amount' && styles.tierChipTextAmount,
                    ]}>
                    {formatTierSummary(tier)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.rowSubtitle}>Sin descuentos configurados</Text>
          )}
        </View>

        {/* Acciones */}
        {isAdmin && (
          <View style={styles.rowActions}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => goToEdit(item)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Icon name="create-outline" size={19} color="#1D4ED8" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => handleToggleActive(item)}
              disabled={busy}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Icon
                name={item.active ? 'pause-circle-outline' : 'play-circle-outline'}
                size={19}
                color={item.active ? '#F59E0B' : '#16A34A'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => handleDelete(item)}
              disabled={busy}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Icon name="trash-outline" size={19} color="#DC2626" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // ── Encabezado compartido ───────────────────────────────────────────────────
  const Header = () => (
    <View style={globalStyles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Icon name="chevron-back" size={26} color="#fff" />
      </TouchableOpacity>
      <Text style={globalStyles.title}>Categorías</Text>
      {isAdmin ? (
        <TouchableOpacity style={styles.headerCreateBtn} onPress={goToCreate}>
          <Icon name="add" size={22} color="#fff" />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 26 }} />
      )}
    </View>
  );

  // ── Cargando rol ────────────────────────────────────────────────────────────
  if (roleLoading) {
    return (
      <View style={globalStyles.container}>
        <Header />
        <View style={styles.centeredBox}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </View>
    );
  }

  // ── Sin permiso ─────────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <View style={globalStyles.container}>
        <Header />
        <View style={styles.centeredBox}>
          <Icon name="lock-closed-outline" size={32} color="#6B7280" />
          <Text style={styles.deniedText}>
            Solo administradores pueden gestionar categorías.
          </Text>
        </View>
      </View>
    );
  }

  // ── Vista principal ─────────────────────────────────────────────────────────
  return (
    <View style={globalStyles.container}>
      <Header />

      {loading ? (
        <View style={styles.centeredBox}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={orderedRows}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.listHeaderRow}>
              <Icon name="pricetags-outline" size={14} color="#6B7280" />
              <Text style={styles.listHeaderText}>
                {orderedRows.length} categoría{orderedRows.length !== 1 ? 's' : ''}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Icon name="folder-open-outline" size={36} color="#D1D5DB" />
              <Text style={styles.emptyText}>No hay categorías registradas.</Text>
              <TouchableOpacity style={styles.emptyCreateBtn} onPress={goToCreate}>
                <Icon name="add-circle-outline" size={16} color="#2563EB" />
                <Text style={styles.emptyCreateText}>Crear primera categoría</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* ── FAB Crear ─────────────────────────────────────────────────────── */}
      {isAdmin && !loading && (
        <TouchableOpacity style={styles.fab} onPress={goToCreate} activeOpacity={0.85}>
          <Icon name="add" size={26} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centeredBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  deniedText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
  },
  headerCreateBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Lista ───────────────────────────────────────────────────────────────────
  listContent: {
    padding: 14,
    paddingBottom: 90,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 10,
  },
  listHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  rowCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 13,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  rowCardInactive: { opacity: 0.58 },
  rowInfo: { flex: 1 },
  rowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  rowSubtitle: { fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' },
  inactiveBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  inactiveBadgeText: { fontSize: 10, fontWeight: '700', color: '#92400E' },
  tierChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tierChip: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  tierChipAmount: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  tierChipText: { fontSize: 10, fontWeight: '700', color: '#1D4ED8' },
  tierChipTextAmount: { color: '#059669' },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 6,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  // ── Empty ───────────────────────────────────────────────────────────────────
  emptyBox: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 10,
  },
  emptyText: { color: '#9CA3AF', fontSize: 14, marginTop: 4 },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  emptyCreateText: { color: '#2563EB', fontWeight: '700', fontSize: 13 },
  // ── FAB ─────────────────────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOpacity: 0.40,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 8,
  },
});
