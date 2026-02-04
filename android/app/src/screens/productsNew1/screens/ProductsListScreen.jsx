import React, { useState } from 'react';
import { View, FlatList, TouchableOpacity, Text, StyleSheet, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { useProducts } from '../hooks/useProducts';
import SearchBar from '../../../components/SearchBar';
import ProductCard from '../components/ProductCard';
import Icon from 'react-native-vector-icons/Ionicons';
import CreateAddButton from '../../../components/CreateAddButton';
import globalStyles from '../../../styles/globalStyles';

export default function ProductsListScreen({ navigation, route }) {
  const { products, loading, setQuery, clearQuery, query, refresh } = useProducts();
  const { role } = route.params ?? {};

  const [selectedProduct, setSelectedProduct] = useState(null);

  const openProductDetail = (prod) => {
    setSelectedProduct(prod);
  };

  const closeProductDetail = () => {
    setSelectedProduct(null);
  };

  const handleScan = (code) => {
      setQuery(code);
  };

  const handleRefresh = () => {
      clearQuery();
      refresh();
  };

  const renderProductItem = ({ item }) => {
    if (role === 'admin') {
      return (
        <ProductCard
          product={item}
          onPress={() => openProductDetail(item)}
          onEdit={() => navigation.navigate('EditProduct', { product: item })} // FIX: Pass the whole product object
          onAddStock={() => navigation.navigate('AddStock', { productId: item.id })}
          hideActions={false}
        />
      );
    } else {
      return (
        <ProductCard
          product={item}
          onPress={() => openProductDetail(item)}
          hideActions={true}
        />
      );
    }
  };

  const renderEmptyState = () => {
      if (loading) {
          return <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 40 }} />;
      }
      if (query) {
          return (
              <View style={styles.emptyContainer}>
                  <Icon name="search-outline" size={60} color="#ccc" />
                  <Text style={styles.emptyText}>No se encontró: "{query}"</Text>
                  {role === 'admin' ? (
                      <TouchableOpacity
                        style={styles.createBtn}
                        onPress={() => navigation.navigate('AddProduct', { scannedCode: query })}
                      >
                          <Icon name="add-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                          <Text style={styles.createBtnText}>Crear producto con este código</Text>
                      </TouchableOpacity>
                  ) : (
                      <Text style={styles.emptySubText}>Intenta con otro término de búsqueda.</Text>
                  )}
                  <TouchableOpacity style={styles.clearBtn} onPress={clearQuery}>
                      <Text style={styles.clearBtnText}>Volver a la lista completa</Text>
                  </TouchableOpacity>
              </View>
          );
      }
      return (
          <View style={styles.emptyContainer}>
              <Icon name="cube-outline" size={60} color="#eee" />
              <Text style={styles.emptyText}>No hay productos en el inventario.</Text>
          </View>
      );
  };

  return (
    <View style={globalStyles.container}>
      <View style={globalStyles.header}>
        <TouchableOpacity onPress={() => navigation.navigate("DashboardScreen")}>
          <Icon name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={globalStyles.title}>Inventario</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtnHeader}>
            <Icon name="refresh" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={{flexDirection: 'row', alignItems: 'center', paddingRight: 16}}>
          <View style={{flex: 1}}>
              <SearchBar
                value={query}
                onChangeText={setQuery}
                onClear={clearQuery}
                placeholder="Buscar por nombre o código"
                placeholderTextColor="#999"
              />
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('BarcodeScanner', { onScanned: handleScan })}
            style={styles.scanBtn}
          >
              <Icon name="scan" size={24} color="#007AFF" />
          </TouchableOpacity>
      </View>

      <FlatList
        data={products}
        keyExtractor={item => item.id}
        renderItem={renderProductItem}
        contentContainerStyle={{ paddingBottom: 80, paddingTop: 10, flexGrow: 1 }}
        ListEmptyComponent={renderEmptyState}
        refreshing={loading}
        onRefresh={handleRefresh}
      />

      <CreateAddButton
        screenName="AddProduct"
        visibleFor={['admin']}
        userType={role}
      />

      <Modal
        animationType="slide"
        transparent={true}
        visible={!!selectedProduct}
        onRequestClose={closeProductDetail}
      >
        <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={closeProductDetail}
        >
            <TouchableOpacity
                activeOpacity={1}
                style={styles.modalContent}
                onPress={() => {}}
            >
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Detalle del Producto</Text>
                    <TouchableOpacity onPress={closeProductDetail} style={styles.closeButton}>
                        <Icon name="close" size={24} color="#666" />
                    </TouchableOpacity>
                </View>

                <ScrollView style={{ padding: 16 }}>
                    {selectedProduct && (
                        <>
                            <View style={styles.headerInfo}>
                                <Text style={styles.largeName}>{selectedProduct.name}</Text>
                                <Text style={styles.largePrice}>${selectedProduct.salePrice ?? '0.00'}</Text>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Código de Barras</Text>
                                <Text style={styles.detailValue}>{selectedProduct.barcode || '---'}</Text>
                            </View>

                             <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Stock Disponible</Text>
                                <Text style={[styles.detailValue, { color: (selectedProduct.stock ?? 0) < 5 ? '#D32F2F' : '#2E7D32', fontWeight: 'bold' }]}>
                                    {selectedProduct.stock ?? 0} {selectedProduct.measureType === 'weight' ? 'kg/lb' : 'unidades'}
                                </Text>
                            </View>

                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Costo Compra</Text>
                                <Text style={styles.detailValue}>
                                    {role === 'admin' ? `$${selectedProduct.purchasePrice ?? '---'}` : '***'}
                                </Text>
                            </View>

                            {selectedProduct.description ? (
                                <View style={styles.descriptionBox}>
                                    <Text style={styles.detailLabel}>Descripción</Text>
                                    <Text style={styles.descriptionText}>{selectedProduct.description}</Text>
                                </View>
                            ) : null}

                            {selectedProduct.wholesalePrices && selectedProduct.wholesalePrices.length > 0 && (
                                <View style={styles.wholesaleContainer}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                        <Icon name="pricetags-outline" size={18} color="#007AFF" style={{ marginRight: 6 }} />
                                        <Text style={styles.wholesaleTitle}>Precios Mayorista</Text>
                                    </View>
                                    {selectedProduct.wholesalePrices.map((wp, idx) => (
                                        <View key={idx} style={styles.wholesaleRow}>
                                            <Text style={styles.wholesaleQty}>Más de {wp.quantity} u.</Text>
                                            <Text style={styles.wholesalePrice}>${wp.price}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </>
                    )}
                </ScrollView>

                 <View style={styles.modalFooter}>
                    {role === 'admin' && selectedProduct && (
                        <TouchableOpacity
                            style={styles.editModalBtn}
                            onPress={() => {
                                closeProductDetail();
                                navigation.navigate('EditProduct', { product: selectedProduct }); // FIX: Pass the whole product object
                            }}
                        >
                            <Text style={styles.editModalBtnText}>Editar Producto</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.closeModalBtn} onPress={closeProductDetail}>
                        <Text style={styles.closeModalBtnText}>Cerrar</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
    refreshBtnHeader: {
        padding: 8,
        marginRight: -8
    },
    scanBtn: {
        backgroundColor: '#fff',
        padding: 10,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 2 },
        marginTop: 10,
        marginBottom: 10,
        justifyContent: 'center',
        alignItems: 'center',
        height: 48,
        width: 48
    },
    clearIconBtn: {
        padding: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 4
    },
    // Estilos para Empty State
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
        paddingHorizontal: 20
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#555',
        marginTop: 16,
        textAlign: 'center',
        marginBottom: 8
    },
    emptySubText: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
        marginBottom: 20
    },
    createBtn: {
        flexDirection: 'row',
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 30,
        alignItems: 'center',
        marginTop: 20,
        elevation: 3
    },
    createBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 15
    },
    clearBtn: {
        marginTop: 20,
        padding: 10
    },
    clearBtnText: {
        color: '#007AFF',
        fontSize: 15
    },
    // Estilos del Modal (se mantienen igual)
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '85%',
        minHeight: '50%',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#111'
    },
    closeButton: {
        padding: 4,
        backgroundColor: '#f2f2f2',
        borderRadius: 20
    },
    headerInfo: {
        marginBottom: 16,
    },
    largeName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4
    },
    largePrice: {
        fontSize: 28,
        fontWeight: '900',
        color: '#007AFF'
    },
    divider: {
        height: 1,
        backgroundColor: '#eee',
        marginBottom: 16
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f9f9f9'
    },
    detailLabel: {
        fontSize: 14,
        color: '#888',
        fontWeight: '600',
    },
    detailValue: {
        fontSize: 16,
        color: '#333',
        fontWeight: '500'
    },
    descriptionBox: {
        backgroundColor: '#F5F6FA',
        padding: 12,
        borderRadius: 12,
        marginBottom: 16
    },
    descriptionText: {
        color: '#555',
        marginTop: 6,
        lineHeight: 20
    },
    wholesaleContainer: {
        marginTop: 4,
        backgroundColor: '#E3F2FD',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20
    },
    wholesaleTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#007AFF'
    },
    wholesaleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
        paddingBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.5)'
    },
    wholesaleQty: {
        color: '#444',
        fontWeight: '500'
    },
    wholesalePrice: {
        color: '#007AFF',
        fontWeight: '800'
    },
    modalFooter: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        flexDirection: 'column',
        gap: 10
    },
    editModalBtn: {
        backgroundColor: '#007AFF',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 8
    },
    editModalBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold'
    },
    closeModalBtn: {
        backgroundColor: '#f2f2f2',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center'
    },
    closeModalBtnText: {
        color: '#333',
        fontSize: 16,
        fontWeight: '600'
    }
});