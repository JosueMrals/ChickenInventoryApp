import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import globalStyles from '../../../styles/globalStyles';
import { useProductCategories } from '../hooks/useProductCategories';

const MAX_RULES = 5;

function buildEmptyRule() {
  return {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    minQty: '',
  };
}

function normalizeRule(rule = {}) {
  const minQty = Math.max(0, Math.floor(Number(rule.minQty || 0)));
  if (!minQty) return null;
  return {
    minQty,
    active: true,
  };
}

function getRulesFromRow(row = {}) {
  if (Array.isArray(row.activationRules) && row.activationRules.length > 0) {
    return row.activationRules.map((rule) => ({
      id: `${rule.minQty}_${Math.random().toString(16).slice(2)}`,
      minQty: String(rule.minQty || ''),
    }));
  }

  return [buildEmptyRule()];
}

export default function ManageCategoriesScreen({ navigation, route }) {
  const role = route?.params?.role || null;
  const isAdmin = role === 'admin';

  const {
    categoryRows,
    loading,
    saveCategory,
    removeCategory,
    activateCategory,
    hardDeleteCategory,
  } = useProductCategories({ activeOnly: false });

  const [busy, setBusy] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [name, setName] = useState('');
  const [activationRules, setActivationRules] = useState([buildEmptyRule()]);

  const orderedRows = useMemo(() => {
    return [...categoryRows].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [categoryRows]);

  const resetForm = () => {
    setEditingCategoryId(null);
    setName('');
    setActivationRules([buildEmptyRule()]);
  };

  const addRule = () => {
    setActivationRules((prev) => {
      if (prev.length >= MAX_RULES) return prev;
      return [...prev, buildEmptyRule()];
    });
  };

  const removeRule = (ruleId) => {
    setActivationRules((prev) => {
      if (prev.length === 1) return [buildEmptyRule()];
      const next = prev.filter((rule) => rule.id !== ruleId);
      return next.length > 0 ? next : [buildEmptyRule()];
    });
  };

  const patchRule = (ruleId, patch) => {
    setActivationRules((prev) => prev.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)));
  };

  const validateForm = () => {
    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
      Alert.alert('Validacion', 'Ingresa el nombre de la categoria.');
      return null;
    }

    const normalizedRules = activationRules
      .map(normalizeRule)
      .filter(Boolean)
      .sort((a, b) => a.minQty - b.minQty);

    if (normalizedRules.length > MAX_RULES) {
      Alert.alert('Validacion', `Solo se permiten ${MAX_RULES} reglas.`);
      return null;
    }

    const minQtySet = new Set();
    for (const rule of normalizedRules) {
      if (minQtySet.has(rule.minQty)) {
        Alert.alert('Validacion', 'No se permite repetir la misma cantidad minima en reglas distintas.');
        return null;
      }
      minQtySet.add(rule.minQty);
    }

    return {
      id: editingCategoryId,
      name: trimmedName,
      activationRules: normalizedRules,
    };
  };

  const handleSave = async () => {
    if (!isAdmin) return;
    const payload = validateForm();
    if (!payload) return;

    setBusy(true);
    try {
      await saveCategory(payload);
      resetForm();
    } catch (error) {
      console.error('ManageCategories save error:', error);
      Alert.alert('Error', 'No se pudo guardar la categoria.');
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = (row) => {
    setEditingCategoryId(row.id);
    setName(row.name || '');
    setActivationRules(getRulesFromRow(row));
  };

  const handleToggleActive = async (row) => {
    if (!isAdmin || !row?.id) return;
    setBusy(true);
    try {
      if (row.active) {
        await removeCategory(row.id);
      } else {
        await activateCategory(row.id);
      }
    } catch (error) {
      console.error('ManageCategories toggle active error:', error);
      Alert.alert('Error', 'No se pudo actualizar el estado de la categoria.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (row) => {
    if (!isAdmin || !row?.id) return;
    Alert.alert(
      'Eliminar categoria',
      `Se eliminara definitivamente "${row.name}". Esta accion no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await hardDeleteCategory(row.id);
              if (editingCategoryId === row.id) resetForm();
            } catch (error) {
              console.error('ManageCategories delete error:', error);
              Alert.alert('Error', 'No se pudo eliminar la categoria.');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const renderRulesText = (row) => {
    const rules = Array.isArray(row?.activationRules) ? row.activationRules : [];
    if (rules.length === 0) return 'Sin reglas de activacion';

    return rules
      .slice()
      .sort((a, b) => Number(a.minQty || 0) - Number(b.minQty || 0))
      .map((rule) => `${rule.minQty}+ unidades de categoria`)
      .join(' | ');
  };

  const renderRuleItem = (rule, index) => (
    <View key={rule.id} style={styles.ruleCard}>
      <View style={styles.ruleHeaderRow}>
        <Text style={styles.ruleTitle}>Regla #{index + 1}</Text>
        <TouchableOpacity
          style={[styles.ruleDeleteBtn, activationRules.length <= 1 && styles.disabledBtn]}
          onPress={() => removeRule(rule.id)}
          disabled={activationRules.length <= 1}
        >
          <Icon name="trash-outline" size={16} color="#DC2626" />
        </TouchableOpacity>
      </View>

      <Text style={styles.ruleLabel}>Cantidad minima de activacion</Text>
      <TextInput
        style={styles.ruleInput}
        value={rule.minQty}
        onChangeText={(text) => patchRule(rule.id, { minQty: text })}
        keyboardType="number-pad"
        placeholder="Ej. 5"
        placeholderTextColor="#9CA3AF"
      />
    </View>
  );

  const renderRow = ({ item }) => (
    <View style={[styles.rowCard, !item.active && styles.rowCardInactive]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{item.name}</Text>
        <Text style={styles.rowSubtitle}>{renderRulesText(item)}</Text>
        {!item.active && <Text style={styles.rowDisabledBadge}>Inactiva</Text>}
      </View>

      {isAdmin && (
        <View style={styles.rowActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => handleEdit(item)}>
            <Icon name="create-outline" size={18} color="#1D4ED8" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => handleToggleActive(item)}>
            <Icon name={item.active ? 'pause-circle-outline' : 'play-circle-outline'} size={18} color={item.active ? '#F59E0B' : '#16A34A'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(item)}>
            <Icon name="trash-outline" size={18} color="#DC2626" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (!isAdmin) {
    return (
      <View style={globalStyles.container}>
        <View style={globalStyles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={globalStyles.title}>Categorias</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.deniedBox}>
          <Icon name="lock-closed-outline" size={28} color="#6B7280" />
          <Text style={styles.deniedText}>Solo administradores pueden manipular categorias.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={globalStyles.container}>
      <View style={globalStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={globalStyles.title}>Categorias</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView style={styles.formCard} contentContainerStyle={{ paddingBottom: 8 }}>
        <Text style={styles.formTitle}>{editingCategoryId ? 'Editar categoria' : 'Nueva categoria'}</Text>

        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Nombre de categoria"
          placeholderTextColor="#9CA3AF"
        />

        <Text style={styles.sectionLabel}>Reglas de activacion por cantidad (maximo 5)</Text>
        {activationRules.map((rule, index) => renderRuleItem(rule, index))}

        <TouchableOpacity
          style={[styles.addRuleBtn, activationRules.length >= MAX_RULES && styles.disabledBtn]}
          onPress={addRule}
          disabled={activationRules.length >= MAX_RULES}
        >
          <Icon name="add-circle-outline" size={16} color="#2563EB" />
          <Text style={styles.addRuleBtnText}>Agregar regla</Text>
        </TouchableOpacity>

        <View style={styles.formActions}>
          <TouchableOpacity style={styles.clearBtn} onPress={resetForm}>
            <Text style={styles.clearBtnText}>Limpiar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.saveBtn, busy && styles.disabledBtn]} onPress={handleSave} disabled={busy}>
            {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={orderedRows}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No hay categorias registradas.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  formCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    padding: 14,
    maxHeight: 420,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    marginBottom: 10,
  },
  ruleCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
  },
  ruleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  ruleTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  ruleDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  ruleLabel: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '700',
    marginBottom: 4,
  },
  ruleInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  addRuleBtn: {
    marginTop: 2,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingVertical: 8,
    backgroundColor: '#EFF6FF',
  },
  addRuleBtnText: {
    color: '#2563EB',
    fontWeight: '700',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  clearBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  clearBtnText: {
    color: '#374151',
    fontWeight: '700',
  },
  saveBtn: {
    minWidth: 110,
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#007AFF',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  rowCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowCardInactive: {
    opacity: 0.72,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  rowSubtitle: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 2,
  },
  rowDisabledBadge: {
    marginTop: 4,
    fontSize: 11,
    color: '#B45309',
    fontWeight: '700',
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 14,
  },
  deniedBox: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    gap: 8,
  },
  deniedText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
