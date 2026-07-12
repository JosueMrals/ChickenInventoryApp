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
  buildItemKey,
} from '../../../services/returnService';
import { formatTimestamp } from '../utils/format';

// ── Fila de verificación de cantidad por producto ────────────────────────────
function VerifyItemRow({ item, itemKey, received, onChange, disabled }) {
  const expected = Number(item.quantity) || 0;
  const missing = expected - received;

  const setClamped = (value) => {
    const n = Math.max(0, Math.min(expected, Math.round(Number(value) || 0)));
    onChange(itemKey, n);
  };

  return (
    <View style={verify.row}>
      <View style={verify.rowInfo}>
        <Text style={verify.rowName} numberOfLines={1}>
          {item.productName || 'Producto'}{item._type === 'bonus' ? ' (regalía)' : ''}
        </Text>
        <Text style={verify.rowExpected}>Esperado: {expected}</Text>
        {missing > 0 && (
          <Text style={verify.rowMissing}>Faltan {missing}</Text>
        )}
      </View>
      <View style={verify.stepper}>
        <TouchableOpacity
          style={verify.stepBtn}
          onPress={() => setClamped(received - 1)}
          disabled={disabled || received <= 0}
        >
          <Icon name="remove" size={18} color={received <= 0 ? '#C7C7CC' : '#007AFF'} />
        </TouchableOpacity>
        <TextInput
          style={[verify.stepInput, missing > 0 && verify.stepInputMissing]}
          value={String(received)}
          onChangeText={setClamped}
          keyboardType="number-pad"
          editable={!disabled}
          selectTextOnFocus
        />
        <TouchableOpacity
          style={verify.stepBtn}
          onPress={() => setClamped(received + 1)}
          disabled={disabled || received >= expected}
        >
          <Icon name="add" size={18} color={received >= expected ? '#C7C7CC' : '#007AFF'} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Modal de detalle, verificación y confirmación ─────────────────────────────
function ReturnDetailModal({ visible, request, onClose, onApprove, onReject }) {
  const [rejectionNote, setRejectionNote] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [received, setReceived] = useState({});

  const allItems = request ? [
    ...(request.items || []).map((i, idx) => ({ ...i, _type: 'item', _key: buildItemKey(i, idx, 'item') })),
    ...(request.bonuses || []).map((i, idx) => ({ ...i, _type: 'bonus', _key: buildItemKey(i, idx, 'bonus') })),
  ] : [];

  useEffect(() => {
    if (!visible) {
      setRejectionNote('');
      setShowRejectInput(false);
      setReceived({});
    } else if (request) {
      // Por defecto todo se asume recibido completo; el bodeguero ajusta lo faltante
      const initial = {};
      (request.items || []).forEach((i, idx) => { initial[buildItemKey(i, idx, 'item')] = Number(i.quantity) || 0; });
      (request.bonuses || []).forEach((i, idx) => { initial[buildItemKey(i, idx, 'bonus')] = Number(i.quantity) || 0; });
      setReceived(initial);
    }
  }, [visible, request]);

  if (!request) return null;

  const totalMissing = allItems.reduce((sum, i) => {
    const expected = Number(i.quantity) || 0;
    const rec = received[i._key] ?? expected;
    return sum + (expected - rec);
  }, 0);

  const handleChangeReceived = (key, value) => {
    setReceived((prev) => ({ ...prev, [key]: value }));
  };

  const handleApprove = async () => {
    const warning = totalMissing > 0
      ? `\n\n⚠️ Hay ${totalMissing} producto(s) FALTANTE(S). Se registrará el faltante a cargo del entregador.`
      : '';
    Alert.alert(
      'Confirmar devolución',
      `¿Confirmar devolución y restituir al inventario las cantidades verificadas?${warning}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await onApprove(request, received);
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

            {/* Verificación de cantidades */}
            <Text style={modal.sectionLabel}>Verificar cantidades recibidas</Text>
            <Text style={verify.hint}>
              Confirma cuántas unidades de cada producto entregó físicamente el repartidor.
            </Text>
            {allItems.map((item) => (
              <VerifyItemRow
                key={item._key}
                item={item}
                itemKey={item._key}
                received={received[item._key] ?? (Number(item.quantity) || 0)}
                onChange={handleChangeReceived}
                disabled={loading}
              />
            ))}

            {totalMissing > 0 && (
              <View style={verify.missingBanner}>
                <Icon name="alert-circle" size={18} color="#B91C1C" />
                <Text style={verify.missingBannerText}>
                  {totalMissing} unidad(es) faltante(s). Al aprobar se registrará el faltante a cargo del entregador.
                </Text>
              </View>
            )}

            {/* Input para rechazo */}
            {showRejectInput && (
              <View style={modal.rejectBlock}>
                <Text style={modal.infoLabel}>Motivo de rechazo (opcional)</Text>
                <TextInput
                  value={rejectionNote}
                  onChangeText={setRejectionNote}
                  placeholder="Describa por qué rechaza la devolución..."
                  placeholderTextColor="#6B7280"
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
                    <Text style={[modal.rejectBtnText, { color: '#fff' }]}>Confirmar rechazo</Text>
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
          {(request.bonuses || []).length > 0 ? ` + ${request.bonuses.length} regalía(s)` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Lista principal de pendientes ─────────────────────────────────────────────
export default function PendingReturnsList({ routeId = null }) {
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

  const handleApprove = useCallback(async (request, verifiedQuantities) => {
    await approveReturnRequest({
      returnRequestId: request.id,
      returnRequest: request,
      verifiedQuantities,
    });
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

const verify = StyleSheet.create({
  hint: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 8,
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, color: '#111827', fontWeight: '500' },
  rowExpected: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  rowMissing: { fontSize: 12, color: '#B91C1C', fontWeight: '700', marginTop: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  stepInput: {
    minWidth: 48,
    height: 36,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    paddingVertical: 0,
  },
  stepInputMissing: {
    borderColor: '#FCA5A5',
    color: '#B91C1C',
    backgroundColor: '#FEF2F2',
  },
  missingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  missingBannerText: { flex: 1, fontSize: 13, color: '#B91C1C', fontWeight: '600', lineHeight: 18 },
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
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 4, textTransform: 'uppercase' },
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
