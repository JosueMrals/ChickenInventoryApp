
import React, { useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import OperationDetailModal from '../components/OperationDetailModal';

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

const OperationsPanel = ({ data, loading, loadMore, hasMore }) => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  if (loading && !data?.length) {
    return <ActivityIndicator style={{ marginTop: 20 }} size="large" color="#0000ff" />;
  }

  if (!data?.length) {
    return <Text style={styles.emptyText}>No hay operaciones en este rango.</Text>;
  }

  const handleItemPress = (item) => {
      setSelectedItem(item);
      setIsModalVisible(true);
  };

  const handleCloseModal = () => {
      setIsModalVisible(false);
      setSelectedItem(null);
  };

  return (
    <View style={{flex: 1}}>
        <FlatList
            data={data}
            renderItem={({ item }) => (
                <OperationItem
                    item={item}
                    onPress={() => handleItemPress(item)}
                />
            )}
            keyExtractor={item => item._uid}
            onEndReached={() => hasMore && loadMore ? loadMore() : null}
            onEndReachedThreshold={0.5}
            ListFooterComponent={loading && hasMore ? <ActivityIndicator style={{ marginVertical: 20 }} /> : null}
            contentContainerStyle={{ padding: 10 }}
        />
        <OperationDetailModal
            item={selectedItem}
            visible={isModalVisible}
            onClose={handleCloseModal}
        />
    </View>
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
    emptyText: {
        textAlign: 'center',
        padding: 20,
        color: '#777',
        marginTop: 20,
    },
});

export default OperationsPanel;
