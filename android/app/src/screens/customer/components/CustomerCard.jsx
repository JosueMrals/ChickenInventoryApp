// CustomerCard.jsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

function CustomerCard({
  customer,
  role,
  onEdit,
  onViewHistory,
  onCreateSale,
  onDelete,
  readOnly = false,
  onViewInfo,
}) {
  const {
    firstName,
    lastName,
    phone,
    cedula,
    address,
    creditLimit = 0,
    type,
    discount = 0,
  } = customer;

  const canEdit = !readOnly && (role === 'admin' || role === 'vendedor');
  const initials = `${(firstName || '?')[0]}${(lastName || '?')[0]}`.toUpperCase();

  const handleCardPress = () => {
    if (readOnly) { onViewInfo?.(customer); return; }
    if (canEdit && onEdit) { onEdit(customer); return; }
    if (onViewHistory) { onViewHistory(customer); }
  };

  return (
    <TouchableOpacity style={s.card} activeOpacity={0.85} onPress={handleCardPress}>
      {/* Top row: avatar + name + badge */}
      <View style={s.topRow}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initials}</Text>
        </View>

        <View style={s.info}>
          <Text style={s.name} numberOfLines={1}>
            {firstName} {lastName}
          </Text>
          <Text style={s.sub} numberOfLines={1}>
            {phone || 'Sin teléfono'}
            {cedula ? `  •  ${cedula}` : ''}
          </Text>
        </View>

        <View style={s.badges}>
          <View style={[s.badge, type === 'Mayorista' && s.badgeMayo]}>
            <Text style={[s.badgeText, type === 'Mayorista' && s.badgeTextMayo]}>
              {type ?? 'Común'}
            </Text>
          </View>
          {discount > 0 && (
            <Text style={s.discount}>{discount}% desc.</Text>
          )}
        </View>
      </View>

      {/* Detail chips */}
      <View style={s.detailRow}>
        {address ? (
          <View style={s.chip}>
            <Icon name="map-marker-outline" size={13} color="#666" />
            <Text style={s.chipText} numberOfLines={1}>{address}</Text>
          </View>
        ) : null}
        <View style={s.chip}>
          <Icon name="credit-card-outline" size={13} color="#666" />
          <Text style={s.chipText}>C${creditLimit.toFixed(2)}</Text>
        </View>
      </View>

      {/* Divider + actions */}
      <View style={s.divider} />

      {/* Solo consulta (entregador): una acción directa, sin botones inertes. */}
      {readOnly ? (
        <TouchableOpacity style={s.infoBtn} onPress={() => onViewInfo?.(customer)} activeOpacity={0.85}>
          <Icon name="account-details-outline" size={18} color="#007AFF" />
          <Text style={s.infoBtnText}>Ver información</Text>
          <Icon name="chevron-right" size={18} color="#007AFF" />
        </TouchableOpacity>
      ) : (
      <View style={s.actions}>
        <TouchableOpacity style={[s.actionBtn, s.actionDisabled]} disabled>
          <Icon name="cart-plus" size={18} color="#C7C7CC" />
          <Text style={[s.actionLabel, { color: '#C7C7CC' }]}>Venta</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.actionBtn} onPress={() => onViewHistory?.(customer)}>
          <Icon name="history" size={18} color="#007AFF" />
          <Text style={[s.actionLabel, { color: '#007AFF' }]}>Historial</Text>
        </TouchableOpacity>

        {canEdit && (
          <TouchableOpacity style={s.actionBtn} onPress={() => onEdit?.(customer)}>
            <Icon name="pencil-outline" size={18} color="#007AFF" />
            <Text style={[s.actionLabel, { color: '#007AFF' }]}>Editar</Text>
          </TouchableOpacity>
        )}

        {onDelete && (
          <TouchableOpacity style={s.actionBtn} onPress={() => onDelete(customer)}>
            <Icon name="trash-can-outline" size={18} color="#FF3B30" />
            <Text style={[s.actionLabel, { color: '#FF3B30' }]}>Eliminar</Text>
          </TouchableOpacity>
        )}
      </View>
      )}
    </TouchableOpacity>
  );
}

// memo: la lista de clientes re-renderiza en cada tecla del buscador. Sin esto,
// cada fila montada se vuelve a renderizar aunque su `customer` no haya cambiado.
export default React.memo(CustomerCard);

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EAF0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#007AFF',
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
  },
  sub: {
    fontSize: 12,
    color: '#888',
    marginTop: 1,
  },
  badges: {
    alignItems: 'flex-end',
  },
  badge: {
    backgroundColor: '#F2F6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeMayo: {
    backgroundColor: '#FFF7EA',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#007AFF',
  },
  badgeTextMayo: {
    color: '#E6960B',
  },
  discount: {
    fontSize: 10,
    fontWeight: '700',
    color: '#34C759',
    marginTop: 3,
  },
  detailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F7F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    maxWidth: '70%',
  },
  chipText: {
    fontSize: 11,
    color: '#555',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 10,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionBtn: {
    alignItems: 'center',
    gap: 2,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#555',
  },
  actionDisabled: {
    opacity: 0.4,
  },
  infoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F2F6FF',
  },
  infoBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#007AFF',
  },
});
