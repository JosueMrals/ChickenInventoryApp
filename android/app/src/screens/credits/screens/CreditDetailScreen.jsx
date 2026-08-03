import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { firestore } from '../../../services/firebaseConfig';
import globalStyles from '../../../styles/globalStyles';
import CreditDueInfo from '../components/CreditDueInfo';

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value, short = false) => {
  const date = toDate(value);
  if (!date) return 'Sin fecha';
  return short
    ? date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    : date.toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const getCustomerName = (credit) => {
  const n = (credit?.customerName || credit?.clientName || '').trim();
  return n || 'Cliente';
};

export default function CreditDetailScreen({ navigation, route }) {
  const { credit: initialCredit, role } = route.params || {};
  const [credit, setCredit] = useState(initialCredit || null);
  const [loading, setLoading] = useState(!initialCredit);

  useEffect(() => {
    if (!initialCredit?.id) { setLoading(false); return undefined; }
    const unsub = firestore().collection('credits').doc(initialCredit.id).onSnapshot(
      (doc) => {
        setCredit(doc.exists() ? { id: doc.id, ...doc.data() } : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [initialCredit?.id]);

  const payments = useMemo(() => {
    const list = Array.isArray(credit?.payments) ? credit.payments : [];
    return [...list].sort((a, b) => (toDate(b?.date)?.getTime() || 0) - (toDate(a?.date)?.getTime() || 0));
  }, [credit?.payments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F3F7' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!credit) {
    return (
      <View style={globalStyles.container}>
        <View style={globalStyles.header}>
          <TouchableOpacity onPress={() => navigation.navigate('Credits')}>
            <Icon name="arrow-left" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={globalStyles.title}>Detalle de Crédito</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="credit-card-off-outline" size={48} color="#D1D5DB" />
          <Text style={{ color: '#9CA3AF', marginTop: 10 }}>No se encontró el crédito.</Text>
        </View>
      </View>
    );
  }

  const total   = Number(credit.total)   || 0;
  const paid    = Number(credit.paid)    || 0;
  const pending = Number(credit.pending) || 0;
  const progress = total > 0 ? Math.min(paid / total, 1) : 0;
  const isPaid = credit.status === 'paid';
  const name = getCustomerName(credit);
  const initials = name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');

  return (
    <View style={globalStyles.container}>
      {/* Header */}
      <View style={globalStyles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Credits')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="arrow-left" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={globalStyles.title}>Detalle de Crédito</Text>
        <View style={{ width: 26 }} />
      </View>

      <FlatList
        data={payments}
        // Clave derivada del abono, no del índice: la lista va ordenada por fecha
        // descendente, así que un abono nuevo corre a todos los demás de posición y
        // con claves por índice React reasigna cada fila.
        keyExtractor={(p, i) => `${credit.id}-${toDate(p?.date)?.getTime() || i}-${p?.amount ?? i}`}
        contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Summary card */}
            <View style={s.card}>
              {/* Avatar + name + status */}
              <View style={s.cardTop}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{initials || '?'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.customerName}>{name}</Text>
                  <Text style={s.metaText}>#{credit.id?.substring(0, 10).toUpperCase()}</Text>
                </View>
                <View style={[s.statusPill, isPaid ? s.pillPaid : s.pillPending]}>
                  <Text style={[s.statusPillText, { color: isPaid ? '#065F46' : '#991B1B' }]}>
                    {isPaid ? 'Pagado' : 'Pendiente'}
                  </Text>
                </View>
              </View>

              {/* Fecha de pago acordada / atraso */}
              {!isPaid && <CreditDueInfo credit={credit} />}

              {/* Progress bar */}
              <View style={s.progressWrap}>
                <View style={[s.progressBar, { width: `${progress * 100}%` }]} />
              </View>
              <Text style={s.progressLabel}>{Math.round(progress * 100)}% cobrado</Text>

              {/* Amount chips */}
              <View style={s.amountsRow}>
                {[
                  { label: 'Total',     value: total,   color: '#1F2937', bg: '#F3F4F6' },
                  { label: 'Cobrado',   value: paid,    color: '#065F46', bg: '#DCFCE7' },
                  { label: 'Pendiente', value: pending, color: '#991B1B', bg: '#FEE2E2' },
                ].map(({ label, value, color, bg }) => (
                  <View key={label} style={[s.amountChip, { backgroundColor: bg }]}>
                    <Text style={[s.amountLabel, { color }]}>{label}</Text>
                    <Text style={[s.amountValue, { color }]}>C${value.toFixed(2)}</Text>
                  </View>
                ))}
              </View>

              {/* Meta info */}
              <View style={s.metaBlock}>
                <View style={s.metaRow}>
                  <Icon name="calendar-outline" size={13} color="#9CA3AF" />
                  <Text style={s.metaText}>Creado: {formatDate(credit.createdAt, true)}</Text>
                </View>
                {credit.preSaleId && (
                  <View style={s.metaRow}>
                    <Icon name="file-document-outline" size={13} color="#9CA3AF" />
                    <Text style={s.metaText}>Pre-venta: #{credit.preSaleId.substring(0, 8).toUpperCase()}</Text>
                  </View>
                )}
                {role && (
                  <View style={s.metaRow}>
                    <Icon name="shield-account-outline" size={13} color="#9CA3AF" />
                    <Text style={s.metaText}>Rol: {role}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Section title */}
            <View style={s.sectionHeader}>
              <Icon name="cash-multiple" size={15} color="#6B7280" />
              <Text style={s.sectionTitle}>Historial de abonos ({payments.length})</Text>
            </View>
          </>
        }
        renderItem={({ item, index }) => (
          <View style={s.paymentCard}>
            <View style={s.paymentTop}>
              <View style={s.paymentIndex}>
                <Text style={s.paymentIndexText}>{payments.length - index}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.paymentAmount}>C${Number(item?.amount || 0).toFixed(2)}</Text>
                <Text style={s.paymentDate}>{formatDate(item?.date)}</Text>
              </View>
              <View style={s.arrowChip}>
                <Text style={s.arrowChipText}>
                  C${Number(item?.previousPending || 0).toFixed(2)} → C${Number(item?.newPending || 0).toFixed(2)}
                </Text>
              </View>
            </View>
            {item?.by && (
              <View style={s.paymentBy}>
                <Icon name="account-outline" size={12} color="#9CA3AF" />
                <Text style={s.paymentByText}>{item.by}</Text>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 30, gap: 8 }}>
            <Icon name="cash-clock" size={36} color="#D1D5DB" />
            <Text style={{ color: '#9CA3AF', fontSize: 13 }}>Sin abonos registrados aún.</Text>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#ECECEC' },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EBF3FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 16, fontWeight: '800', color: '#007AFF' },
  customerName: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  statusPill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  pillPaid: { backgroundColor: '#D1FAE5' },
  pillPending: { backgroundColor: '#FEE2E2' },
  statusPillText: { fontSize: 10, fontWeight: '800' },

  progressWrap: { height: 6, backgroundColor: '#F0F0F5', borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  progressBar: { height: 6, borderRadius: 4, backgroundColor: '#10B981' },
  progressLabel: { fontSize: 10, color: '#9CA3AF', marginBottom: 12, textAlign: 'right' },

  amountsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  amountChip: { flex: 1, borderRadius: 10, padding: 8, alignItems: 'center' },
  amountLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  amountValue: { fontSize: 13, fontWeight: '800', marginTop: 2 },

  metaBlock: { gap: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 11, color: '#6B7280' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6B7280' },

  paymentCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#F0F0F0' },
  paymentTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  paymentIndex: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EBF3FF', alignItems: 'center', justifyContent: 'center' },
  paymentIndexText: { fontSize: 11, fontWeight: '800', color: '#007AFF' },
  paymentAmount: { fontSize: 15, fontWeight: '800', color: '#1F2937' },
  paymentDate: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  arrowChip: { backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  arrowChipText: { fontSize: 10, fontWeight: '700', color: '#374151' },
  paymentBy: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  paymentByText: { fontSize: 11, color: '#9CA3AF' },
});
