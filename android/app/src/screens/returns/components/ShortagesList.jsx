import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { subscribeDeliveryShortages, fulfillShortage } from '../../../services/returnService';
import { getUsersByRole } from '../../../services/auth';
import { formatTimestamp } from '../utils/format';

// ── Tarjeta de faltante ───────────────────────────────────────────────────────
function ShortageCard({ shortage, entregadorName, onFulfill, fulfilling, readOnly }) {
  const isFulfilled = shortage.status === 'fulfilled';
  return (
    <View style={[s.card, isFulfilled && s.cardFulfilled]}>
      <View style={s.cardHeader}>
        <View style={[s.avatarIcon, isFulfilled && s.avatarIconFulfilled]}>
          <Icon name={isFulfilled ? 'checkmark' : 'bicycle-outline'} size={18} color={isFulfilled ? '#16A34A' : '#B91C1C'} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.entregadorName}>{entregadorName}</Text>
          <Text style={s.cardMeta}>
            {shortage.customerName ? `Cliente: ${shortage.customerName} · ` : ''}
            {formatTimestamp(shortage.recordedAt)}
          </Text>
          {shortage.routeName ? <Text style={s.cardMeta}>Ruta: {shortage.routeName}</Text> : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[s.missingValue, isFulfilled && { color: '#16A34A' }]}>C${(shortage.totalMissingValue || 0).toFixed(2)}</Text>
          <Text style={[s.missingQty, isFulfilled && { color: '#16A34A' }]}>{shortage.totalMissingQty} faltante(s)</Text>
        </View>
      </View>

      {(shortage.items || []).map((item, idx) => (
        <View key={idx} style={s.itemRow}>
          <Text style={s.itemName} numberOfLines={1}>
            {item.productName}{item.isBonus ? ' (regalía)' : ''}
          </Text>
          <Text style={s.itemDetail}>
            {item.receivedQty}/{item.expectedQty} · faltan {item.missingQty}
          </Text>
        </View>
      ))}

      <View style={s.footerRow}>
        <Icon name="person-outline" size={12} color="#6B7280" />
        <Text style={s.footerText}>Registrado por {shortage.recordedBy}</Text>
      </View>

      {isFulfilled ? (
        <View style={s.fulfilledRow}>
          <Icon name="checkmark-circle" size={14} color="#16A34A" />
          <Text style={s.fulfilledText}>
            Entregado por {shortage.fulfilledBy} · {formatTimestamp(shortage.fulfilledAt)}
          </Text>
        </View>
      ) : readOnly ? (
        // El entregador ve su deuda de producto; darla por entregada es de bodega.
        <View style={s.pendingRow}>
          <Icon name="alert-circle-outline" size={14} color="#B45309" />
          <Text style={s.pendingText}>
            Pendiente de entregar a bodega. Bodega lo confirma al recibirlo.
          </Text>
        </View>
      ) : (
        <TouchableOpacity style={s.fulfillBtn} onPress={() => onFulfill(shortage)} disabled={fulfilling}>
          {fulfilling ? (
            <ActivityIndicator size="small" color="#16A34A" />
          ) : (
            <>
              <Icon name="cube-outline" size={16} color="#16A34A" />
              <Text style={s.fulfillBtnText}>Marcar entregado (reponer stock)</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Lista principal ───────────────────────────────────────────────────────────
export default function ShortagesList({ routeId = null, entregadorId = null, readOnly = false }) {
  const [shortages, setShortages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [namesByUid, setNamesByUid] = useState({});
  const [fulfillingId, setFulfillingId] = useState(null);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeDeliveryShortages((docs) => {
      setShortages(docs);
      setLoading(false);
    }, routeId, entregadorId);
    return () => unsub();
  }, [routeId, entregadorId]);

  useEffect(() => {
    getUsersByRole('entregador').then((users) => {
      const map = {};
      users.forEach((u) => {
        map[u.uid] = `${u.nombre || u.name || ''} ${u.apellido || ''}`.trim() || u.email || u.uid;
      });
      setNamesByUid(map);
    });
  }, []);

  const resolveName = (shortage) => {
    if (!shortage.entregadorId) return 'Entregador no identificado';
    return namesByUid[shortage.entregadorId] || shortage.entregadorId;
  };

  const handleFulfill = (shortage) => {
    Alert.alert(
      'Confirmar entrega de faltantes',
      `¿El entregador entregó los ${shortage.totalMissingQty} producto(s) faltante(s)? Se repondrán al inventario.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setFulfillingId(shortage.id);
            try {
              await fulfillShortage({ shortageId: shortage.id, shortage });
            } catch (e) {
              Alert.alert('Error', e.message || 'No se pudo registrar la entrega.');
            } finally {
              setFulfillingId(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <FlatList
      data={shortages}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ShortageCard
          shortage={item}
          entregadorName={resolveName(item)}
          onFulfill={handleFulfill}
          fulfilling={fulfillingId === item.id}
          readOnly={readOnly}
        />
      )}
      contentContainerStyle={s.list}
      ListEmptyComponent={
        <View style={s.center}>
          <Icon name="shield-checkmark-outline" size={64} color="#D1D5DB" />
          <Text style={s.emptyText}>
            {readOnly
              ? 'No tienes faltantes registrados. Entregaste completas todas tus devoluciones.'
              : 'No hay faltantes registrados. Todas las devoluciones fueron entregadas completas.'}
          </Text>
        </View>
      }
    />
  );
}

const s = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 12, color: '#6B7280', fontSize: 14, textAlign: 'center', maxWidth: '80%' },
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
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  avatarIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entregadorName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardMeta: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  missingValue: { fontSize: 16, fontWeight: '800', color: '#B91C1C' },
  missingQty: { fontSize: 11, fontWeight: '600', color: '#B91C1C', marginTop: 2 },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 8,
  },
  itemName: { flex: 1, fontSize: 13, color: '#111827', fontWeight: '500' },
  itemDetail: { fontSize: 12, color: '#B91C1C', fontWeight: '600' },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  footerText: { fontSize: 11, color: '#6B7280' },
  cardFulfilled: { opacity: 0.85, borderWidth: 1, borderColor: '#BBF7D0' },
  avatarIconFulfilled: { backgroundColor: '#DCFCE7' },
  fulfillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  fulfillBtnText: { fontSize: 13, fontWeight: '700', color: '#16A34A' },
  fulfilledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  fulfilledText: { fontSize: 11, fontWeight: '600', color: '#16A34A', flex: 1 },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  pendingText: { fontSize: 11, fontWeight: '600', color: '#B45309', flex: 1 },
});
