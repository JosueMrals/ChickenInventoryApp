
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const OperationItem = ({ item, onPress }) => {
  const renderSummary = () => {
    switch (item.__kind) {
      case 'sale':
        return <Text style={styles.summary}>Venta por un total de ${item.total?.toFixed(2)}</Text>;
      case 'financial':
        return <Text style={styles.summary}>{item.type === 'income' ? 'Ingreso' : 'Gasto'} de ${item.amount?.toFixed(2)}</Text>;
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
