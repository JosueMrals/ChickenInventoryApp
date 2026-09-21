import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';

import { getPendingExpensesForReview, EXPENSE_CATEGORIES } from '../services/expenseService';
import { onUsersSnapshot } from '../../users/services/userService';
import { CATEGORY_LABELS } from '../utils/expenseLabels';
import { formatCurrency } from '../../../utils/formatMoney';
import styles, { COLORS } from '../styles/expensesStyles';

// Mismo esquema de filtro por tiempo que useGoodsReceipts (reception) — corte
// calculado en cliente sobre la página ya cargada, sin índices compuestos.
const TIME_FILTERS = [
  { key: 'all', label: 'Todo' },
  { key: 'today', label: 'Hoy' },
  { key: '7d', label: '7 días' },
  { key: '30d', label: '30 días' },
];

function timeThreshold(key, now = new Date()) {
  if (key === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start.getTime();
  }
  if (key === '7d') return now.getTime() - 7 * 24 * 60 * 60 * 1000;
  if (key === '30d') return now.getTime() - 30 * 24 * 60 * 60 * 1000;
  return null;
}

export default function ExpenseReviewScreen({ navigation, route }) {
  const { role } = route.params ?? {};
  const [expenses, setExpenses] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [userFilter, setUserFilter] = useState('ALL');
  const [timeFilter, setTimeFilter] = useState('all');

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const list = await getPendingExpensesForReview();
      list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      setExpenses(list);
    } catch (e) {
      console.error('[ExpenseReview] error cargando gastos:', e);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const unsubscribe = onUsersSnapshot((list) => {
      const map = {};
      list.forEach((u) => {
        map[u.id] = `${u.nombre || ''} ${u.apellido || ''}`.trim() || u.user || u.id;
      });
      setUsersMap(map);
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  const involvedUsers = useMemo(
    () => Array.from(new Set(expenses.map((e) => e.createdByUid).filter(Boolean))),
    [expenses]
  );

  const visible = useMemo(() => {
    const threshold = timeThreshold(timeFilter);
    return expenses.filter((e) => {
      if (categoryFilter !== 'ALL' && e.category !== categoryFilter) return false;
      if (userFilter !== 'ALL' && e.createdByUid !== userFilter) return false;
      if (threshold != null) {
        const millis = e.createdAt?.toMillis?.() ?? null;
        if (millis != null && millis < threshold) return false;
      }
      return true;
    });
  }, [expenses, categoryFilter, userFilter, timeFilter]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('ExpenseDetail', { expenseId: item.id, role })}
    >
      <View style={styles.cardRow}>
        <Text style={styles.cardTitle}>{CATEGORY_LABELS[item.category] || item.category}</Text>
        <Text style={styles.cardAmount}>{formatCurrency(item.amount)}</Text>
      </View>
      <Text style={styles.cardSub}>{usersMap[item.createdByUid] || item.createdByUid}</Text>
      <Text style={styles.cardSub}>
        {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString('es-NI') : ''}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBack} onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Revisar Gastos</Text>
        <View style={styles.headerBack} />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Categoría</Text>
        <View style={styles.chipsRow}>
          {['ALL', ...EXPENSE_CATEGORIES].map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, categoryFilter === c && styles.chipActive]}
              onPress={() => setCategoryFilter(c)}
            >
              <Text style={[styles.chipText, categoryFilter === c && styles.chipTextActive]}>
                {c === 'ALL' ? 'Todas' : CATEGORY_LABELS[c]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {involvedUsers.length > 0 && (
        <View style={styles.formGroup}>
          <Text style={styles.label}>Usuario</Text>
          <View style={styles.chipsRow}>
            {['ALL', ...involvedUsers].map((u) => (
              <TouchableOpacity
                key={u}
                style={[styles.chip, userFilter === u && styles.chipActive]}
                onPress={() => setUserFilter(u)}
              >
                <Text style={[styles.chipText, userFilter === u && styles.chipTextActive]}>
                  {u === 'ALL' ? 'Todos' : (usersMap[u] || u)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.formGroup}>
        <Text style={styles.label}>Fecha</Text>
        <View style={styles.chipsRow}>
          {TIME_FILTERS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.chip, timeFilter === t.key && styles.chipActive]}
              onPress={() => setTimeFilter(t.key)}
            >
              <Text style={[styles.chipText, timeFilter === t.key && styles.chipTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Pendientes de revisión ({visible.length})</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={COLORS.primary} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Icon name="checkmark-done-outline" size={40} color={COLORS.faint} />
              <Text style={styles.emptyText}>No hay gastos pendientes de revisión.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
