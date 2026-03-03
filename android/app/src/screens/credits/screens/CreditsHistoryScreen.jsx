import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import styles from '../styles/creditsStyles';
import { useCredits } from '../hooks/useCredits';

const DATE_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: '7 dias' },
  { key: 'month', label: 'Mes' },
];

const normalize = (value) => (value || '').toString().toLowerCase().trim();

const getCreditDate = (credit) => {
  if (credit?.payments?.length) {
    const lastPayment = credit.payments[credit.payments.length - 1];
    return lastPayment?.date || credit.updatedAt || credit.createdAt;
  }
  return credit.updatedAt || credit.createdAt || null;
};

const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  return new Date(value);
};

const isWithinRange = (dateValue, rangeKey) => {
  if (!rangeKey || rangeKey === 'all') return true;
  const baseDate = toDate(dateValue);
  if (!baseDate || Number.isNaN(baseDate.getTime())) return false;

  const now = new Date();
  if (rangeKey === 'today') return baseDate.toDateString() === now.toDateString();

  if (rangeKey === 'week') {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    return baseDate >= weekStart && baseDate <= now;
  }

  if (rangeKey === 'month') {
    return baseDate.getFullYear() === now.getFullYear() && baseDate.getMonth() === now.getMonth();
  }

  return true;
};

const formatDate = (value) => {
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleDateString();
};

const HistoryCard = ({ item }) => {
  const name = item.customerName || item.clientName || 'Cliente';
  const total = Number(item.total) || 0;
  const paid = Number(item.paid) || 0;
  const pending = Number(item.pending) || 0;
  const statusLabel = item.status === 'paid' ? 'Pagado' : 'Pendiente';
  const creditDate = getCreditDate(item);

  return (
    <View style={styles.historyCard}>
      <View style={styles.historyRow}>
        <View style={styles.historyInfo}>
          <Text style={styles.historyTitle}>{name}</Text>
          <Text style={styles.historyMeta}>ID: {item.id?.substring(0, 6).toUpperCase()} · {formatDate(creditDate)}</Text>
        </View>
        <View style={styles.historyRight}>
          <Text style={styles.historyTotal}>C${total.toFixed(2)}</Text>
          <View style={[styles.statusPill, item.status === 'paid' ? styles.statusPaid : styles.statusPending]}>
            <Text style={styles.statusPillText}>{statusLabel}</Text>
          </View>
        </View>
      </View>
      <View style={styles.historyTotalsRow}>
        <Text style={styles.historyAmount}>Pagado: C${paid.toFixed(2)}</Text>
        <Text style={styles.historyAmount}>Pendiente: C${pending.toFixed(2)}</Text>
      </View>
      {item.payments?.length ? (
        <Text style={styles.historyNote}>Abonos: {item.payments.length}</Text>
      ) : null}
    </View>
  );
};

export default function CreditsHistoryScreen({ route }) {
  const navigation = useNavigation();
  const { user, role } = route.params;
  const { loading, credits, filter, setFilter } = useCredits(user, role, 'all');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');

  const filtered = useMemo(() => {
    const query = normalize(search);
    return credits.filter((credit) => {
      if (filter === 'pending' && credit.status !== 'pending') return false;
      if (filter === 'paid' && credit.status !== 'paid') return false;

      const dateValue = getCreditDate(credit);
      if (!isWithinRange(dateValue, dateFilter)) return false;

      if (!query) return true;
      const haystack = [
        credit.id,
        credit.customerName,
        credit.clientName,
        credit.total,
        credit.paid,
        credit.pending,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [credits, search, filter, dateFilter]);

  return (
    <View style={styles.container}>
      <View style={styles.historyHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.historyBack}>
          <Icon name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.historyHeaderTitle}>Historial de Créditos</Text>
      </View>

      <View style={styles.historyFiltersPanel}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por cliente, id o monto"
          placeholderTextColor="#94A3B8"
          style={styles.searchInput}
        />
        <View style={styles.filtersRow}>
          {['all', 'pending', 'paid'].map((item) => (
            <TouchableOpacity
              key={item}
              onPress={() => setFilter(item)}
              style={[styles.filterChip, filter === item && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, filter === item && styles.filterChipTextActive]}>
                {item === 'all' ? 'Todos' : item === 'pending' ? 'Pendientes' : 'Pagados'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.filtersRow}>
          {DATE_FILTERS.map((item) => (
            <TouchableOpacity
              key={item.key}
              onPress={() => setDateFilter(item.key)}
              style={[styles.filterChip, dateFilter === item.key && styles.filterChipActiveDark]}
            >
              <Text style={[styles.filterChipText, dateFilter === item.key && styles.filterChipTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <HistoryCard item={item} />}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="document-text-outline" size={48} color="#CBD5F5" />
              <Text style={styles.emptyText}>No hay registros con esos filtros.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

