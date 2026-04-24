import React, { useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import { View, Text, ScrollView, TouchableOpacity, LayoutAnimation, Platform, UIManager, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { warehouseStyles as baseStyles } from '../styles/warehouseStyles';
import { groupItemsByProduct, groupAggregatedProductsByCategory } from '../../../utils/warehouseUtils';
import { Swipeable } from 'react-native-gesture-handler';
import { updateAggregateProductStatus } from '../../../services/preSaleService';
import { useAdaptiveBottom } from '../../../hooks/useAdaptiveBottom';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TAB_COLORS = {
  pending: '#F59E0B',
  preparing: '#3B82F6',
  ready: '#10B981',
};

const DashboardPanel = ({ preSales, onHandoverPress }) => {
    const [activeStatusTab, setActiveStatusTab] = useState('pending');
    const [productCategoryById, setProductCategoryById] = useState({});
    const { bottomPadding } = useAdaptiveBottom();

    React.useEffect(() => {
        const unsubscribe = firestore()
          .collection('products')
          .onSnapshot(
            (snapshot) => {
              const map = {};
              snapshot.forEach((doc) => {
                const data = doc.data() || {};
                if (data.category) map[doc.id] = data.category;
              });
              setProductCategoryById(map);
            },
            (error) => {
              console.error('Warehouse product categories snapshot error:', error);
              setProductCategoryById({});
            }
          );
        return () => unsubscribe();
    }, []);

    const statusCounts = React.useMemo(() => {
        const counts = { pending: 0, preparing: 0, ready: 0 };
        preSales.forEach(sale => {
             const items = [...(sale.items || []), ...(sale.bonuses || [])];
             items.forEach(i => {
                 const s = i.status || 'pending';
                 if (counts[s] !== undefined) counts[s] += (Number(i.quantity) || 0);
             });
        });
        return counts;
    }, [preSales]);

    const { aggregatedProducts, groupedByCategory, totalRegular, totalBonus } = React.useMemo(() => {
        const products = groupItemsByProduct(preSales, activeStatusTab, productCategoryById);
        const grouped = groupAggregatedProductsByCategory(products);
        grouped.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
        let tReg = 0, tBonus = 0;
        products.forEach(p => { tReg += p.regularQty; tBonus += p.bonusQty; });
        return { aggregatedProducts: products, groupedByCategory: grouped, totalRegular: tReg, totalBonus: tBonus };
    }, [preSales, activeStatusTab, productCategoryById]);

    const animateTransition = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    const handleSwipeRight = (productName) => {
        let prevStatus = '';
        if (activeStatusTab === 'ready') prevStatus = 'preparing';
        else if (activeStatusTab === 'preparing') prevStatus = 'pending';
        else return;
        animateTransition();
        updateAggregateProductStatus(productName, prevStatus, activeStatusTab);
    };

    const handleSwipeLeft = (productName) => {
        let nextStatus = '';
        if (activeStatusTab === 'pending') nextStatus = 'preparing';
        else if (activeStatusTab === 'preparing') nextStatus = 'ready';
        else return;
        animateTransition();
        updateAggregateProductStatus(productName, nextStatus, activeStatusTab);
    };

    const activeColor = TAB_COLORS[activeStatusTab];

    const renderRightActions = () => {
        if (activeStatusTab === 'pending') return null;
        const label = activeStatusTab === 'ready' ? 'Preparar' : 'Pendiente';
        const color = activeStatusTab === 'ready' ? TAB_COLORS.preparing : TAB_COLORS.pending;
        const icon = activeStatusTab === 'ready' ? 'construct-outline' : 'time-outline';
        return (
            <View style={[s.swipeAction, { backgroundColor: color }]}>
                <Icon name={icon} size={20} color="#FFF" />
                <Text style={s.swipeLabel}>{label}</Text>
            </View>
        );
    };

    const renderLeftActions = () => {
        if (activeStatusTab === 'ready') return null;
        const label = activeStatusTab === 'pending' ? 'Preparar' : 'Listo';
        const color = activeStatusTab === 'pending' ? TAB_COLORS.preparing : TAB_COLORS.ready;
        const icon = activeStatusTab === 'pending' ? 'construct-outline' : 'checkmark-circle-outline';
        return (
            <View style={[s.swipeAction, { backgroundColor: color }]}>
                <Icon name={icon} size={20} color="#FFF" />
                <Text style={s.swipeLabel}>{label}</Text>
            </View>
        );
    };

    const renderProductRow = (item) => (
      <Swipeable
        key={`${item.key || item.name}-${activeStatusTab}`}
        renderRightActions={activeStatusTab !== 'pending' ? renderRightActions : undefined}
        renderLeftActions={activeStatusTab !== 'ready' ? renderLeftActions : undefined}
        onSwipeableRightOpen={() => activeStatusTab !== 'pending' && handleSwipeRight(item.name)}
        onSwipeableLeftOpen={() => activeStatusTab !== 'ready' && handleSwipeLeft(item.name)}
      >
        <View style={s.productRow}>
          <View style={[s.bullet, { backgroundColor: activeColor }]} />
          <View style={{ flex: 1 }}>
            <Text style={s.productName}>{item.name}</Text>
            {(item.regularQty > 0 || item.bonusQty > 0) && (
              <View style={s.qtyChips}>
                {item.regularQty > 0 && (
                  <View style={[s.chip, { backgroundColor: '#ECFDF5' }]}>
                    <Text style={[s.chipText, { color: '#059669' }]}>{item.regularQty} venta</Text>
                  </View>
                )}
                {item.bonusQty > 0 && (
                  <View style={[s.chip, { backgroundColor: '#EFF6FF' }]}>
                    <Text style={[s.chipText, { color: '#2563EB' }]}>{item.bonusQty} regalo</Text>
                  </View>
                )}
              </View>
            )}
          </View>
          <View style={s.totalBubble}>
            <Text style={s.totalNum}>{item.totalQty}</Text>
          </View>
        </View>
      </Swipeable>
    );

    const totalAll = statusCounts.pending + statusCounts.preparing + statusCounts.ready;

    return (
        <View style={{ flex: 1 }}>
            {/* Tabs */}
            <View style={s.tabBar}>
                {[
                  { id: 'pending', label: 'Pendientes', icon: 'time-outline' },
                  { id: 'preparing', label: 'En Proceso', icon: 'construct-outline' },
                  { id: 'ready', label: 'Listos', icon: 'checkmark-circle-outline' },
                ].map(tab => {
                  const active = activeStatusTab === tab.id;
                  const color = TAB_COLORS[tab.id];
                  return (
                    <TouchableOpacity
                      key={tab.id}
                      style={[s.tab, active && { backgroundColor: color + '15', borderBottomColor: color, borderBottomWidth: 2 }]}
                      onPress={() => setActiveStatusTab(tab.id)}
                    >
                      <Icon name={tab.icon} size={14} color={active ? color : '#999'} />
                      <Text style={[s.tabCount, active && { color }]}>{statusCounts[tab.id]}</Text>
                      <Text style={[s.tabLabel, active && { color }]}>{tab.label}</Text>
                    </TouchableOpacity>
                  );
                })}
            </View>

            <ScrollView style={{ flex: 1, paddingHorizontal: 12 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 12, paddingBottom: 20 }}>

                {/* Summary bar */}
                <View style={s.summaryBar}>
                    <Text style={s.summaryTitle}>
                        {activeStatusTab === 'pending' ? 'Por Preparar' : activeStatusTab === 'preparing' ? 'En Producción' : 'Listos para Entrega'}
                    </Text>
                    <View style={s.legendRow}>
                        <View style={s.legendItem}>
                            <View style={[s.legendDot, { backgroundColor: '#059669' }]} />
                            <Text style={s.legendText}>{totalRegular}</Text>
                        </View>
                        <View style={s.legendItem}>
                            <View style={[s.legendDot, { backgroundColor: '#2563EB' }]} />
                            <Text style={s.legendText}>{totalBonus}</Text>
                        </View>
                    </View>
                </View>

                {/* Categories */}
                {groupedByCategory.map((section) => (
                    <View key={`${activeStatusTab}-${section.category}`} style={s.categoryBlock}>
                        <View style={s.categoryHeader}>
                            <Text style={s.categoryName}>{section.category}</Text>
                            <View style={s.categoryBadge}>
                                <Text style={s.categoryCount}>{section.totalQty}</Text>
                            </View>
                        </View>
                        {section.products.map((item) => renderProductRow(item))}
                    </View>
                ))}

                {aggregatedProducts.length === 0 && (
                    <View style={s.emptyState}>
                        <Icon name="file-tray-outline" size={36} color="#D1D5DB" />
                        <Text style={s.emptyText}>No hay productos en esta etapa</Text>
                    </View>
                )}
            </ScrollView>

            {/* Fixed handover button */}
            {activeStatusTab === 'ready' && aggregatedProducts.length > 0 && (
                <TouchableOpacity style={[baseStyles.handoverButton, { marginHorizontal: 16, marginBottom: bottomPadding }]} onPress={onHandoverPress}>
                    <Icon name="bicycle" size={24} color="white" />
                    <Text style={baseStyles.handoverButtonText}>Entregar Carga al Repartidor</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const s = StyleSheet.create({
    tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, gap: 4 },
    tabCount: { fontSize: 14, fontWeight: '800', color: '#999' },
    tabLabel: { fontSize: 9, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.3 },

    summaryBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    summaryTitle: { fontSize: 14, fontWeight: '700', color: '#374151' },
    legendRow: { flexDirection: 'row', gap: 12 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 11, fontWeight: '700', color: '#6B7280' },

    categoryBlock: { marginBottom: 8 },
    categoryHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 4,
    },
    categoryName: { fontSize: 12, fontWeight: '700', color: '#374151' },
    categoryBadge: { backgroundColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
    categoryCount: { fontSize: 11, fontWeight: '800', color: '#4B5563' },

    productRow: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
        paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
    },
    bullet: { width: 6, height: 6, borderRadius: 3, marginRight: 10 },
    productName: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
    qtyChips: { flexDirection: 'row', gap: 6, marginTop: 3 },
    chip: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
    chipText: { fontSize: 10, fontWeight: '700' },
    totalBubble: { backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
    totalNum: { fontSize: 14, fontWeight: '800', color: '#1F2937' },

    swipeAction: { justifyContent: 'center', alignItems: 'center', width: 72, gap: 2 },
    swipeLabel: { color: '#fff', fontSize: 10, fontWeight: '700' },

    emptyState: { alignItems: 'center', marginTop: 50, gap: 8 },
    emptyText: { color: '#9CA3AF', fontSize: 13 },
});

export default DashboardPanel;
