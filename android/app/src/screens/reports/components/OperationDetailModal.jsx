import React, { useEffect, useMemo } from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Pressable,
    TouchableWithoutFeedback,
} from 'react-native';

// --- Componentes y Helpers ---

const DetailItem = ({ label, value }) => (
    <View style={styles.detailItemContainer}>
        <Text style={styles.field}>{label}</Text>
        <Text style={styles.value}>{value ?? 'No disponible'}</Text>
    </View>
);

// Mapeo de tipos de operación a etiquetas legibles.
const OPERATION_TYPE_LABELS = {
    create: 'Creación de Producto',
    update: 'Actualización de Producto',
    delete: 'Eliminación de Producto',
    stock_change: 'Ajuste de Stock',
};

// Mapeo de claves de campos a etiquetas en español.
const FIELD_LABELS = {
    name: 'Nombre',
    description: 'Descripción',
    price: 'Precio',
    cost: 'Costo',
    stock: 'Stock',
    category: 'Categoría',
    unit: 'Unidad',
    sku: 'SKU',
    barcode: 'Código de Barras',
    quantity: 'Cantidad',
    notes: 'Notas',
    reason: 'Motivo',
    resultingStock: 'Stock Resultante',
    purchasePrice: 'Precio de Compra',
    salePrice: 'Precio de Venta',
    wholesalePrices: 'Precios por Mayor',
    changes: 'Cambios',
};

// --- Componente Principal ---

const OperationDetailModal = ({ item, visible, onClose }) => {

    useEffect(() => {
        if (item) {
            console.log('Detalles de la operación seleccionada:', JSON.stringify(item));
        }
    }, [item]);

    const formattedDate = useMemo(() => {
        const timestamp = item?.timestamp || item?.createdAt;
        if (!timestamp) return 'No disponible';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date instanceof Date ? date.toLocaleString() : 'Fecha inválida';
    }, [item]);

    const operationLabel = OPERATION_TYPE_LABELS[item?.operationType] || item?.operationType || 'No especificada';

    // --- Funciones de Renderizado ---

    const formatValue = (value, key) => {
        if (value === null || value === undefined) return 'No disponible';

        // Formato para precios
        if (['price', 'cost', 'purchasePrice', 'salePrice'].includes(key)) {
            return `$${Number(value).toFixed(2)}`;
        }

        // Formato para precios por mayor
        if (key === 'wholesalePrices' && Array.isArray(value)) {
            if (value.length === 0) return 'Ninguno';
            return value.map(wp => `  - Cant: ${wp.quantity}, Precio: $${Number(wp.price).toFixed(2)}`).join('\n');
        }

        return typeof value === 'object' ? JSON.stringify(value) : String(value);
    };

    const renderDetailValue = (value, key) => {
        // Maneja la estructura { from: ..., to: ... } o { oldValue: ..., newValue: ... }
        const oldValue = value?.from ?? value?.oldValue;
        const newValue = value?.to ?? value?.newValue;

        if (oldValue !== undefined && newValue !== undefined) {
            const formattedOld = formatValue(oldValue, key);
            const formattedNew = formatValue(newValue, key);
            return `${formattedOld}\n  → ${formattedNew}`;
        }
        return formatValue(value, key);
    };

    const renderOperationDetails = () => {
        if (!item) return null;
        const detailsExist = item.details && typeof item.details === 'object' && Object.keys(item.details).length > 0;
    
        return (
            <>
                <DetailItem label="Tipo de Operación" value={operationLabel} />
                <DetailItem label="Producto" value={item.productName} />
                <DetailItem label="Realizado por" value={item.email} />
                <DetailItem label="Fecha" value={formattedDate} />
                
                {detailsExist && (
                    <>
                        <View style={styles.separator} />
                        <Text style={styles.subTitle}>Cambios Realizados</Text>
                        {Object.entries(item.details).map(([key, value]) => {
                            if (key === 'description') return null;
    
                            if (key === 'changes' && typeof value === 'object' && value !== null) {
                                return Object.entries(value).map(([changeKey, changeValue]) => {
                                    const oldValue = changeValue?.from ?? changeValue?.oldValue;
                                    const newValue = changeValue?.to ?? changeValue?.newValue;
    
                                    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
                                        return null;
                                    }
    
                                    const translatedLabel = FIELD_LABELS[changeKey] || changeKey;
                                    return <DetailItem key={changeKey} label={translatedLabel} value={renderDetailValue(changeValue, changeKey)} />;
                                });
                            }
                            
                            const oldValue = value?.from ?? value?.oldValue;
                            const newValue = value?.to ?? value?.newValue;
    
                            if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
                                return null;
                            }
    
                            const translatedLabel = FIELD_LABELS[key] || key;
                            return <DetailItem key={key} label={translatedLabel} value={renderDetailValue(value, key)} />;
                        })}
                    </>
                )}
            </>
        );
    };

    return (
        <Modal
          animationType="slide"
          transparent
          visible={Boolean(visible && item)}
          onRequestClose={onClose}
        >
          {/* Backdrop */}
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={styles.backdrop} />
          </TouchableWithoutFeedback>

          {/* Contenido del modal */}
          <View style={styles.centeredWrapper}>
            <View style={styles.modalView}>
              <Text style={styles.modalTitle}>Detalle de Operación</Text>

              <ScrollView
                style={styles.detailsScrollView}
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
              >
                {renderOperationDetails()}
              </ScrollView>

              <TouchableOpacity
                style={styles.button}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

    );
};

// --- Estilos ---

const styles = StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.6)',
    },

    centeredWrapper: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalView: {
      width: '90%',
      maxHeight: '80%',
      backgroundColor: '#fff',
      borderRadius: 20,
      padding: 24,
      elevation: 6,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 20,
        color: '#222',
    },
    detailsScrollView: {
      flexGrow: 0,
    },
    detailItemContainer: {
        marginBottom: 12,
    },
    field: {
        fontSize: 14,
        fontWeight: '600',
        color: '#555',
        textTransform: 'capitalize',
    },
    value: {
        fontSize: 16,
        marginTop: 4,
        color: '#333',
        lineHeight: 24, // Mejora la legibilidad para valores multilínea
    },
    button: {
        backgroundColor: '#007AFF',
        borderRadius: 12,
        paddingVertical: 14,
        marginTop: 10,
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        textAlign: 'center',
        fontSize: 16,
    },
    separator: {
        height: 1,
        backgroundColor: '#e0e0e0',
        marginVertical: 16,
    },
    subTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 10,
    },
});

export default OperationDetailModal;