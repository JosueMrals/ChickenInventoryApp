// CustomerCard.jsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import styles from '../styles/styles';

export default function CustomerCard({
  customer,
  role,
  onEdit,
  onViewHistory,
  onCreateSale,   // 🔥 nuevo callback
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

  const canEdit = role === 'admin' || role === 'vendedor';
  const handleCardPress = () => {
    if (canEdit && onEdit) {
      onEdit(customer);
      return;
    }
    if (onViewHistory) {
      onViewHistory(customer);
    }
  };

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={handleCardPress}>
      {/* Encabezado */}
      <View style={styles.cardHeader}>
        <View style={styles.nameBlock}>
          <Text style={styles.name} numberOfLines={1}>
            {firstName} {lastName}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.smallText}>Tel: {phone || '-'}</Text>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.smallText}>
              {cedula ? `Cédula: ${cedula}` : 'Sin cédula'}
            </Text>
          </View>
        </View>

        <View style={styles.tagColumn}>
          <Text style={styles.typeBadge}>
            {type ?? 'Común'}
          </Text>
          {discount > 0 && (
            <Text style={styles.discountBadge}>
              {discount}% desc.
            </Text>
          )}
        </View>
      </View>

      {/* Dirección */}
      <Text style={styles.text} numberOfLines={1}>Dir: {address || '-'}</Text>

      <View style={styles.rowBetweenCompact}>
        <Text style={styles.creditText}>Crédito: C${creditLimit.toFixed(2)}</Text>

        {/* Acciones */}
        <View style={styles.actions}>
          {/* Histórico */}
          <TouchableOpacity onPress={() => onViewHistory(customer)}>
            <Icon name="history" size={20} color="#333" />
          </TouchableOpacity>

          {/* Editar */}
          {canEdit && (
            <TouchableOpacity
              onPress={() => onEdit(customer)}
              style={{ marginLeft: 12 }}
            >
              <Icon name="pencil" size={20} color="#007AFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
