import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { warehouseStyles as styles } from '../styles/warehouseStyles';

const STATUS_LABELS = {
  pending: 'Pendiente',
  preparing: 'En Preparación',
  ready_for_delivery: 'Lista para Entrega',
  dispatched: 'En Reparto',
  paid: 'Pagada'
};

const getStatusColor = (status) => {
    switch(status) {
        case 'pending': return '#F2C94C';
        case 'preparing': return '#007AFF';
        case 'ready_for_delivery': return '#34C759';
        default: return '#8E8E93';
    }
};

const PreSaleItem = ({ item, onSelect }) => {
  const totalItems = item.items && Array.isArray(item.items)
    ? item.items.reduce((acc, curr) => acc + (curr.quantity || 0), 0)
    : 0;

  const customerName = item.customer?.firstName
        ? `${item.customer.firstName} ${item.customer.lastName || ''}`
        : item.customerName || 'Cliente sin nombre';

  const customerPhone = item.customer?.phone || 'Sin teléfono';

  return (
    <TouchableOpacity style={styles.itemContainer} onPress={() => onSelect(item)}>
      <View style={styles.itemHeader}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Icon name="receipt-outline" size={24} color="#5856D6" />
            <Text style={styles.itemTitle}>ID: {item.id.substring(0, 8).toUpperCase()}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{STATUS_LABELS[item.status] || item.status}</Text>
          </View>
      </View>

      <View style={styles.customerContainer}>
        <View style={styles.customerRow}>
            <Icon name="person-outline" size={16} color="#666" style={{marginRight: 6}} />
            <Text style={styles.customerText}>{customerName}</Text>
        </View>
        <View style={styles.customerRow}>
            <Icon name="call-outline" size={16} color="#666" style={{marginRight: 6}} />
            <Text style={styles.customerSubText}>{customerPhone}</Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.itemText}>Items Totales: {totalItems}</Text>
        <Text style={styles.dateText}>
            {item.createdAt ? new Date(item.createdAt.toDate()).toLocaleDateString() : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default PreSaleItem;
