// Devoluciones del propio entregador: mientras bodega no las resuelva puede
// corregirlas o eliminarlas. Una vez aprobadas/rechazadas pasan al historial.
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  subscribeMyPendingReturnRequests,
  updateReturnRequest,
  deleteReturnRequest,
  getPresaleForReturn,
} from '../../../services/returnService';
import ReturnRequestModal from './ReturnRequestModal';
import { formatTimestamp } from '../utils/format';

function MyReturnCard({ request, onEdit, onDelete, busy }) {
  const itemCount = (request.items || []).length;
  const bonusCount = (request.bonuses || []).length;
  const units = [...(request.items || []), ...(request.bonuses || [])]
    .reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.customer} numberOfLines={1}>{request.customerName || 'Cliente'}</Text>
          <Text style={s.meta}>{formatTimestamp(request.requestedAt)}</Text>
        </View>
        <View style={s.badge}>
          <Icon name="time-outline" size={12} color="#B45309" />
          <Text style={s.badgeText}>En revisión</Text>
        </View>
      </View>

      <View style={s.reasonRow}>
        <Icon name="document-text-outline" size={14} color="#6B7280" />
        <Text style={s.reasonText} numberOfLines={2}>{request.reason}</Text>
      </View>

      <View style={s.itemsRow}>
        <Icon name="cube-outline" size={14} color="#374151" />
        <Text style={s.itemsText}>
          {itemCount} producto(s){bonusCount > 0 ? ` + ${bonusCount} regalía(s)` : ''} · {units} unidad(es)
        </Text>
      </View>

      <View style={s.actions}>
        <TouchableOpacity style={s.editBtn} onPress={() => onEdit(request)} disabled={busy}>
          <Icon name="create-outline" size={16} color="#007AFF" />
          <Text style={s.editText}>Modificar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.deleteBtn} onPress={() => onDelete(request)} disabled={busy}>
          {busy ? (
            <ActivityIndicator size="small" color="#FF3B30" />
          ) : (
            <>
              <Icon name="trash-outline" size={16} color="#FF3B30" />
              <Text style={s.deleteText}>Eliminar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function MyReturnsList({ uid }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null);   // { request, sale }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeMyPendingReturnRequests(uid, (docs) => {
      setRequests(docs);
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  const handleEdit = useCallback(async (request) => {
    setBusyId(request.id);
    try {
      // La pre-venta original define el máximo devolvible por producto. Si ya no
      // existe, se editan las cantidades ya solicitadas (solo se pueden bajar).
      const presale = await getPresaleForReturn(request.presaleId);
      setEditing({
        request,
        sale: presale || { items: request.items, bonuses: request.bonuses },
      });
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo cargar la venta original.');
    } finally {
      setBusyId(null);
    }
  }, []);

  const handleSaveEdit = useCallback(async (reason, items, bonuses) => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateReturnRequest({
        returnRequestId: editing.request.id,
        reason,
        items,
        bonuses,
      });
      setEditing(null);
      Alert.alert('Solicitud actualizada', 'Los cambios se enviaron a bodega.');
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo actualizar la solicitud.');
    } finally {
      setSaving(false);
    }
  }, [editing]);

  const handleDelete = useCallback((request) => {
    Alert.alert(
      'Eliminar solicitud',
      `¿Eliminar la solicitud de devolución de ${request.customerName || 'este cliente'}? Bodega dejará de verla.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setBusyId(request.id);
            try {
              await deleteReturnRequest(request.id);
            } catch (e) {
              Alert.alert('Error', e.message || 'No se pudo eliminar la solicitud.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
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
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MyReturnCard
            request={item}
            onEdit={handleEdit}
            onDelete={handleDelete}
            busy={busyId === item.id}
          />
        )}
        contentContainerStyle={s.list}
        ListEmptyComponent={(
          <View style={s.center}>
            <Icon name="return-up-back-outline" size={64} color="#D1D5DB" />
            <Text style={s.emptyText}>
              No tienes devoluciones en revisión. Solicítalas desde el ticket de una entrega.
            </Text>
          </View>
        )}
      />

      <ReturnRequestModal
        visible={!!editing}
        sale={editing?.sale}
        preset={editing?.request}
        title="Modificar Devolución"
        submitLabel="Guardar cambios"
        onClose={() => !saving && setEditing(null)}
        onSubmit={handleSaveEdit}
        submitting={saving}
      />
    </View>
  );
}

const s = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 12, color: '#6B7280', fontSize: 14, textAlign: 'center', maxWidth: '75%' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  customer: { fontSize: 15, fontWeight: '700', color: '#111827' },
  meta: { fontSize: 11, color: '#8E8E93', marginTop: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#B45309' },
  reasonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 6 },
  reasonText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },
  itemsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemsText: { fontSize: 12, color: '#6B7280' },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F2F6FF',
  },
  editText: { fontSize: 13, fontWeight: '700', color: '#007AFF' },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFD4D1',
  },
  deleteText: { fontSize: 13, fontWeight: '700', color: '#FF3B30' },
});
