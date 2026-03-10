import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useProductOperations } from '../hooks/useProductOperations';
import OperationDetailModal from '../components/OperationDetailModal';

const OPERATION_TYPE_LABELS = {
  create: 'Creacion',
  update: 'Actualizacion',
  delete: 'Eliminacion',
  stock_change: 'Ajuste stock',
};

const FIELD_LABELS = {
  name: 'Nombre',
  description: 'Descripcion',
  stock: 'Stock',
  category: 'Categoria',
  barcode: 'Codigo',
  purchasePrice: 'Costo',
  salePrice: 'Precio venta',
  wholesalePrices: 'Mayorista',
  bonuses: 'Bonificaciones',
};

function areDifferentValues(oldValue, newValue) {
  return JSON.stringify(oldValue) !== JSON.stringify(newValue);
}

function formatValue(value, key) {
  if (value === null || value === undefined) return 'N/D';

  if (['purchasePrice', 'salePrice', 'price', 'cost', 'amount', 'total'].includes(key) && !Number.isNaN(Number(value))) {
    return `$${Number(value).toFixed(2)}`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return 'N/D';
    return `${value.length} item(s)`;
  }

  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'N/D';
  if (typeof value === 'string') return value.trim() || 'N/D';
  return JSON.stringify(value);
}

function getActionLabel(action) {
  if (action === 'created') return 'CREADO';
  if (action === 'deleted') return 'ELIMINADO';
  return 'MODIFICADO';
}

function getLatestChangeSummary(operation) {
  const details = operation?.details || {};
  const changes = details?.changes;

  if (changes && typeof changes === 'object') {
    const meaningfulChanges = Object.entries(changes)
      .map(([key, raw]) => {
        const from = raw?.from ?? raw?.oldValue;
        const to = raw?.to ?? raw?.newValue;

        const formattedFrom = formatValue(from, key);
        const formattedTo = formatValue(to, key);

        // Evita marcar como cambio cuando visualmente el valor es el mismo.
        if (!areDifferentValues(from, to) || formattedFrom === formattedTo) return null;

        return {
          key,
          label: FIELD_LABELS[key] || key,
          from: formattedFrom,
          to: formattedTo,
          action: raw?.action || 'updated',
        };
      })
      .filter(Boolean);

    if (meaningfulChanges.length > 0) {
      return meaningfulChanges[meaningfulChanges.length - 1];
    }
  }

  return null;
}

const ProductOperationsPanel = ({ dateRange = {} }) => {
  const { operations, loading } = useProductOperations(dateRange.startDate, dateRange.endDate);
  const [selectedOperation, setSelectedOperation] = useState(null);

  const handleOpenModal = useCallback((operation) => {
    setSelectedOperation(operation);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedOperation(null);
  }, []);

  const renderItem = useCallback(({ item }) => {
    const operationDate = item?.timestamp?.toDate?.() || new Date(item?.timestamp || Date.now());
    const operationTypeLabel = OPERATION_TYPE_LABELS[item?.operationType] || item?.operationType || 'Operacion';
    const latestChange = getLatestChangeSummary(item);

    return (
      <TouchableOpacity style={styles.card} onPress={() => handleOpenModal(item)} activeOpacity={0.86}>
        <View style={styles.topRow}>
          <Text style={styles.productName} numberOfLines={1}>{item?.productName || 'Producto'}</Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{operationTypeLabel}</Text>
          </View>
        </View>

        {latestChange ? (
          <View style={styles.changeBox}>
            <View style={styles.changeHeaderRow}>
              <Text style={styles.changeLabel}>Dato modificado</Text>
              <Text style={styles.actionChip}>{getActionLabel(latestChange.action)}</Text>
            </View>
            <Text style={styles.fieldName}>{latestChange.label}</Text>
            <Text style={styles.changeFrom} numberOfLines={1}>Antes: {latestChange.from}</Text>
            <Text style={styles.changeTo} numberOfLines={1}>Ahora: {latestChange.to}</Text>
          </View>
        ) : null}

        <Text style={styles.date}>{operationDate.toLocaleString()}</Text>
      </TouchableOpacity>
    );
  }, [handleOpenModal]);

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={operations}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: 6 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No hay operaciones en el rango de fechas.</Text>}
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
    padding: 14,
    marginVertical: 7,
    marginHorizontal: 14,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  productName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginRight: 8,
  },
  typeBadge: {
    backgroundColor: '#EEF4FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeBadgeText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  changeBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    marginBottom: 8,
  },
  changeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  changeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  actionChip: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1D4ED8',
    backgroundColor: '#EEF4FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  fieldName: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
    marginBottom: 4,
  },
  changeFrom: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 1,
  },
  changeTo: {
    fontSize: 12,
    color: '#0F766E',
    fontWeight: '700',
  },
  date: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#6B7280',
  },
});

export default ProductOperationsPanel;
