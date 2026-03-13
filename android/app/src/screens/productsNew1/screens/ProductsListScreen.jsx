import React, { useState } from 'react';
import { View, FlatList, TouchableOpacity, Text, StyleSheet, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { useProducts } from '../hooks/useProducts';
import SearchBar from '../../../components/SearchBar';
import ProductCard from '../components/ProductCard';
import Icon from 'react-native-vector-icons/Ionicons';
import CreateAddButton from '../../../components/CreateAddButton';
import globalStyles from '../../../styles/globalStyles';
import { DEFAULT_CATEGORY_LABEL, getCategoryLabel, normalizeCategory } from '../constants/productCategories';
import { useProductCategories } from '../hooks/useProductCategories';

export default function ProductsListScreen({ navigation, route }) {
  const {
    products,
    loading,
    setQuery,
    clearQuery,
    query,
    refresh,
    categories,
    categoryFilter,
    setCategoryFilter,
    clearFilters,
  } = useProducts();
  const { categories: managedCategories } = useProductCategories();
  const { role } = route.params ?? {};

  const filterCategories = React.useMemo(() => {
    const merged = new Set();
    managedCategories.forEach((item) => {
      const category = normalizeCategory(item);
      if (category) merged.add(category);
    });
    categories.forEach((item) => {
      const category = normalizeCategory(item);
      if (category) merged.add(category);
    });
    return Array.from(merged).sort((a, b) => a.localeCompare(b));
  }, [managedCategories, categories]);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [actionsMenuVisible, setActionsMenuVisible] = useState(false);

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
      clearFilters();
      refresh();
  };

  const hasActiveFilters = !!query || categoryFilter !== 'all';

  const renderProductItem = ({ item }) => {
    if (role === 'admin') {
      return (
        <ProductCard
          product={item}
          onPress={() => openProductDetail(item)}
          onEdit={() => navigation.navigate('EditProduct', { product: item })}
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
      if (hasActiveFilters) {
          return (
              <View style={styles.emptyContainer}>
                  <Icon name="search-outline" size={60} color="#ccc" />
                  <Text style={styles.emptyText}>No se encontraron productos con esos filtros.</Text>
                  {!!query && <Text style={styles.emptySubText}>Busqueda: "{query}"</Text>}
                  {categoryFilter !== 'all' && <Text style={styles.emptySubText}>Categoria: {categoryFilter}</Text>}
                  {role === 'admin' && !!query ? (
                      <TouchableOpacity
                        style={styles.createBtn}
                        onPress={() => navigation.navigate('AddProduct', { scannedCode: query })}
                      >
                          <Icon name="add-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                          <Text style={styles.createBtnText}>Crear producto con este codigo</Text>
                      </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
                      <Text style={styles.clearBtnText}>Limpiar filtros</Text>
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
        <Text style={[globalStyles.title, styles.headerTitle]}>Inventario</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtnHeader}>
            <Icon name="refresh" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActionsMenuVisible((prev) => !prev)}
            style={[styles.headerMenuBtn, hasActiveFilters && styles.headerMenuBtnActive]}
          >
            <Icon name="ellipsis-vertical" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {actionsMenuVisible && (
        <>
          <TouchableOpacity style={styles.topActionsBackdrop} activeOpacity={1} onPress={() => setActionsMenuVisible(false)} />
          <View style={styles.topActionsMenu}>
            <TouchableOpacity
              style={styles.topActionsMenuOption}
              onPress={() => {
                setActionsMenuVisible(false);
                setFilterModalVisible(true);
              }}
            >
              <Icon name="options-outline" size={18} color="#007AFF" />
              <Text style={styles.topActionsMenuOptionText}>Filtros</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.topActionsMenuOption}
              onPress={() => {
                setActionsMenuVisible(false);
                navigation.navigate('ProductsAggregates');
              }}
            >
              <Icon name="stats-chart" size={18} color="#007AFF" />
              <Text style={styles.topActionsMenuOptionText}>Resumen</Text>
            </TouchableOpacity>

            {role === 'admin' && (
              <TouchableOpacity
                style={styles.topActionsMenuOption}
                onPress={() => {
                  setActionsMenuVisible(false);
                  navigation.navigate('ManageCategories', { role });
                }}
              >
                <Icon name="pricetags-outline" size={18} color="#007AFF" />
                <Text style={styles.topActionsMenuOptionText}>Categorias</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            onClear={clearQuery}
            placeholder="Buscar por nombre o codigo"
            placeholderTextColor="#999"
            style={[styles.fullSearchBar, styles.searchBarCompact]}
          />

          <TouchableOpacity
            onPress={() => navigation.navigate('BarcodeScanner', { onScanned: handleScan })}
            style={styles.scanIconBtn}
          >
            <Icon name="scan" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      {categoryFilter !== 'all' && (
        <View style={styles.activeFilterRow}>
          <Text style={styles.activeFilterText}>Filtrando por: {categoryFilter}</Text>
          <TouchableOpacity onPress={() => setCategoryFilter('all')}>
            <Text style={styles.clearFilterText}>Quitar</Text>
          </TouchableOpacity>
        </View>
      )}

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
        animationType="fade"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity style={styles.filterOverlay} activeOpacity={1} onPress={() => setFilterModalVisible(false)}>
          <TouchableOpacity style={styles.filterModal} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.filterTitle}>Filtrar por categoria</Text>

            <TouchableOpacity
              onPress={() => {
                setCategoryFilter('all');
                setFilterModalVisible(false);
              }}
              style={[styles.filterOption, categoryFilter === 'all' && styles.filterOptionActive]}
            >
              <Text style={[styles.filterOptionText, categoryFilter === 'all' && styles.filterOptionTextActive]}>
                Todas
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setCategoryFilter(DEFAULT_CATEGORY_LABEL);
                setFilterModalVisible(false);
              }}
              style={[styles.filterOption, categoryFilter === DEFAULT_CATEGORY_LABEL && styles.filterOptionActive]}
            >
              <Text style={[styles.filterOptionText, categoryFilter === DEFAULT_CATEGORY_LABEL && styles.filterOptionTextActive]}>
                {DEFAULT_CATEGORY_LABEL}
              </Text>
            </TouchableOpacity>

            {filterCategories.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => {
                  setCategoryFilter(cat);
                  setFilterModalVisible(false);
                }}
                style={[styles.filterOption, categoryFilter === cat && styles.filterOptionActive]}
              >
                <Text style={[styles.filterOptionText, categoryFilter === cat && styles.filterOptionTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.clearFilterBtn} onPress={() => { clearFilters(); setFilterModalVisible(false); }}>
              <Text style={styles.clearFilterBtnText}>Limpiar filtros</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
                                <Text style={styles.detailLabel}>Categoria</Text>
                                <Text style={styles.detailValue}>{getCategoryLabel(selectedProduct)}</Text>
                            </View>

                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Codigo de Barras</Text>
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
                                    <Text style={styles.detailLabel}>Descripcion</Text>
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
                                            <Text style={styles.wholesaleQty}>Mas de {wp.quantity} u.</Text>
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
                                navigation.navigate('EditProduct', { product: selectedProduct });
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
        marginRight: 0,
    },
    headerTitle: {
        flex: 1,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    headerMenuBtn: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    headerMenuBtnActive: {
        backgroundColor: 'rgba(255,255,255,0.35)',
    },
    topActionsBackdrop: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 20,
    },
    topActionsMenu: {
        position: 'absolute',
        top: 100,
        right: 16,
        zIndex: 30,
        width: 185,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOpacity: 0.14,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
        overflow: 'hidden',
    },
    topActionsMenuOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 11,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    topActionsMenuOptionText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },
    searchSection: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 4,
        backgroundColor: '#F7F9FC',
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    fullSearchBar: {
        paddingHorizontal: 0,
        marginTop: 0,
        marginBottom: 8,
    },
    searchBarCompact: {
        flex: 1,
        marginBottom: 0,
    },
    scanIconBtn: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 0,
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
    },
    summaryBtn: {
        flex: 1,
        backgroundColor: '#fff',
        paddingHorizontal: 10,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 2 },
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        height: 42,
        marginTop: 0,
        marginBottom: 6,
        marginRight: 0,
    },
    activeFilterBtn: {
        backgroundColor: '#007AFF',
    },
    scanBtn: {
        flex: 1,
        backgroundColor: '#fff',
        paddingHorizontal: 10,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 2 },
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        height: 42,
        marginTop: 0,
        marginBottom: 6,
        marginRight: 0,
    },
    menuBtn: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 2 },
    },
    activeFilterRow: {
        marginHorizontal: 16,
        marginBottom: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#EAF3FF',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    activeFilterText: {
        color: '#005FCC',
        fontSize: 13,
        fontWeight: '600',
    },
    clearFilterText: {
        color: '#007AFF',
        fontWeight: '700',
    },
    filterOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    actionsMenuModal: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 16,
    },
    actionsMenuTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111',
        marginBottom: 8,
    },
    actionsMenuOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    actionsMenuOptionText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },
    filterModal: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 16,
        maxHeight: '75%',
    },
    filterTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111',
        marginBottom: 12,
    },
    filterOption: {
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginBottom: 8,
        backgroundColor: '#F4F6F8',
    },
    filterOptionActive: {
        backgroundColor: '#007AFF',
    },
    filterOptionText: {
        color: '#333',
        fontWeight: '600',
    },
    filterOptionTextActive: {
        color: '#fff',
    },
    clearFilterBtn: {
        marginTop: 8,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        backgroundColor: '#EEF3F8',
    },
    clearFilterBtnText: {
        color: '#007AFF',
        fontWeight: '700',
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
        marginBottom: 4
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
    },
    actionText: {
        marginLeft: 6,
        fontSize: 12,
        fontWeight: '700',
        color: '#007AFF',
    },
    actionTextActive: {
        color: '#fff',
    },
});
