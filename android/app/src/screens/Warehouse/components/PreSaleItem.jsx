import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const STATUS_CONFIG = {
  pending:                    { label: 'Pendiente',       bg: '#FEF3C7', color: '#92400E', icon: 'time-outline' },
  credit_pending:             { label: 'Pend. Crédito',   bg: '#FEF3C7', color: '#92400E', icon: 'time-outline' },
  preparing:                  { label: 'Preparando',      bg: '#DBEAFE', color: '#1E40AF', icon: 'construct-outline' },
  credit_preparing:           { label: 'Prep. Crédito',   bg: '#DBEAFE', color: '#1E40AF', icon: 'construct-outline' },
  ready_for_delivery:         { label: 'Lista',           bg: '#D1FAE5', color: '#065F46', icon: 'checkmark-circle-outline' },
  credit_ready_for_delivery:  { label: 'Lista Crédito',   bg: '#D1FAE5', color: '#065F46', icon: 'checkmark-circle-outline' },
  dispatched:                 { label: 'En Reparto',      bg: '#E0E7FF', color: '#3730A3', icon: 'bicycle-outline' },
  credit_dispatched:          { label: 'Crédito por Cobrar', bg: '#EDE9FE', color: '#5B21B6', icon: 'card-outline' },
  paid:                       { label: 'Pagada',          bg: '#D1FAE5', color: '#065F46', icon: 'cash-outline' },
};

const PreSaleItem = ({ item, onSelect, customerName }) => {
  const totalItems = (item.items || []).reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
  const totalBonuses = (item.bonuses || []).reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

  const fallbackName = item.customer?.firstName
        ? `${item.customer.firstName} ${item.customer.lastName || ''}`
        : item.customerName || 'Sin nombre';
  const displayName = customerName || fallbackName;

  const cfg = STATUS_CONFIG[item.status] || { label: item.status, bg: '#F3F4F6', color: '#6B7280', icon: 'help-outline' };
  const isCredit = item.paymentMethod === 'credit';

  return (
    <TouchableOpacity style={s.card} activeOpacity={0.8} onPress={() => onSelect(item)}>
      <View style={s.topRow}>
        <View style={[s.statusDot, { backgroundColor: cfg.color }]} />
        <Text style={s.customerName} numberOfLines={1}>{displayName}</Text>
        <View style={[s.badge, { backgroundColor: cfg.bg }]}>
          <Text style={[s.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      <View style={s.metaRow}>
        <View style={s.metaItem}>
          <Icon name="cube-outline" size={13} color="#6B7280" />
          <Text style={s.metaText}>{totalItems} items</Text>
        </View>
        {totalBonuses > 0 && (
          <View style={s.metaItem}>
            <Icon name="gift-outline" size={13} color="#3B82F6" />
            <Text style={[s.metaText, { color: '#3B82F6' }]}>{totalBonuses} regalo</Text>
          </View>
        )}
        {isCredit && (
          <View style={[s.miniTag, { backgroundColor: '#FEF3C7' }]}>
            <Text style={{ fontSize: 9, fontWeight: '700', color: '#92400E' }}>CRÉDITO</Text>
          </View>
        )}
        <Text style={s.dateText}>
          {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : ''}
        </Text>
      </View>

      <View style={s.idRow}>
        <Text style={s.idText}>#{item.id.substring(0, 8).toUpperCase()}</Text>
        <Icon name="chevron-forward" size={14} color="#D1D5DB" />
      </View>
    </TouchableOpacity>
  );
};

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12, marginVertical: 4, marginHorizontal: 2,
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  customerName: { flex: 1, fontSize: 14, fontWeight: '700', color: '#1F2937' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  miniTag: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  dateText: { fontSize: 11, color: '#9CA3AF', marginLeft: 'auto' },
  idRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  idText: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', letterSpacing: 0.5 },
});

export default PreSaleItem;
