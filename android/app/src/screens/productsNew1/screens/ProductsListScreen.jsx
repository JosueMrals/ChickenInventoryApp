import React, { useState, useMemo } from 'react';
import { View, FlatList, TouchableOpacity, Text, StyleSheet, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { useProducts } from '../hooks/useProducts';
import SearchBar from '../../../components/SearchBar';
import ProductCard from '../components/ProductCard';
import Icon from 'react-native-vector-icons/Ionicons';
import CreateAddButton from '../../../components/CreateAddButton';
import globalStyles from '../../../styles/globalStyles';
import { DEFAULT_CATEGORY_LABEL, getCategoryLabel, normalizeCategory } from '../constants/productCategories';
import { useProductCategories } from '../hooks/useProductCategories';
import { useRoutes } from '../hooks/useRoutes';
import { useRoute as useRouteContext } from '../../../context/RouteContext';

export default function ProductsListScreen({ navigation, route }) {
  const {
    products,
    loading,
    loadingMore,
    hasMore,
    setQuery,
    clearQuery,
    query,
    refresh,
    loadMore,
    categories,
    categoryFilter,
    setCategoryFilter,
    clearFilters,
  } = useProducts();
  const { categories: managedCategories } = useProductCategories();
  const { routes: availableRoutes } = useRoutes();
  const { selectedRoute } = useRouteContext();
  const { role } = route.params ?? {};

  // Filtro de ruta para admin (permite ver el precio de una ruta específica)
  const [adminRouteFilter, setAdminRouteFilter] = useState('all');

  const selectedAdminRoute = useMemo(() => {
    if (adminRouteFilter === 'all') return null;
    return availableRoutes.find((r) => r.id === adminRouteFilter) ?? null;
  }, [adminRouteFilter, availableRoutes]);

  /** Calcula el precio a mostrar en la tarjeta según el rol y la ruta activa */
  const getProductDisplayInfo = (product) => {
    const routePrices = product?.routePrices || [];
    if (role === 'admin') {
      if (selectedAdminRoute) {
        const rp = routePrices.find((r) => r.routeId === selectedAdminRoute.id);
        if (rp) return { price: rp.price, label: selectedAdminRoute.name };
      }
      return { price: product?.salePrice ?? '0.00', label: null };
    }
    // No-admin: usa la ruta seleccionada del contexto
    if (selectedRoute) {
      const rp = routePrices.find((r) => r.routeId === selectedRoute.id);
      if (rp) return { price: rp.price, label: selectedRoute.name };
    }
    return { price: product?.salePrice ?? '0.00', label: null };
  };

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

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [actionsMenuVisible, setActionsMenuVisible] = useState(false);

  const openProductDetail = (prod) => {
    navigation.navigate('ProductDetail', { product: prod, role });
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
    const { price, label } = getProductDisplayInfo(item);
    if (role === 'admin') {
      return (
        <ProductCard
          product={item}
          onPress={() => openProductDetail(item)}
          onEdit={() => navigation.navigate('EditProduct', { product: item })}
          onAddStock={() => navigation.navigate('AddStock', { productId: item.id })}
          hideActions={false}
          routePrice={label ? price : undefined}
          routeLabel={label}
        />
      );
    } else {
      return (
        <ProductCard
          product={item}
          onPress={() => openProductDetail(item)}
          hideActions={true}
          routePrice={label ? price : undefined}
          routeLabel={label}
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

  const renderListFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.listFooterLoading}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.listFooterText}>Cargando mas productos...</Text>
        </View>
      );
    }

    if (!loading && !hasMore && products.length > 0 && !query) {
      return (
        <View style={styles.listFooterDone}>
          <Text style={styles.listFooterDoneText}>Fin de la lista</Text>
        </View>
      );
    }

    return <View style={styles.listFooterSpacer} />;
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

      {/* Chips de ruta para admin */}
      {role === 'admin' && availableRoutes.length > 0 && (
        <View style={styles.routeChipsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.routeChipsContent}>
            <TouchableOpacity
              onPress={() => setAdminRouteFilter('all')}
              style={[styles.routeChip, adminRouteFilter === 'all' && styles.routeChipActive]}>
              <Icon name="pricetag-outline" size={11} color={adminRouteFilter === 'all' ? '#fff' : '#7C3AED'} />
              <Text style={[styles.routeChipText, adminRouteFilter === 'all' && styles.routeChipTextActive]}>
                Precio base
              </Text>
            </TouchableOpacity>
            {availableRoutes.map((r) => (
              <TouchableOpacity
                key={r.id}
                onPress={() => setAdminRouteFilter(r.id)}
                style={[styles.routeChip, adminRouteFilter === r.id && styles.routeChipActive]}>
                <Icon name="navigate" size={11} color={adminRouteFilter === r.id ? '#fff' : '#7C3AED'} />
                <Text style={[styles.routeChipText, adminRouteFilter === r.id && styles.routeChipTextActive]} numberOfLines={1}>
                  {r.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Banner de ruta activa para no-admin */}
      {role !== 'admin' && selectedRoute && (
        <View style={styles.userRouteBanner}>
          <Icon name="navigate" size={14} color="#7C3AED" />
          <Text style={styles.userRouteBannerText}>Ruta activa: <Text style={{ fontWeight: '800' }}>{selectedRoute.name}</Text></Text>
        </View>
      )}

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
        ListFooterComponent={renderListFooter}
        refreshing={loading}
        onRefresh={handleRefresh}
        onEndReached={loadMore}
        onEndReachedThreshold={0.45}
        initialNumToRender={14}
        maxToRenderPerBatch={18}
        windowSize={11}
        removeClippedSubviews
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
        flexShrink: 0,
        flexGrow: 0,
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
    listFooterLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
    },
    listFooterText: {
        fontSize: 13,
        color: '#3B82F6',
        fontWeight: '600',
    },
    listFooterDone: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    listFooterDoneText: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '700',
    },
    listFooterSpacer: {
        height: 8,
    },

    // ── Chips de ruta (admin) ─────────────────────────────────────────────────
    routeChipsWrapper: {
        height: 48,
        flexShrink: 0,
        flexGrow: 0,
        backgroundColor: '#F7F9FC',
        borderBottomWidth: 1,
        borderBottomColor: '#EBEBEB',
        overflow: 'hidden',
    },
    routeChipsContent: {
        height: 48,
        paddingHorizontal: 12,
        gap: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    routeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        height: 32,
        borderRadius: 20,
        backgroundColor: '#F5F3FF',
        borderWidth: 1,
        borderColor: '#DDD6FE',
    },
    routeChipActive: {
        backgroundColor: '#7C3AED',
        borderColor: '#7C3AED',
    },
    routeChipText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#7C3AED',
        maxWidth: 100,
    },
    routeChipTextActive: {
        color: '#fff',
    },

    // ── Banner de ruta activa (no-admin) ──────────────────────────────────────
    userRouteBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#F5F3FF',
        borderBottomWidth: 1,
        borderBottomColor: '#DDD6FE',
    },
    userRouteBannerText: {
        fontSize: 12,
        color: '#4C1D95',
        fontWeight: '500',
    },
});
