import React, { useState, useCallback, useMemo } from 'react';
import firestore from '@react-native-firebase/firestore';
import {
  View, Text, FlatList, TouchableOpacity,
  LayoutAnimation, Platform, UIManager, StyleSheet, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { warehouseStyles as baseStyles } from '../styles/warehouseStyles';
import { groupItemsByProduct, groupAggregatedProductsByCategory } from '../../../utils/warehouseUtils';
import { useAdaptiveBottom } from '../../../hooks/useAdaptiveBottom';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TAB_COLORS = {
  pending: '#F59E0B',
  preparing: '#3B82F6',
  ready: '#10B981',
};

const TABS = [
  { id: 'pending',   label: 'Pendientes', icon: 'time-outline' },
  { id: 'preparing', label: 'En Proceso', icon: 'construct-outline' },
  { id: 'ready',     label: 'Listos',     icon: 'checkmark-circle-outline' },
];

// ─── Sub-componente de fila de producto ───────────────────────────────────────
// Extraído como componente propio para evitar closures obsoletas y re-renders innecesarios
const ProductRow = React.memo(({ item, activeStatusTab, onAdvance, onRevert }) => {
  const activeColor = TAB_COLORS[activeStatusTab];

  return (
    <View style={s.productRow}>
      {/* Indicador de color de estado */}
      <View style={[s.statusBar, { backgroundColor: activeColor }]} />

      {/* Info del producto */}
      <View style={s.productInfo}>
        <Text style={s.productName} numberOfLines={1}>{item.name}</Text>
        {(item.regularQty > 0 || item.bonusQty > 0) && (
          <View style={s.qtyChips}>
            {item.regularQty > 0 && (
              <View style={[s.chip, { backgroundColor: '#ECFDF5' }]}>
                <Text style={[s.chipText, { color: '#059669' }]}>{item.regularQty} vta</Text>
              </View>
            )}
            {item.bonusQty > 0 && (
              <View style={[s.chip, { backgroundColor: '#EFF6FF' }]}>
                <Text style={[s.chipText, { color: '#2563EB' }]}>{item.bonusQty} reg</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Cantidad total */}
      <View style={[s.totalBubble, { borderColor: activeColor }]}>
        <Text style={[s.totalNum, { color: activeColor }]}>{item.totalQty}</Text>
      </View>

      {/* ── Botones de acción ────────────────────────────────────────────── */}
      <View style={s.actionGroup}>
        {/* Botón RETROCEDER (solo en EN PROCESO y LISTOS) */}
        {(activeStatusTab === 'preparing' || activeStatusTab === 'ready') && (
          <TouchableOpacity
            style={[s.iconBtn, { borderColor: TAB_COLORS[activeStatusTab === 'ready' ? 'preparing' : 'pending'] }]}
            onPress={() => onRevert(item.name)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
          >
            <Icon
              name="arrow-undo-outline"
              size={16}
              color={TAB_COLORS[activeStatusTab === 'ready' ? 'preparing' : 'pending']}
            />
          </TouchableOpacity>
        )}

        {/* Botón AVANZAR (solo en PENDIENTES y EN PROCESO) */}
        {activeStatusTab === 'pending' && (
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: TAB_COLORS.preparing }]}
            onPress={() => onAdvance(item.name)}
            activeOpacity={0.75}
          >
            <Icon name="construct-outline" size={13} color="#FFF" />
            <Text style={s.actionBtnText}>Preparar</Text>
          </TouchableOpacity>
        )}
        {activeStatusTab === 'preparing' && (
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: TAB_COLORS.ready }]}
            onPress={() => onAdvance(item.name)}
            activeOpacity={0.75}
          >
            <Icon name="checkmark-circle-outline" size={13} color="#FFF" />
            <Text style={s.actionBtnText}>Listo</Text>
          </TouchableOpacity>
        )}
        {activeStatusTab === 'ready' && (
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: TAB_COLORS.preparing }]}
            onPress={() => onRevert(item.name)}
            activeOpacity={0.75}
          >
            <Icon name="arrow-undo-outline" size={13} color="#FFF" />
            <Text style={s.actionBtnText}>Preparar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

// ─── Componente principal ──────────────────────────────────────────────────────
const DashboardPanel = ({ preSales, onHandoverPress, onStatusChange }) => {
  const [activeStatusTab, setActiveStatusTab] = useState('pending');
  const [productCategoryById, setProductCategoryById] = useState({});
  const [pendingOps, setPendingOps] = useState(new Set()); // IDs de operaciones en vuelo
  const { bottomPadding } = useAdaptiveBottom();

  // Listener de categorías de productos (solo para fallback de ítems legacy sin categoría embebida)
  React.useEffect(() => {
    const unsubscribe = firestore()
      .collection('products')
      .onSnapshot(
        (snap) => {
          const map = {};
          snap.forEach(doc => {
            const d = doc.data() || {};
            if (d.category) map[doc.id] = d.category;
          });
          setProductCategoryById(map);
        },
        (err) => {
          console.error('Categories snapshot error:', err);
          setProductCategoryById({});
        }
      );
    return () => unsubscribe();
  }, []);

  // ── Conteos por estado ─────────────────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts = { pending: 0, preparing: 0, ready: 0 };
    preSales.forEach(sale => {
      [...(sale.items || []), ...(sale.bonuses || [])].forEach(i => {
        const s = i.status || 'pending';
        if (counts[s] !== undefined) counts[s] += Number(i.quantity) || 0;
      });
    });
    return counts;
  }, [preSales]);

  // ── Datos agrupados y aplanados para FlatList ──────────────────────────────
  const { aggregatedProducts, flatListData, totalRegular, totalBonus } = useMemo(() => {
    const products = groupItemsByProduct(preSales, activeStatusTab, productCategoryById);
    const grouped  = groupAggregatedProductsByCategory(products);
    grouped.sort((a, b) => (a.category || '').localeCompare(b.category || ''));

    let tReg = 0, tBonus = 0;
    products.forEach(p => { tReg += p.regularQty; tBonus += p.bonusQty; });

    // Aplanar para FlatList (evita conflicto de gestos que ScrollView genera en Android)
    const rows = [];
    grouped.forEach(section => {
      rows.push({ type: 'header', id: `hdr-${activeStatusTab}-${section.category}`, ...section });
      section.products.forEach(product =>
        rows.push({ type: 'product', id: `prd-${activeStatusTab}-${product.key || product.name}`, ...product })
      );
    });

    return { aggregatedProducts: products, flatListData: rows, totalRegular: tReg, totalBonus: tBonus };
  }, [preSales, activeStatusTab, productCategoryById]);

  // ── Handlers de cambio de estado con feedback visual ──────────────────────
  const handleAdvance = useCallback((productName) => {
    const toStatus   = activeStatusTab === 'pending' ? 'preparing' : activeStatusTab === 'preparing' ? 'ready' : null;
    if (!toStatus) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onStatusChange?.(productName, activeStatusTab, toStatus);
  }, [activeStatusTab, onStatusChange]);

  const handleRevert = useCallback((productName) => {
    const toStatus = activeStatusTab === 'preparing' ? 'pending' : activeStatusTab === 'ready' ? 'preparing' : null;
    if (!toStatus) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onStatusChange?.(productName, activeStatusTab, toStatus);
  }, [activeStatusTab, onStatusChange]);

  // ── Render item para FlatList ──────────────────────────────────────────────
  const renderItem = useCallback(({ item }) => {
    if (item.type === 'header') {
      return (
        <View style={s.categoryHeader}>
          <Text style={s.categoryName}>{item.category}</Text>
          <View style={[s.categoryBadge, { backgroundColor: TAB_COLORS[activeStatusTab] + '20' }]}>
            <Text style={[s.categoryCount, { color: TAB_COLORS[activeStatusTab] }]}>{item.totalQty}</Text>
          </View>
        </View>
      );
    }
    return (
      <ProductRow
        item={item}
        activeStatusTab={activeStatusTab}
        onAdvance={handleAdvance}
        onRevert={handleRevert}
      />
    );
  }, [activeStatusTab, handleAdvance, handleRevert]);

  // ── Encabezado de la lista (barra resumen) ─────────────────────────────────
  const ListHeader = useMemo(() => (
    <View style={s.summaryBar}>
      <Text style={s.summaryTitle}>
        {activeStatusTab === 'pending' ? 'Por Preparar' : activeStatusTab === 'preparing' ? 'En Producción' : 'Listos para Entrega'}
      </Text>
      <View style={s.legendRow}>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: '#059669' }]} />
          <Text style={s.legendText}>{totalRegular} vta</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: '#2563EB' }]} />
          <Text style={s.legendText}>{totalBonus} reg</Text>
        </View>
      </View>
    </View>
  ), [activeStatusTab, totalRegular, totalBonus]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>
      {/* Barra de pestañas de estado */}
      <View style={s.tabBar}>
        {TABS.map(tab => {
          const active = activeStatusTab === tab.id;
          const color  = TAB_COLORS[tab.id];
          return (
            <TouchableOpacity
              key={tab.id}
              style={[s.tab, active && { backgroundColor: color + '18', borderBottomColor: color, borderBottomWidth: 2 }]}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setActiveStatusTab(tab.id);
              }}
            >
              <Icon name={tab.icon} size={14} color={active ? color : '#999'} />
              <Text style={[s.tabCount, active && { color }]}>{statusCounts[tab.id]}</Text>
              <Text style={[s.tabLabel, active && { color }]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Lista de productos (FlatList para compatibilidad con gestos nativos de Android) */}
      <FlatList
        data={flatListData}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <Icon name="file-tray-outline" size={40} color="#D1D5DB" />
            <Text style={s.emptyText}>Sin productos en esta etapa</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 24 }}
        removeClippedSubviews={false}
      />

      {/* Botón fijo de entrega al repartidor */}
      {activeStatusTab === 'ready' && aggregatedProducts.length > 0 && (
        <TouchableOpacity
          style={[baseStyles.handoverButton, { marginHorizontal: 16, marginBottom: bottomPadding }]}
          onPress={onHandoverPress}
          activeOpacity={0.8}
        >
          <Icon name="bicycle" size={22} color="#FFF" />
          <Text style={baseStyles.handoverButtonText}>Entregar Carga al Repartidor</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  /* Tab bar */
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EBEBEB' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 4 },
  tabCount: { fontSize: 15, fontWeight: '800', color: '#999' },
  tabLabel: { fontSize: 9, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.3 },

  /* Barra resumen */
  summaryBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingTop: 4 },
  summaryTitle: { fontSize: 13, fontWeight: '700', color: '#374151' },
  legendRow: { flexDirection: 'row', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '600', color: '#6B7280' },

  /* Header de categoría */
  categoryHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
    marginTop: 8, marginBottom: 2,
  },
  categoryName: { fontSize: 12, fontWeight: '700', color: '#374151', flex: 1 },
  categoryBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  categoryCount: { fontSize: 11, fontWeight: '800' },

  /* Fila de producto */
  productRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingVertical: 9, paddingRight: 10,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    borderRadius: 6, marginBottom: 2,
  },
  statusBar: { width: 4, borderRadius: 2, alignSelf: 'stretch', marginRight: 10, marginLeft: 2 },
  productInfo: { flex: 1, marginRight: 8 },
  productName: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  qtyChips: { flexDirection: 'row', gap: 4, marginTop: 2 },
  chip: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  chipText: { fontSize: 10, fontWeight: '700' },

  /* Badge de cantidad */
  totalBubble: {
    borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4,
    marginRight: 8, borderWidth: 1.5, backgroundColor: '#fff',
    minWidth: 36, alignItems: 'center',
  },
  totalNum: { fontSize: 14, fontWeight: '800' },

  /* Grupo de botones de acción */
  actionGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 }, shadowRadius: 2,
  },
  actionBtnText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  iconBtn: {
    borderWidth: 1.5, borderRadius: 7,
    padding: 5, alignItems: 'center', justifyContent: 'center',
  },

  /* Estado vacío */
  emptyState: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyText: { color: '#9CA3AF', fontSize: 13, fontWeight: '500' },
});

export default DashboardPanel;
