
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const OperationItem = ({ item, onPress }) => {
  const renderSummary = () => {
    switch (item.__kind) {
      case 'sale':
        return <Text style={styles.summary}>Venta rápida — Total: C${item.total?.toFixed(2)}</Text>;
      case 'presale': {
        const statusLabels = {
          paid: 'Cobrada',
          delivered: 'Entregada',
          credit_pending: 'Crédito pendiente',
          credit_preparing: 'Crédito en preparación',
          credit_ready_for_delivery: 'Crédito listo para entregar',
        };
        const statusLabel = statusLabels[item.status] || item.status || '';
        const customer = item.customerName || 'Cliente';
        return (
          <Text style={styles.summary}>
            Pre-venta · {customer} · C${item.total?.toFixed(2)}
            {statusLabel ? ` · ${statusLabel}` : ''}
          </Text>
        );
      }
      case 'financial':
        return <Text style={styles.summary}>{item.type === 'income' ? 'Ingreso' : 'Gasto'} de C${item.amount?.toFixed(2)}</Text>;
      case 'inventory':
        return <Text style={styles.summary}>{`Movimiento de inventario: ${item.type}`}</Text>;
      case 'product_activity':
        return <Text style={styles.summary}>{`PRODUCTO: '${item.details?.name}' fue ${item.type}`}</Text>;
      default:
        return null;
    }
  };

  return (
    <TouchableOpacity onPress={onPress} style={styles.itemContainer}>
      <View style={styles.header}>
          <Text style={styles.kind}>{item.__kind.replace('_', ' ').toUpperCase()}</Text>
          <Text style={styles.date}>{item.createdAt?.toDate()?.toLocaleDateString()}</Text>
      </View>
      {renderSummary()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
    itemContainer: {
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 8,
        marginBottom: 10,
        elevation: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 5,
    },
    kind: {
        fontWeight: 'bold',
        color: '#444',
        textTransform: 'capitalize',
    },
    date: {
        fontSize: 12,
        color: '#888',
    },
    summary: {
        color: '#555',
    },
});

export default OperationItem;
