import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, Alert, ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  subscribePendingReturnRequests,
  approveReturnRequest,
  rejectReturnRequest,
} from '../../../services/returnService';

const formatTimestamp = (ts) => {
  if (!ts) return '---';
  try {
    const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return '---'; }
};

// ── Modal de detalle y confirmación ──────────────────────────────────────────
function ReturnDetailModal({ visible, request, onClose, onApprove, onReject }) {
  const [rejectionNote, setRejectionNote] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) { setRejectionNote(''); setShowRejectInput(false); }
  }, [visible]);

  if (!request) return null;

  const handleApprove = async () => {
    Alert.alert(
      'Confirmar devolución',
      `¿Confirmar devolución y restituir el inventario de ${(request.items || []).length} producto(s)?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await onApprove(request);
              onClose();
            } catch (e) {
              Alert.alert('Error', e.message || 'No se pudo aprobar la devolución');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await onReject(request.id, rejectionNote);
      onClose();
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo rechazar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  const allItems = [
    ...(request.items || []).map((i) => ({ ...i, _type: 'product' })),
    ...(request.bonuses || []).map((i) => ({ ...i, _type: 'bonus' })),
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modal.backdrop}>
        <View style={modal.card}>
          <View style={modal.header}>
            <Text style={modal.title}>Solicitud de Devolución</Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Icon name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Info */}
            <View style={modal.infoBlock}>
              <Text style={modal.infoLabel}>Cliente</Text>
              <Text style={modal.infoValue}>{request.customerName || 'N/D'}</Text>
              <Text style={modal.infoLabel}>Venta total</Text>
              <Text style={modal.infoValue}>C${(request.saleTotal || 0).toFixed(2)}</Text>
              <Text style={modal.infoLabel}>Solicitado por</Text>
              <Text style={modal.infoValue}>{request.requestedBy} ({request.requestedByRole})</Text>
              <Text style={modal.infoLabel}>Fecha solicitud</Text>
              <Text style={modal.infoValue}>{formatTimestamp(request.requestedAt)}</Text>
            </View>

            {/* Razón */}
            <View style={modal.reasonBlock}>
              <Icon name="document-text-outline" size={16} color="#374151" />
              <Text style={modal.reasonText}>{request.reason}</Text>
            </View>

            {/* Productos a devolver */}
            <Text style={modal.sectionLabel}>Productos a devolver al inventario</Text>
            {allItems.map((item, idx) => (
              <View key={idx} style={modal.itemRow}>
                <View style={modal.itemIcon}>
                  <Icon
                    name={item._type === 'bonus' ? 'gift-outline' : 'cube-outline'}
                    size={16}
                    color={item._type === 'bonus' ? '#6D28D9' : '#374151'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={modal.itemName}>{item.productName || 'Producto'}</Text>
                  <Text style={modal.itemQty}>Cantidad: {item.quantity}</Text>
                </View>
                {item._type === 'product' && (
                  <Text style={modal.itemTotal}>C${(item.total || 0).toFixed(2)}</Text>
                )}
              </View>
            ))}

            {/* Input para rechazo */}
            {showRejectInput && (
              <View style={modal.rejectBlock}>
                <Text style={modal.infoLabel}>Motivo de rechazo (opcional)</Text>
                <TextInput
                  value={rejectionNote}
                  onChangeText={setRejectionNote}
                  placeholder="Describa por qué rechaza la devolución..."
                  placeholderTextColor="#9CA3AF"
                  style={modal.rejectInput}
                  multiline
                  numberOfLines={3}
                  editable={!loading}
                />
              </View>
            )}
          </ScrollView>

          {/* Acciones */}
          {loading ? (
            <ActivityIndicator color="#007AFF" style={{ marginTop: 16 }} />
          ) : (
            <View style={modal.actions}>
              {!showRejectInput ? (
                <>
                  <TouchableOpacity
                    style={modal.rejectBtn}
                    onPress={() => setShowRejectInput(true)}>
                    <Icon name="close-circle-outline" size={18} color="#D92D20" />
                    <Text style={modal.rejectBtnText}>Rechazar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={modal.approveBtn} onPress={handleApprove}>
                    <Icon name="checkmark-circle-outline" size={18} color="#fff" />
                    <Text style={modal.approveBtnText}>Aprobar y devolver stock</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={modal.cancelBtn}
                    onPress={() => setShowRejectInput(false)}>
                    <Text style={modal.cancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={modal.rejectConfirmBtn} onPress={handleReject}>
                    <Text style={modal.rejectBtnText}>Confirmar rechazo</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Tarjeta de solicitud ──────────────────────────────────────────────────────
function ReturnCard({ request, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(request)} activeOpacity={0.85}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardCustomer}>{request.customerName || 'Cliente'}</Text>
          <Text style={styles.cardMeta}>
            {request.requestedByRole?.toUpperCase()} · {formatTimestamp(request.requestedAt)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.cardTotal}>C${(request.saleTotal || 0).toFixed(2)}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Pendiente</Text>
          </View>
        </View>
      </View>
      <View style={styles.reasonRow}>
        <Icon name="document-text-outline" size={14} color="#6B7280" />
        <Text style={styles.reasonText} numberOfLines={2}>{request.reason}</Text>
      </View>
      <View style={styles.itemsRow}>
        <Icon name="cube-outline" size={14} color="#374151" />
        <Text style={styles.itemsText}>
          {(request.items || []).length} producto(s)
          {(request.bonuses || []).length > 0 ? ` + ${request.bonuses.length} bono(s)` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function ReturnRequestsScreen({ routeId = null }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribePendingReturnRequests((docs) => {
      setRequests(docs);
      setLoading(false);
    }, routeId);
    return () => unsub();
  }, [routeId]);

  const handleOpen = useCallback((request) => {
    setSelectedRequest(request);
    setModalVisible(true);
  }, []);

  const handleApprove = useCallback(async (request) => {
    await approveReturnRequest({ returnRequestId: request.id, returnRequest: request });
  }, []);

  const handleReject = useCallback(async (requestId, rejectionNote) => {
    await rejectReturnRequest({ returnRequestId: requestId, rejectionNote });
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ReturnCard request={item} onPress={handleOpen} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.center}>
            <Icon name="return-up-back-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>No hay solicitudes de devolución pendientes.</Text>
          </View>
        }
      />

      <ReturnDetailModal
        visible={modalVisible}
        request={selectedRequest}
        onClose={() => { setModalVisible(false); setSelectedRequest(null); }}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 12, color: '#9CA3AF', fontSize: 14, textAlign: 'center', maxWidth: '70%' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  cardCustomer: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  cardTotal: { fontSize: 16, fontWeight: '800', color: '#374151' },
  badge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#B45309' },
  reasonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 6 },
  reasonText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },
  itemsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemsText: { fontSize: 12, color: '#6B7280' },
});

const modal = StyleSheet.create({
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
  infoBlock: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, marginBottom: 12 },
  infoLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '700', textTransform: 'uppercase', marginTop: 8 },
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
  itemIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: { fontSize: 14, color: '#111827', fontWeight: '500' },
  itemQty: { fontSize: 12, color: '#6B7280' },
  itemTotal: { fontSize: 14, fontWeight: '700', color: '#374151' },
  rejectBlock: { marginTop: 14 },
  rejectInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
    minHeight: 80,
    textAlignVertical: 'top',
    marginTop: 6,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  approveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  rejectBtn: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  rejectBtnText: { color: '#D92D20', fontWeight: '700', fontSize: 14 },
  cancelBtn: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { color: '#374151', fontWeight: '600', fontSize: 14 },
  rejectConfirmBtn: {
    flex: 1,
    backgroundColor: '#D92D20',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

