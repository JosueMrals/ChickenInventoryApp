import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import globalStyles from '../../../styles/globalStyles';
import { useCredits } from '../hooks/useCredits';
import CreditDueInfo from '../components/CreditDueInfo';

const DATE_FILTERS = [
  { key: 'all',   label: 'Todos',  icon: 'view-list-outline' },
  { key: 'today', label: 'Hoy',    icon: 'calendar-today' },
  { key: 'week',  label: '7 días', icon: 'calendar-week' },
  { key: 'month', label: 'Mes',    icon: 'calendar-month-outline' },
];

const STATUS_FILTERS = [
  { key: 'all',     label: 'Todos',      icon: 'format-list-bulleted', color: '#6366F1' },
  { key: 'pending', label: 'Pendientes', icon: 'clock-outline',        color: '#F59E0B' },
  { key: 'paid',    label: 'Pagados',    icon: 'check-circle-outline', color: '#10B981' },
];

const normalize = (value) => (value || '').toString().toLowerCase().trim();

const getCreditDate = (credit) => {
  if (credit?.payments?.length) {
    const last = credit.payments[credit.payments.length - 1];
    return last?.date || credit.updatedAt || credit.createdAt;
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
  const d = toDate(dateValue);
  if (!d || isNaN(d.getTime())) return false;
  const now = new Date();
  if (rangeKey === 'today') return d.toDateString() === now.toDateString();
  if (rangeKey === 'week') { const w = new Date(now); w.setDate(now.getDate() - 7); return d >= w && d <= now; }
  if (rangeKey === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  return true;
};

const formatDate = (value) => {
  const d = toDate(value);
  if (!d || isNaN(d.getTime())) return 'Sin fecha';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

/* ── HistoryCard ── */
const HistoryCard = ({ item }) => {
  const name = item.customerName || item.clientName || 'Cliente';
  const total   = Number(item.total)   || 0;
  const paid    = Number(item.paid)    || 0;
  const pending = Number(item.pending) || 0;
  const isPaid  = item.status === 'paid';
  const progress = total > 0 ? Math.min(paid / total, 1) : 0;
  const initials = name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');

  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initials || '?'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardName} numberOfLines={1}>{name}</Text>
          <Text style={s.cardMeta}>#{item.id?.substring(0, 8).toUpperCase()} · {formatDate(getCreditDate(item))}</Text>
        </View>
        <View style={[s.pill, isPaid ? s.pillPaid : s.pillPending]}>
          <Text style={[s.pillText, { color: isPaid ? '#065F46' : '#991B1B' }]}>{isPaid ? 'Pagado' : 'Pendiente'}</Text>
        </View>
      </View>

      {/* Fecha de pago acordada / atraso */}
      {!isPaid && <CreditDueInfo credit={item} compact />}

      {/* Progress bar */}
      <View style={s.progressWrap}>
        <View style={[s.progressBar, { width: `${progress * 100}%`, backgroundColor: isPaid ? '#10B981' : '#F59E0B' }]} />
      </View>

      <View style={s.amountsRow}>
        {[
          { label: 'Total',     value: total,   c: '#1F2937', bg: '#F3F4F6' },
          { label: 'Cobrado',   value: paid,    c: '#065F46', bg: '#DCFCE7' },
          { label: 'Pendiente', value: pending, c: '#991B1B', bg: '#FEE2E2' },
        ].map(({ label, value, c, bg }) => (
          <View key={label} style={[s.amountChip, { backgroundColor: bg }]}>
            <Text style={[s.amountLabel, { color: c }]}>{label}</Text>
            <Text style={[s.amountValue, { color: c }]}>C${value.toFixed(2)}</Text>
          </View>
        ))}
      </View>

      {item.payments?.length > 0 && (
        <View style={s.paymentHint}>
          <Icon name="cash-multiple" size={12} color="#9CA3AF" />
          <Text style={s.paymentHintText}>{item.payments.length} abono{item.payments.length !== 1 ? 's' : ''}</Text>
        </View>
      )}
    </View>
  );
};

/* ── Filter chip ── */
const Chip = ({ label, icon, active, color, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[s.chip, active && { backgroundColor: color, borderColor: color }]}
  >
    <Icon name={icon} size={12} color={active ? '#fff' : '#6B7280'} />
    <Text style={[s.chipText, active && { color: '#fff' }]}>{label}</Text>
  </TouchableOpacity>
);

/* ── Screen ── */
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
      if (filter === 'paid'    && credit.status !== 'paid')    return false;
      if (!isWithinRange(getCreditDate(credit), dateFilter)) return false;
      if (!query) return true;
      const hay = [credit.id, credit.customerName, credit.clientName, credit.total, credit.paid, credit.pending]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(query);
    });
  }, [credits, search, filter, dateFilter]);

  return (
    <View style={globalStyles.container}>
      {/* Header */}
      <View style={globalStyles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Credits')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="arrow-left" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={globalStyles.title}>Historial</Text>
        <View style={s.countBadge}>
          <Text style={s.countBadgeText}>{filtered.length}</Text>
        </View>
      </View>

      {/* Filters panel */}
      <View style={s.filtersPanel}>
        {/* Search */}
        <View style={s.searchWrap}>
          <Icon name="magnify" size={17} color="#9CA3AF" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar cliente, id o monto..."
            placeholderTextColor="#9CA3AF"
            style={s.searchInput}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Icon name="close-circle" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Status filter */}
        <View style={s.chipRow}>
          {STATUS_FILTERS.map(f => (
            <Chip key={f.key} label={f.label} icon={f.icon} active={filter === f.key} color={f.color} onPress={() => setFilter(f.key)} />
          ))}
        </View>

        {/* Date filter */}
        <View style={s.chipRow}>
          {DATE_FILTERS.map(f => (
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
              <Text style={{ color: '#9CA3AF', fontSize: 13 }}>No hay registros con esos filtros.</Text>
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
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EBF3FF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarText: { fontSize: 13, fontWeight: '800', color: '#007AFF' },
  cardName: { fontSize: 13, fontWeight: '700', color: '#1F2937' },
  cardMeta: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  pill: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 2 },
  pillPaid: { backgroundColor: '#D1FAE5' },
  pillPending: { backgroundColor: '#FEE2E2' },
  pillText: { fontSize: 9, fontWeight: '800' },

  progressWrap: { height: 4, backgroundColor: '#F0F0F5', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progressBar: { height: 4, borderRadius: 3 },

  amountsRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  amountChip: { flex: 1, borderRadius: 8, padding: 6, alignItems: 'center' },
  amountLabel: { fontSize: 8, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.2 },
  amountValue: { fontSize: 11, fontWeight: '800', marginTop: 1 },

  paymentHint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  paymentHintText: { fontSize: 10, color: '#9CA3AF' },
});
