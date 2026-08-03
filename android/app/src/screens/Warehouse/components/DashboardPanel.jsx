import React, { useState, useCallback, useMemo } from 'react';
import { subscribeProducts } from '../../productsNew1/services/productsService';
import {
  View, Text, FlatList, TouchableOpacity, Alert,
  LayoutAnimation, Platform, UIManager, StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { warehouseStyles as baseStyles } from '../styles/warehouseStyles';
import { groupItemsByProduct, groupAggregatedProductsByCategory } from '../../../utils/warehouseUtils';
import { useAdaptiveBottom } from '../../../hooks/useAdaptiveBottom';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Colores de etapa alineados a ../DESIGN.md (el panel usaba ámbar/azul/verde
// fuera de la paleta). Pendiente = neutro (aún no se trabaja), En Proceso =
// Field Blue (la acción en curso), Listos = verde semántico de éxito.
const TAB_COLORS = {
  pending: '#8E8E93',
  preparing: '#007AFF',
  ready: '#34C759',
};

const TABS = [
  { id: 'pending',   label: 'Pendientes', icon: 'time-outline' },
  { id: 'preparing', label: 'En Proceso', icon: 'construct-outline' },
  { id: 'ready',     label: 'Listos',     icon: 'checkmark-circle-outline' },
];

const STAGE_TITLES = {
  pending: 'Por Preparar',
  preparing: 'En Producción',
  ready: 'Listos para Entrega',
};

// Acción masiva de cada etapa: mover TODO lo visible (o una categoría entera).
// En "Listos" el movimiento natural hacia adelante es la entrega de carga, que
// tiene su propio botón; aquí la masiva es el retroceso a preparación.
const BULK_ACTION = {
  pending:   { to: 'preparing', verb: 'Preparar',   icon: 'construct-outline',        tone: 'preparing', target: 'En Proceso' },
  preparing: { to: 'ready',     verb: 'Marcar listo', icon: 'checkmark-circle-outline', tone: 'ready',   target: 'Listos' },
  ready:     { to: 'preparing', verb: 'Regresar',   icon: 'arrow-undo-outline',       tone: 'preparing', target: 'En Proceso', secondary: true },
};

// ─── Sub-componente de fila de producto ───────────────────────────────────────
// Extraído como componente propio para evitar closures obsoletas y re-renders innecesarios
const ProductRow = React.memo(({ item, activeStatusTab, onAdvance, onRevert }) => {
  const activeColor = TAB_COLORS[activeStatusTab];
  const canRevert = activeStatusTab === 'preparing' || activeStatusTab === 'ready';
  const revertColor = TAB_COLORS[activeStatusTab === 'ready' ? 'preparing' : 'pending'];
  const action = BULK_ACTION[activeStatusTab];

  return (
    <View style={s.productRow}>
      <View style={[s.statusBar, { backgroundColor: activeColor }]} />

      {/* Cantidad primero: es el dato que el bodeguero lee al surtir. */}
      <View style={[s.totalBubble, { borderColor: activeColor }]}>
        <Text style={[s.totalNum, { color: activeColor }]}>{item.totalQty}</Text>
      </View>

      <View style={s.productInfo}>
        <Text style={s.productName} numberOfLines={2}>{item.name}</Text>
        <View style={s.metaRow}>
          {item.regularQty > 0 && (
            <Text style={s.metaStrong}>{item.regularQty} vta</Text>
          )}
          {item.bonusQty > 0 && (
            <Text style={[s.metaStrong, { color: '#5856D6' }]}>{item.bonusQty} reg</Text>
          )}
          {item.orderCount > 0 && (
            <Text style={s.metaText}>
              {item.orderCount} {item.orderCount === 1 ? 'orden' : 'órdenes'}
            </Text>
          )}
        </View>
      </View>

      <View style={s.actionGroup}>
        {canRevert && (
          <TouchableOpacity
            style={[s.iconBtn, { borderColor: revertColor }]}
            onPress={() => onRevert(item.name)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
          >
            <Icon name="arrow-undo-outline" size={16} color={revertColor} />
          </TouchableOpacity>
        )}

        {activeStatusTab !== 'ready' ? (
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: TAB_COLORS[action.tone] }]}
            onPress={() => onAdvance(item.name)}
            activeOpacity={0.75}
          >
            <Icon name={action.icon} size={13} color="#FFF" />
            <Text style={s.actionBtnText}>
              {activeStatusTab === 'pending' ? 'Preparar' : 'Listo'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={s.readyMark}>
            <Icon name="checkmark-circle" size={20} color={TAB_COLORS.ready} />
          </View>
        )}
      </View>
    </View>
  );
});

// ─── Componente principal ──────────────────────────────────────────────────────
const DashboardPanel = ({ preSales, onHandoverPress, onStatusChange }) => {
  const [activeStatusTab, setActiveStatusTab] = useState('pending');
  const [productCategoryById, setProductCategoryById] = useState({});
  const { bottomPadding } = useAdaptiveBottom();

  // Listener de categorías de productos (solo para fallback de ítems legacy sin categoría embebida).
  // subscribeProducts aplica orderBy + limit; antes esto abría un listener crudo
  // sobre la colección `products` completa para leer un solo campo.
  React.useEffect(() => {
    const unsubscribe = subscribeProducts((items) => {
      const map = {};
      items.forEach((p) => {
        if (p.category) map[p.id] = p.category;
      });
      setProductCategoryById(map);
    });
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

  // ── Movimiento masivo (toda la etapa o una categoría) ─────────────────────
  // Mueve muchos productos de golpe y afecta varias órdenes, así que se confirma
  // antes. Va en una sola llamada: el servicio recorre las órdenes una vez.
  const handleBulkMove = useCallback((products, scopeLabel) => {
    const action = BULK_ACTION[activeStatusTab];
    if (!action || !products?.length) return;

    const names = products.map((p) => p.name);
    const units = products.reduce((sum, p) => sum + (Number(p.totalQty) || 0), 0);
    const productLabel = `${names.length} producto${names.length === 1 ? '' : 's'}`;

    Alert.alert(
      `${action.verb} ${scopeLabel}`,
      `Se moverán ${productLabel} (${units} unidades) a "${action.target}".`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: action.verb,
          onPress: () => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            onStatusChange?.(names, activeStatusTab, action.to);
          },
        },
      ]
    );
  }, [activeStatusTab, onStatusChange]);

  // ── Render item para FlatList ──────────────────────────────────────────────
  const renderItem = useCallback(({ item }) => {
    if (item.type === 'header') {
      const action = BULK_ACTION[activeStatusTab];
      const tone = TAB_COLORS[action.tone];
      return (
        <View style={s.categoryHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.categoryName} numberOfLines={1}>{item.category}</Text>
            <Text style={s.categoryMeta}>
              {item.productCount} prod · {item.totalQty} uds
            </Text>
          </View>

          {/* Mover TODA la categoría de una vez */}
          <TouchableOpacity
            style={[s.categoryBulkBtn, { borderColor: tone }]}
            onPress={() => handleBulkMove(item.products, `«${item.category}»`)}
            activeOpacity={0.75}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Icon name={action.icon} size={14} color={tone} />
            <Text style={[s.categoryBulkText, { color: tone }]}>Todo</Text>
          </TouchableOpacity>
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
  }, [activeStatusTab, handleAdvance, handleRevert, handleBulkMove]);

  // ── Barra de etapa: resumen + acción masiva ────────────────────────────────
  // Fija (fuera de la FlatList) para que los totales y el botón de mover todo
  // sigan visibles mientras se recorre una lista larga.
  const bulkAction = BULK_ACTION[activeStatusTab];
  const bulkTone = TAB_COLORS[bulkAction.tone];
  const totalUnits = totalRegular + totalBonus;

  const StageBar = (
    <View style={s.stageBar}>
      <View style={{ flex: 1 }}>
        <Text style={s.stageTitle}>{STAGE_TITLES[activeStatusTab]}</Text>
        <Text style={s.stageMeta}>
          {aggregatedProducts.length} prod · <Text style={s.stageMetaStrong}>{totalUnits} uds</Text>
          {totalBonus > 0 ? `  ·  ${totalRegular} vta / ${totalBonus} reg` : ''}
        </Text>
      </View>

      {aggregatedProducts.length > 0 && (
        <TouchableOpacity
          style={[
            s.bulkBtn,
            bulkAction.secondary
              ? { borderWidth: 1.5, borderColor: bulkTone }
              : { backgroundColor: bulkTone },
          ]}
          onPress={() => handleBulkMove(aggregatedProducts, 'todo')}
          activeOpacity={0.8}
        >
          <Icon
            name={bulkAction.icon}
            size={15}
            color={bulkAction.secondary ? bulkTone : '#FFF'}
          />
          <Text style={[s.bulkBtnText, { color: bulkAction.secondary ? bulkTone : '#FFF' }]}>
            {bulkAction.verb} todo
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

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

      {StageBar}

      {/* Lista de productos (FlatList para compatibilidad con gestos nativos de Android) */}
      <FlatList
        data={flatListData}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <Icon name="file-tray-outline" size={40} color="#C7C7CC" />
            <Text style={s.emptyText}>Sin productos en esta etapa</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 24 }}
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
// Tokens de ../DESIGN.md: ink #1A1A1A, body #333333, muted #8E8E93, borde #E0E0E0,
// lienzo #F5F6FA, radios 8/12/16 y la única receta de sombra (Card Lift).
const s = StyleSheet.create({
  /* Tab bar */
  tabBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEEEEE' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, gap: 5 },
  tabCount: { fontSize: 17, fontWeight: '800', color: '#8E8E93' },
  tabLabel: { fontSize: 9, fontWeight: '700', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.3 },

  /* Barra de etapa (fija): resumen + acción masiva */
  stageBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEEEEE',
  },
  stageTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  stageMeta: { fontSize: 11, fontWeight: '500', color: '#8E8E93', marginTop: 2 },
  stageMetaStrong: { fontWeight: '800', color: '#333333' },

  bulkBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 30,
    flexShrink: 0,
  },
  bulkBtnText: { fontSize: 12, fontWeight: '700' },

  /* Header de categoría */
  categoryHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F5F6FA', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
    marginTop: 10, marginBottom: 3,
  },
  categoryName: { fontSize: 12, fontWeight: '700', color: '#333333' },
  categoryMeta: { fontSize: 10, fontWeight: '500', color: '#8E8E93', marginTop: 1 },
  categoryBulkBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderRadius: 8,
    paddingHorizontal: 9, paddingVertical: 5,
    backgroundColor: '#FFFFFF', flexShrink: 0,
  },
  categoryBulkText: { fontSize: 11, fontWeight: '700' },

  /* Fila de producto */
  productRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', paddingVertical: 10, paddingRight: 10,
    borderBottomWidth: 1, borderBottomColor: '#EEEEEE',
    borderRadius: 8, marginBottom: 2,
  },
  statusBar: { width: 4, borderRadius: 2, alignSelf: 'stretch', marginRight: 9, marginLeft: 2 },
  productInfo: { flex: 1, marginRight: 8 },
  productName: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 3 },
  metaStrong: { fontSize: 11, fontWeight: '700', color: '#34C759' },
  metaText: { fontSize: 11, fontWeight: '500', color: '#8E8E93' },

  /* Cantidad: el número más grande de la fila, es lo que se surte */
  totalBubble: {
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
    marginRight: 10, borderWidth: 1.5, backgroundColor: '#FFFFFF',
    minWidth: 44, alignItems: 'center',
  },
  totalNum: { fontSize: 17, fontWeight: '800' },

  /* Grupo de botones de acción */
  actionGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 11, paddingVertical: 7, borderRadius: 8,
    shadowColor: '#0A2540', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  actionBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  iconBtn: {
    borderWidth: 1.5, borderRadius: 8,
    padding: 6, alignItems: 'center', justifyContent: 'center',
  },
  readyMark: { paddingHorizontal: 4 },

  /* Estado vacío */
  emptyState: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyText: { color: '#8E8E93', fontSize: 13, fontWeight: '500' },
});

export default DashboardPanel;
