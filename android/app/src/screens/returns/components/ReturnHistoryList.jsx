import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { subscribeReturnHistory } from '../../../services/returnService';
import { formatTimestamp } from '../utils/format';

const STATUS_META = {
  approved: { label: 'Aprobada', color: '#16A34A', bg: '#DCFCE7', icon: 'checkmark-circle' },
  rejected: { label: 'Rechazada', color: '#D92D20', bg: '#FEE2E2', icon: 'close-circle' },
};

// ── Modal de detalle de un movimiento ─────────────────────────────────────────
function HistoryDetailModal({ visible, request, onClose }) {
  if (!request) return null;
  const meta = STATUS_META[request.status] || STATUS_META.rejected;
  const verified = request.verifiedItems || null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={m.backdrop}>
        <View style={m.card}>
          <View style={m.header}>
            <Text style={m.title}>Detalle de Devolución</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={[m.statusBanner, { backgroundColor: meta.bg }]}>
              <Icon name={meta.icon} size={20} color={meta.color} />
              <Text style={[m.statusBannerText, { color: meta.color }]}>{meta.label}</Text>
            </View>

            <View style={m.infoBlock}>
              <Text style={m.infoLabel}>Cliente</Text>
              <Text style={m.infoValue}>{request.customerName || 'N/D'}</Text>
              <Text style={m.infoLabel}>Venta total</Text>
              <Text style={m.infoValue}>C${(request.saleTotal || 0).toFixed(2)}</Text>
              {request.routeName ? (
                <>
                  <Text style={m.infoLabel}>Ruta</Text>
                  <Text style={m.infoValue}>{request.routeName}</Text>
                </>
              ) : null}
              <Text style={m.infoLabel}>Solicitado por</Text>
              <Text style={m.infoValue}>{request.requestedBy} ({request.requestedByRole})</Text>
              <Text style={m.infoLabel}>Fecha solicitud</Text>
              <Text style={m.infoValue}>{formatTimestamp(request.requestedAt)}</Text>
              {request.status === 'approved' ? (
                <>
                  <Text style={m.infoLabel}>Aprobada por</Text>
                  <Text style={m.infoValue}>{request.confirmedBy || 'N/D'}</Text>
                  <Text style={m.infoLabel}>Fecha aprobación</Text>
                  <Text style={m.infoValue}>{formatTimestamp(request.confirmedAt)}</Text>
                </>
              ) : (
                <>
                  <Text style={m.infoLabel}>Rechazada por</Text>
                  <Text style={m.infoValue}>{request.rejectedBy || 'N/D'}</Text>
                  <Text style={m.infoLabel}>Fecha rechazo</Text>
                  <Text style={m.infoValue}>{formatTimestamp(request.rejectedAt)}</Text>
                  {request.rejectionNote ? (
                    <>
                      <Text style={m.infoLabel}>Motivo de rechazo</Text>
                      <Text style={m.infoValue}>{request.rejectionNote}</Text>
                    </>
                  ) : null}
                </>
              )}
            </View>

            <View style={m.reasonBlock}>
              <Icon name="document-text-outline" size={16} color="#374151" />
              <Text style={m.reasonText}>{request.reason}</Text>
            </View>

            <Text style={m.sectionLabel}>Productos</Text>
            {verified ? (
              verified.map((item, idx) => (
                <View key={idx} style={m.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={m.itemName}>
                      {item.productName || 'Producto'}{item.isBonus ? ' (regalía)' : ''}
                    </Text>
                    <Text style={m.itemQty}>
                      Esperado: {item.expectedQty} · Recibido: {item.receivedQty}
                    </Text>
                  </View>
                  {item.missingQty > 0 && (
                    <View style={m.missingChip}>
                      <Text style={m.missingChipText}>Faltan {item.missingQty}</Text>
                    </View>
                  )}
                </View>
              ))
            ) : (
              [...(request.items || []), ...(request.bonuses || []).map(b => ({ ...b, isBonus: true }))].map((item, idx) => (
                <View key={idx} style={m.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={m.itemName}>
                      {item.productName || 'Producto'}{item.isBonus ? ' (regalía)' : ''}
                    </Text>
                    <Text style={m.itemQty}>Cantidad: {item.quantity}</Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Tarjeta de historial ──────────────────────────────────────────────────────
function HistoryCard({ request, onPress }) {
  const meta = STATUS_META[request.status] || STATUS_META.rejected;
  const resolvedAt = request.status === 'approved' ? request.confirmedAt : request.rejectedAt;
  return (
    <TouchableOpacity style={s.card} onPress={() => onPress(request)} activeOpacity={0.85}>
      <View style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardCustomer}>{request.customerName || 'Cliente'}</Text>
          <Text style={s.cardMeta}>{formatTimestamp(resolvedAt)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.cardTotal}>C${(request.saleTotal || 0).toFixed(2)}</Text>
          <View style={[s.badge, { backgroundColor: meta.bg }]}>
            <Text style={[s.badgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
      </View>
      <View style={s.metaRow}>
        <Icon name="cube-outline" size={14} color="#374151" />
        <Text style={s.metaText}>{(request.items || []).length} producto(s)</Text>
        {request.hasShortages && (
          <View style={s.shortageChip}>
            <Icon name="alert-circle" size={12} color="#B91C1C" />
            <Text style={s.shortageChipText}>Con faltantes</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Lista principal ───────────────────────────────────────────────────────────
export default function ReturnHistoryList({ routeId = null, requestedByUid = null }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeReturnHistory((docs) => {
      setHistory(docs);
      setLoading(false);
    }, routeId, requestedByUid);
    return () => unsub();
  }, [routeId, requestedByUid]);

  const handleOpen = useCallback((request) => {
    setSelected(request);
    setModalVisible(true);
  }, []);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <HistoryCard request={item} onPress={handleOpen} />}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <View style={s.center}>
            <Icon name="time-outline" size={64} color="#D1D5DB" />
            <Text style={s.emptyText}>Aún no hay devoluciones resueltas.</Text>
          </View>
        }
      />
      <HistoryDetailModal
        visible={modalVisible}
        request={selected}
        onClose={() => { setModalVisible(false); setSelected(null); }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 12, color: '#6B7280', fontSize: 14, textAlign: 'center', maxWidth: '70%' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  cardCustomer: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardMeta: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  cardTotal: { fontSize: 16, fontWeight: '800', color: '#374151' },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: '#6B7280' },
  shortageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  shortageChipText: { fontSize: 10, fontWeight: '700', color: '#B91C1C' },
});

const m = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '90%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  statusBannerText: { fontSize: 15, fontWeight: '800' },
  infoBlock: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, marginBottom: 12 },
  infoLabel: { fontSize: 11, color: '#6B7280', fontWeight: '700', textTransform: 'uppercase', marginTop: 8 },
  infoValue: { fontSize: 14, color: '#111827', fontWeight: '600' },
  reasonBlock: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FEF9C3',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  reasonText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8, textTransform: 'uppercase' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 8,
  },
  itemName: { fontSize: 14, color: '#111827', fontWeight: '500' },
  itemQty: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  missingChip: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  missingChipText: { fontSize: 11, fontWeight: '700', color: '#B91C1C' },
});
