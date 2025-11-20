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

  return (
    <View style={styles.card}>
      {/* Encabezado */}
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.name}>
            {firstName} {lastName}
          </Text>
          <Text style={styles.smallText}>
            {cedula ? `Cédula: ${cedula}` : 'Sin cédula'}
          </Text>
        </View>

        <View style={styles.tagColumn}>
          <Text style={styles.typeBadge}>
            {type ?? 'Común'}
          </Text>
          {discount > 0 && (
            <Text style={[styles.smallText, { color: '#007AFF', marginTop: 4 }]}>
              {discount}% desc.
            </Text>
          )}
        </View>
      </View>

      {/* Teléfono y dirección */}
      <Text style={styles.text}>Tel: {phone}</Text>
      <Text style={styles.text}>Dir: {address || '-'}</Text>

      <View style={[styles.rowBetween, { marginTop: 10 }]}>
        <Text style={styles.smallText}>Crédito: C${creditLimit.toFixed(2)}</Text>

        {/* Acciones */}
        <View style={styles.actions}>

          {/* 🔥 NUEVO: Registrar venta */}
          <TouchableOpacity
            onPress={() => onCreateSale(customer)}
            style={{ marginRight: 14 }}
          >
            <Icon name="cart-plus" size={22} color="#28a745" />
          </TouchableOpacity>

          {/* Histórico */}
          <TouchableOpacity onPress={() => onViewHistory(customer)}>
            <Icon name="history" size={22} color="#333" />
          </TouchableOpacity>

          {/* Editar */}
          {role === 'admin' && (
            <TouchableOpacity
              onPress={() => onEdit(customer)}
              style={{ marginLeft: 14 }}
            >
              <Icon name="pencil" size={22} color="#007AFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}
