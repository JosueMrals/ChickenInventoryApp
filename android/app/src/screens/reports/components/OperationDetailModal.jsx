import React, { useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const OPERATION_TYPE_LABELS = {
  create: 'Creacion de producto',
  update: 'Actualizacion de producto',
  delete: 'Eliminacion de producto',
  stock_change: 'Ajuste de stock',
};

const FIELD_LABELS = {
  name: 'Nombre',
  description: 'Descripcion',
  price: 'Precio',
  cost: 'Costo',
  stock: 'Stock',
  category: 'Categoria',
  unit: 'Unidad',
  sku: 'SKU',
  barcode: 'Codigo de barras',
  quantity: 'Cantidad',
  notes: 'Notas',
  reason: 'Motivo',
  resultingStock: 'Stock resultante',
  purchasePrice: 'Precio de compra',
  salePrice: 'Precio de venta',
  wholesalePrices: 'Precios por mayor',
};

function isDifferentValue(a, b) {
  return JSON.stringify(a) !== JSON.stringify(b);
}

function formatValue(value, key) {
  if (value === null || value === undefined) return 'No disponible';

  if (['price', 'cost', 'purchasePrice', 'salePrice', 'amount', 'total'].includes(key) && !Number.isNaN(Number(value))) {
    return `$${Number(value).toFixed(2)}`;
  }

  if (key === 'wholesalePrices' && Array.isArray(value)) {
    if (value.length === 0) return 'Ninguno';
    return value.map((wp) => `Cant ${wp.quantity}: $${Number(wp.price || 0).toFixed(2)}`).join(' | ');
  }

  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function extractChanges(item) {
  const details = item?.details;
  if (!details || typeof details !== 'object') return [];

  // Evita falsos positivos por diferencias de tipo/formato (ej: 5 vs "5"),
  // comparando tambien el valor final que se muestra al usuario.
  const hasVisualDifference = (key, from, to) => {
    if (!isDifferentValue(from, to)) return false;
    const formattedFrom = formatValue(from, key);
    const formattedTo = formatValue(to, key);
    return formattedFrom !== formattedTo;
  };

  const inferAction = (from, to) => {
    const fromEmpty = from === null || from === undefined || from === '';
    const toEmpty = to === null || to === undefined || to === '';
    if (fromEmpty && !toEmpty) return 'created';
    if (!fromEmpty && toEmpty) return 'deleted';
    return 'updated';
  };

  const toChangeModel = (key, node) => {
    const from = node?.from ?? node?.oldValue;
    const to = node?.to ?? node?.newValue;
    if (from === undefined && to === undefined) return null;
    if (!hasVisualDifference(key, from, to)) return null;

    return {
      key,
      label: FIELD_LABELS[key] || key,
      from: formatValue(from, key),
      to: formatValue(to, key),
      action: node?.action || inferAction(from, to),
    };
  };

  const changesNode = details?.changes;
  if (changesNode && typeof changesNode === 'object') {
    return Object.entries(changesNode)
      .map(([key, node]) => toChangeModel(key, node))
      .filter(Boolean);
  }

  return Object.entries(details)
    .map(([key, node]) => {
      if (key === 'description') return null;
      return toChangeModel(key, node);
    })
    .filter(Boolean);
}

function formatDateTime(item) {
  const timestamp = item?.timestamp || item?.createdAt;
  if (!timestamp) return 'No disponible';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 'Fecha invalida';
  return date.toLocaleString();
}

const ChangeRow = ({ label, from, to, action }) => {
  const actionText = action === 'created' ? 'Creado' : action === 'deleted' ? 'Eliminado' : 'Modificado';

  return (
    <View style={styles.changeRow}>
      <View style={styles.changeHeaderRow}>
        <Text style={styles.changeLabel}>{label}</Text>
        <Text style={styles.changeAction}>{actionText}</Text>
      </View>
      <Text style={styles.changeFrom} numberOfLines={2}>Antes: {from}</Text>
      <Text style={styles.changeTo} numberOfLines={2}>Ahora: {to}</Text>
    </View>
  );
};

const MetaItem = ({ label, value }) => (
  <View style={styles.metaItem}>
    <Text style={styles.metaLabel}>{label}</Text>
    <Text style={styles.metaValue} numberOfLines={2}>{value || 'No disponible'}</Text>
  </View>
);

const OperationDetailModal = ({ item, visible, onClose }) => {
  const operationLabel = useMemo(
    () => OPERATION_TYPE_LABELS[item?.operationType] || item?.operationType || item?.type || 'Operacion',
    [item]
  );

  const operationDate = useMemo(() => formatDateTime(item), [item]);

  const operationCategory = useMemo(
    () => item?.category || item?.details?.category || item?.details?.changes?.category?.to || '',
    [item]
  );

  const changeItems = useMemo(() => extractChanges(item), [item]);

  const description = useMemo(() => {
    const raw = item?.details?.description;
    return typeof raw === 'string' && raw.trim() ? raw.trim() : '';
  }, [item]);

  const hasAnyContent = changeItems.length > 0 || !!description;

  return (
    <Modal
      animationType="slide"
      transparent
      visible={Boolean(visible && item)}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={styles.sheetWrapper}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>Detalle de operacion</Text>
              <View style={styles.typePill}>
                <Text style={styles.typePillText}>{operationLabel}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="close" size={22} color="#1F2937" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator>
            <View style={styles.metaGrid}>
              <MetaItem label="Producto" value={item?.productName || item?.details?.name} />
              <MetaItem label="Usuario" value={item?.email || item?.userEmail} />
              <MetaItem label="Fecha" value={operationDate} />
              {operationCategory ? <MetaItem label="Categoria" value={operationCategory} /> : null}
            </View>

            {description ? (
              <View style={styles.descriptionBox}>
                <Text style={styles.sectionTitle}>Resumen</Text>
                <Text style={styles.descriptionText}>{description}</Text>
              </View>
            ) : null}

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Cambios detectados</Text>
              {changeItems.length > 0 ? (
                changeItems.map((change) => (
                  <ChangeRow
                    key={`${change.key}-${change.from}-${change.to}`}
                    label={change.label}
                    from={change.from}
                    to={change.to}
                    action={change.action}
                  />
                ))
              ) : (
                <Text style={styles.emptyChangesText}>
                  {hasAnyContent ? 'No hay diferencias de valores para mostrar.' : 'No hay datos detallados para esta operacion.'}
                </Text>
              )}
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.primaryBtn} onPress={onClose} activeOpacity={0.9}>
            <Text style={styles.primaryBtnText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  sheetWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    maxHeight: '86%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  typePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF4FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  typePillText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexGrow: 0,
    marginBottom: 12,
  },
  metaGrid: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  metaItem: {
    marginBottom: 8,
  },
  metaLabel: {
    fontSize: 11,
    color: '#64748B',
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  descriptionBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    marginBottom: 12,
  },
  descriptionText: {
    color: '#374151',
    fontSize: 14,
    lineHeight: 20,
  },
  sectionBlock: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  changeRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    marginBottom: 8,
  },
  changeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  changeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  changeAction: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
    textTransform: 'uppercase',
  },
  changeFrom: {
    color: '#6B7280',
    fontSize: 13,
    marginBottom: 2,
  },
  changeTo: {
    color: '#0F766E',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyChangesText: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  primaryBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
});

export default OperationDetailModal;

