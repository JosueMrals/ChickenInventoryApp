import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import globalStyles from '../../../styles/globalStyles';
import { formatMoney } from '../styles/cashClosingStyles';
import { subscribeCashClosingHistory } from '../services/cashClosingService';
import { formatTimestamp } from '../../returns/utils/format';

const DATE_FILTERS = [
  { key: 'all',   label: 'Todos',  icon: 'view-list-outline' },
  { key: 'today', label: 'Hoy',    icon: 'calendar-today' },
  { key: 'week',  label: '7 días', icon: 'calendar-week' },
  { key: 'month', label: 'Mes',    icon: 'calendar-month-outline' },
];

const STATUS_FILTERS = [
  { key: 'all',       label: 'Todos',     icon: 'format-list-bulleted', color: '#6366F1' },
  { key: 'complete',  label: 'Completos', icon: 'check-circle-outline', color: '#10B981' },
  { key: 'shortage',  label: 'Faltantes', icon: 'alert-circle-outline', color: '#EF4444' },
];

const normalize = (value) => (value || '').toString().toLowerCase().trim();

const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  return new Date(value);
};

const isWithinRange = (dateValue, rangeKey) => {
  if (!rangeKey || rangeKey === 'all') return true;
  const d = toDate(dateValue);
  if (!d || isNaN(d.getTime())) return false;
  const now = new Date();
  if (rangeKey === 'today') return d.toDateString() === now.toDateString();
  if (rangeKey === 'week') { const w = new Date(now); w.setDate(now.getDate() - 7); return d >= w && d <= now; }
  if (rangeKey === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  return true;
};

/* ── HistoryCard ── */
const HistoryCard = ({ item }) => {
  const isShortage = item.status === 'shortage';
  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardName} numberOfLines={1}>{item.userName || 'Usuario'}</Text>
          <Text style={s.cardMeta}>{formatTimestamp(item.closedAt)}</Text>
        </View>
        <View style={[s.pill, isShortage ? s.pillShortage : s.pillComplete]}>
          <Text style={[s.pillText, { color: isShortage ? '#991B1B' : '#065F46' }]}>
            {isShortage ? 'Faltante' : 'Completo'}
          </Text>
        </View>
      </View>

      <View style={s.amountsRow}>
        <View style={[s.amountChip, { backgroundColor: '#F3F4F6' }]}>
          <Text style={[s.amountLabel, { color: '#1F2937' }]}>Esperado</Text>
          <Text style={[s.amountValue, { color: '#1F2937' }]}>{formatMoney(item.expectedAmount)}</Text>
        </View>
        <View style={[s.amountChip, { backgroundColor: '#DCFCE7' }]}>
          <Text style={[s.amountLabel, { color: '#065F46' }]}>Recibido</Text>
          <Text style={[s.amountValue, { color: '#065F46' }]}>{formatMoney(item.receivedAmount)}</Text>
        </View>
        {isShortage && (
          <View style={[s.amountChip, { backgroundColor: '#FEE2E2' }]}>
            <Text style={[s.amountLabel, { color: '#991B1B' }]}>Faltante</Text>
            <Text style={[s.amountValue, { color: '#991B1B' }]}>{formatMoney(item.shortageAmount)}</Text>
          </View>
        )}
      </View>

      {!!item.reviewedBy && (
        <View style={s.reviewHint}>
          <Icon name="account-check-outline" size={12} color="#9CA3AF" />
          <Text style={s.reviewHintText}>Revisado por {item.reviewedBy}</Text>
        </View>
      )}
    </View>
  );
};

/* ── Filter chip ── */
const Chip = ({ label, icon, active, color, onPress }) => (
  <TouchableOpacity onPress={onPress} style={[s.chip, active && { backgroundColor: color, borderColor: color }]}>
    <Icon name={icon} size={12} color={active ? '#fff' : '#6B7280'} />
    <Text style={[s.chipText, active && { color: '#fff' }]}>{label}</Text>
  </TouchableOpacity>
);

/* ── Screen ── */
export default function CashClosingHistoryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, role } = route.params || {};
  const isAdmin = role === 'admin';

  const [closings, setClosings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  useEffect(
    () => subscribeCashClosingHistory(isAdmin ? null : user?.uid, (list) => { setClosings(list); setLoading(false); }),
    [isAdmin, user?.uid],
  );

  const filtered = useMemo(() => {
    const query = normalize(search);
    return closings.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (!isWithinRange(item.closedAt, dateFilter)) return false;
      if (!query) return true;
      const hay = [item.userName, item.expectedAmount, item.receivedAmount].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(query);
    });
  }, [closings, search, statusFilter, dateFilter]);

  return (
    <View style={globalStyles.container}>
      <View style={globalStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="arrow-left" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={globalStyles.title}>Historial</Text>
        <View style={s.countBadge}>
          <Text style={s.countBadgeText}>{filtered.length}</Text>
        </View>
      </View>

      <View style={s.filtersPanel}>
        <View style={s.searchWrap}>
          <Icon name="magnify" size={17} color="#9CA3AF" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por nombre o monto..."
            placeholderTextColor="#9CA3AF"
            style={s.searchInput}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Icon name="close-circle" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        <View style={s.chipRow}>
          {STATUS_FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} icon={f.icon} active={statusFilter === f.key} color={f.color} onPress={() => setStatusFilter(f.key)} />
          ))}
        </View>

        <View style={s.chipRow}>
          {DATE_FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} icon={f.icon} active={dateFilter === f.key} color="#374151" onPress={() => setDateFilter(f.key)} />
          ))}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <HistoryCard item={item} />}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
              <Icon name="file-search-outline" size={40} color="#D1D5DB" />
              <Text style={{ color: '#9CA3AF', fontSize: 13 }}>No hay cierres con esos filtros.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  countBadge: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  countBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  filtersPanel: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 8 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 10, height: 38, gap: 6 },
  searchInput: { flex: 1, fontSize: 13, color: '#111827' },
  chipRow: { flexDirection: 'row', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  chipText: { fontSize: 11, fontWeight: '700', color: '#6B7280' },

  card: { backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#F0F0F0' },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cardName: { fontSize: 13, fontWeight: '700', color: '#1F2937' },
  cardMeta: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  pill: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 2 },
  pillComplete: { backgroundColor: '#D1FAE5' },
  pillShortage: { backgroundColor: '#FEE2E2' },
  pillText: { fontSize: 9, fontWeight: '800' },

  amountsRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  amountChip: { flex: 1, borderRadius: 8, padding: 6, alignItems: 'center' },
  amountLabel: { fontSize: 8, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.2 },
  amountValue: { fontSize: 11, fontWeight: '800', marginTop: 1 },

  reviewHint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reviewHintText: { fontSize: 10, color: '#9CA3AF' },
});
