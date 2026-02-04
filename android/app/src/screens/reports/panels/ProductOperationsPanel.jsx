
import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useProductOperations } from '../hooks/useProductOperations';
import OperationDetailModal from '../components/OperationDetailModal';

const ProductOperationsPanel = ({ dateRange = {} }) => {
  const { operations, loading } = useProductOperations(dateRange.startDate, dateRange.endDate);
  const [selectedOperation, setSelectedOperation] = useState(null);

  const handleOpenModal = useCallback((operation) => {
    setSelectedOperation(operation);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedOperation(null);
  }, []);

  const renderItem = useCallback(({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => handleOpenModal(item)}>
      <Text style={styles.productName}>{item.productName}</Text>
      <Text>Tipo: {item.operationType}</Text>
      <Text style={styles.date}>{new Date(item.timestamp?.toDate()).toLocaleDateString()}</Text>
    </TouchableOpacity>
  ), [handleOpenModal]);

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={operations}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No hay operaciones en el rango de fechas.</Text>}
        />
      )}
      <OperationDetailModal
        visible={!!selectedOperation}
        item={selectedOperation}
        onClose={handleCloseModal}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    backgroundColor: '#fff',
    padding: 15,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 10,
    elevation: 3,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  date: {
    marginTop: 5,
    color: '#888',
  },
});

export default ProductOperationsPanel;
