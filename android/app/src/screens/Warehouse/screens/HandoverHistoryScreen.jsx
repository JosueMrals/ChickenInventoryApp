import React, { useState, useEffect, useMemo, useCallback, useContext } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { startOfDay, endOfDay, subDays, startOfMonth, format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import globalStyles from '../../../styles/globalStyles';
import { normalizeText } from '../../../utils/textUtils';
import { resolveCustomerName } from '../../../utils/customerUtils';
import { groupItemsByProduct } from '../../../utils/warehouseUtils';
import { PreSaleContext } from '../../presales/context/preSaleContext';
import { useRoute } from '../../../context/RouteContext';
import { subscribeHandovers, subscribeUserNames, getHandoverDate } from '../services/handoverHistoryService';

const DATE_CHIPS = [
  { key: 'today', label: 'Hoy' },
  { key: 'yesterday', label: 'Ayer' },
  { key: 'week', label: '7 días' },
  { key: 'month', label: 'Mes' },
  { key: 'custom', label: 'Fecha', icon: 'calendar-outline' },
];

// Rango [desde, hasta] de cada atajo. Los límites se estiran al día completo
// para que una entrega de las 17:00 del último día no quede fuera.
const presetRange = (key) => {
  const now = new Date();
  switch (key) {
    case 'today':     return [startOfDay(now), endOfDay(now)];
    case 'yesterday': return [startOfDay(subDays(now, 1)), endOfDay(subDays(now, 1))];
    case 'week':      return [startOfDay(subDays(now, 6)), endOfDay(now)];
    case 'month':     return [startOfMonth(now), endOfDay(now)];
    default:          return [startOfDay(now), endOfDay(now)];
  }
};

const fmtTime = (date) => (date ? format(date, 'HH:mm', { locale: es }) : '--:--');
const fmtDay = (date) => (date ? format(date, "d 'de' MMM", { locale: es }) : '');

// ── Tarjeta de una orden entregada ───────────────────────────────────────────
const OrderCard = React.memo(({ sale, customerName, entregador, bodeguero, expanded, onToggle }) => {
  const date = getHandoverDate(sale);
  const lines = [...(sale.items || []), ...(sale.bonuses || []).map((b) => ({ ...b, isBonus: true }))];
  const units = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);

  return (
    <TouchableOpacity style={s.card} onPress={() => onToggle(sale.id)} activeOpacity={0.85}>
      <View style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.customer} numberOfLines={1}>{customerName}</Text>
          <Text style={s.meta}>
            #{sale.id.substring(0, 6).toUpperCase()} · {fmtDay(date)} {fmtTime(date)}
          </Text>
        </View>
        <View style={s.unitsBadge}>
          <Text style={s.unitsNum}>{units}</Text>
          <Text style={s.unitsLabel}>uds</Text>
        </View>
      </View>

      <View style={s.peopleRow}>
        <Icon name="cube-outline" size={13} color="#8E8E93" />
        <Text style={s.peopleText} numberOfLines={1}>{bodeguero}</Text>
        <Icon name="arrow-forward" size={12} color="#8E8E93" />
        <Icon name="bicycle-outline" size={13} color="#007AFF" />
        <Text style={[s.peopleText, { color: '#007AFF', fontWeight: '700' }]} numberOfLines={1}>
          {entregador}
        </Text>
      </View>

      {expanded && (
        <View style={s.linesBlock}>
          {lines.map((line, idx) => (
            <View key={`${sale.id}-${idx}`} style={s.lineRow}>
              <Text style={s.lineQty}>{Number(line.quantity) || 0}</Text>
              <Text style={s.lineName} numberOfLines={1}>
                {line.productName || line.name || 'Producto'}
                {line.isBonus ? ' (regalía)' : ''}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={s.expandHint}>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#8E8E93" />
        <Text style={s.expandText}>
          {expanded ? 'Ocultar productos' : `Ver ${lines.length} producto(s)`}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

// ── Fila de producto agregado ────────────────────────────────────────────────
const ProductRow = React.memo(({ item }) => (
  <View style={s.productRow}>
    <View style={s.qtyBubble}>
      <Text style={s.qtyNum}>{item.totalQty}</Text>
    </View>
    <View style={{ flex: 1 }}>
      <Text style={s.productName} numberOfLines={2}>{item.name}</Text>
      <View style={s.metaRow}>
        <Text style={s.metaMuted}>{item.category}</Text>
        {item.bonusQty > 0 && (
          <Text style={[s.metaStrong, { color: '#5856D6' }]}>{item.bonusQty} reg</Text>
        )}
        <Text style={s.metaMuted}>
          {item.orderCount} {item.orderCount === 1 ? 'orden' : 'órdenes'}
        </Text>
      </View>
    </View>
  </View>
));

export default function HandoverHistoryScreen({ navigation, user, role }) {
  const [dateFilter, setDateFilter] = useState('today');
  const [customFrom, setCustomFrom] = useState(null);
  const [customTo, setCustomTo] = useState(null);
  const [pickerTarget, setPickerTarget] = useState(null);
  const [view, setView] = useState('orders');
  const [search, setSearch] = useState('');
  const [handovers, setHandovers] = useState([]);
  const [userNames, setUserNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const { customersById } = useContext(PreSaleContext);
  const { selectedRoute } = useRoute();

  // Mismo criterio que el resto del módulo de bodega (WarehouseDashboardScreen,
  // MyDeliveriesScreen): el bodeguero siempre trabaja sobre una ruta elegida y
  // solo ve el historial de ESA ruta; admin supervisa todas sin filtro.
  const isAdmin = role === 'admin';
  const routeMissing = !isAdmin && !selectedRoute?.id;
  const routeId = isAdmin ? null : (selectedRoute?.id || null);

  // Rango efectivo. En modo "Fecha" sin nada elegido todavía, cae al día de hoy.
  const [from, to] = useMemo(() => {
    if (dateFilter !== 'custom') return presetRange(dateFilter);
    if (!customFrom && !customTo) return presetRange('today');
    const start = startOfDay(customFrom || customTo);
    const end = endOfDay(customTo || customFrom);
    return [start, end];
  }, [dateFilter, customFrom, customTo]);

  useEffect(() => {
    if (routeMissing) {
      setHandovers([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    setLoadError(null);
    const unsub = subscribeHandovers(
      from,
      to,
      (docs) => { setHandovers(docs); setLoadError(null); setLoading(false); },
      (error) => { setHandovers([]); setLoadError(error); setLoading(false); },
      routeId,
    );
    return () => unsub();
  }, [from, to, routeId, routeMissing]);

  useEffect(() => subscribeUserNames(setUserNames), []);

  const nameOf = useCallback(
    (uid) => (uid ? (userNames[uid] || 'Sin identificar') : 'Sin identificar'),
    [userNames],
  );

  // ── Órdenes filtradas por búsqueda ────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    const query = normalizeText(search);
    if (!query) return handovers;
    return handovers.filter((sale) => {
      const haystack = normalizeText([
        sale.id,
        resolveCustomerName(sale, customersById, ''),
        nameOf(sale.entregadorId),
        nameOf(sale.dispatchedBy),
        ...(sale.items || []).map((i) => i.productName || i.name || ''),
      ].filter(Boolean).join(' '));
      return haystack.includes(query);
    });
  }, [handovers, search, customersById, nameOf]);

  // ── Productos agregados sobre las órdenes ya filtradas ────────────────────
  const filteredProducts = useMemo(() => {
    const products = groupItemsByProduct(filteredOrders, null);
    const query = normalizeText(search);
    if (!query) return products;
    return products.filter((p) => normalizeText(`${p.name} ${p.category}`).includes(query));
  }, [filteredOrders, search]);

  const totals = useMemo(() => {
    const units = filteredOrders.reduce((sum, sale) => {
      const lines = [...(sale.items || []), ...(sale.bonuses || [])];
      return sum + lines.reduce((n, l) => n + (Number(l.quantity) || 0), 0);
    }, 0);
    const entregadores = new Set(filteredOrders.map((s) => s.entregadorId).filter(Boolean));
    return { units, orders: filteredOrders.length, entregadores: entregadores.size };
  }, [filteredOrders]);

  const handleConfirmDate = useCallback((date) => {
    if (pickerTarget === 'from') {
      setCustomFrom(date);
      setCustomTo((prev) => (prev && prev < date ? date : prev));
    } else {
      setCustomTo(date);
      setCustomFrom((prev) => (prev && prev > date ? date : prev));
    }
    setPickerTarget(null);
  }, [pickerTarget]);

  const rangeLabel = isSameDay(from, to)
    ? format(from, "d 'de' MMMM yyyy", { locale: es })
    : `${format(from, 'd MMM', { locale: es })} – ${format(to, "d MMM yyyy", { locale: es })}`;

  const renderOrder = useCallback(({ item }) => (
    <OrderCard
      sale={item}
      customerName={resolveCustomerName(item, customersById, 'Cliente General')}
      entregador={nameOf(item.entregadorId)}
      bodeguero={nameOf(item.dispatchedBy)}
      expanded={expandedId === item.id}
      onToggle={(id) => setExpandedId((prev) => (prev === id ? null : id))}
    />
  ), [customersById, nameOf, expandedId]);

  // Gate: el bodeguero debe elegir ruta antes de ver el historial. Mismo patrón
  // que WarehouseDashboardScreen y MyDeliveriesScreen.
  if (routeMissing) {
    return (
      <View style={globalStyles.container}>
        <View style={globalStyles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="chevron-back" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={globalStyles.title}>Historial de Entregas</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={s.center}>
          <Icon name="map-outline" size={64} color="#C7C7CC" />
          <Text style={s.errorTitle}>Selecciona una ruta</Text>
          <Text style={s.errorText}>
            Para ver el historial de entregas primero debes elegir la ruta en la que vas a trabajar.
          </Text>
          <TouchableOpacity
            style={s.selectRouteBtn}
            onPress={() => navigation.navigate('RouteSelection', { user, role, returnTo: 'HandoverHistory' })}
            activeOpacity={0.8}
          >
            <Text style={s.selectRouteBtnText}>Seleccionar Ruta</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={globalStyles.container}>
      <View style={globalStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={globalStyles.title}>Historial de Entregas</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Ruta activa: el bodeguero ve la suya; admin ve que está supervisando todas. */}
      <View style={s.routeBanner}>
        <Icon name={isAdmin ? 'globe-outline' : 'map-outline'} size={14} color="#007AFF" />
        <Text style={s.routeBannerText} numberOfLines={1}>
          {isAdmin ? 'Administrador: todas las rutas' : selectedRoute?.name}
        </Text>
      </View>

      {/* Filtro de fechas */}
      <View style={s.filterBar}>
        <View style={s.chipsRow}>
          {DATE_CHIPS.map((chip) => {
            const active = dateFilter === chip.key;
            return (
              <TouchableOpacity
                key={chip.key}
                style={[s.chip, active && s.chipActive]}
                onPress={() => setDateFilter(chip.key)}
              >
                {!!chip.icon && (
                  <Icon name={chip.icon} size={12} color={active ? '#FFFFFF' : '#333333'} />
                )}
                <Text style={[s.chipText, active && s.chipTextActive]}>{chip.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {dateFilter === 'custom' && (
          <View style={s.rangeRow}>
            <TouchableOpacity style={s.rangeBtn} onPress={() => setPickerTarget('from')}>
              <Icon name="calendar-outline" size={14} color="#007AFF" />
              <View style={{ flex: 1 }}>
                <Text style={s.rangeLabel}>Desde</Text>
                <Text style={s.rangeValue} numberOfLines={1}>
                  {customFrom ? fmtDay(customFrom) : 'Elegir'}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={s.rangeBtn} onPress={() => setPickerTarget('to')}>
              <Icon name="calendar-outline" size={14} color="#007AFF" />
              <View style={{ flex: 1 }}>
                <Text style={s.rangeLabel}>Hasta</Text>
                <Text style={s.rangeValue} numberOfLines={1}>
                  {customTo ? fmtDay(customTo) : 'Mismo día'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Buscador */}
        <View style={s.searchBox}>
          <Icon name="search-outline" size={16} color="#8E8E93" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Cliente, producto, entregador…"
            placeholderTextColor="#8E8E93"
            style={s.searchInput}
            autoCorrect={false}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Icon name="close-circle" size={16} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Resumen + cambio de vista */}
      <View style={s.summaryBar}>
        <View style={{ flex: 1 }}>
          <Text style={s.summaryTitle}>{rangeLabel}</Text>
          <Text style={s.summaryMeta}>
            <Text style={s.summaryStrong}>{totals.orders}</Text> órdenes ·{' '}
            <Text style={s.summaryStrong}>{totals.units}</Text> uds ·{' '}
            {totals.entregadores} entregador(es)
          </Text>
        </View>
        <View style={s.segment}>
          {[
            { id: 'orders', icon: 'receipt-outline' },
            { id: 'products', icon: 'cube-outline' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[s.segmentBtn, view === opt.id && s.segmentBtnActive]}
              onPress={() => setView(opt.id)}
            >
              <Icon name={opt.icon} size={16} color={view === opt.id ? '#FFFFFF' : '#8E8E93'} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : loadError ? (
        <View style={s.center}>
          <Icon name="alert-circle-outline" size={52} color="#FF3B30" />
          <Text style={s.errorTitle}>No se pudo cargar el historial</Text>
          <Text style={s.errorText}>
            {String(loadError?.message || '').includes('index')
              ? 'La base de datos está preparando un índice. Intenta de nuevo en unos minutos.'
              : (loadError?.message || 'Revisa tu conexión.')}
          </Text>
        </View>
      ) : view === 'orders' ? (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrder}
          contentContainerStyle={s.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={(
            <View style={s.center}>
              <Icon name="file-tray-outline" size={52} color="#C7C7CC" />
              <Text style={s.emptyText}>
                {search ? 'Ninguna entrega coincide con la búsqueda.' : 'No hay entregas en estas fechas.'}
              </Text>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => <ProductRow item={item} />}
          contentContainerStyle={s.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={(
            <View style={s.center}>
              <Icon name="cube-outline" size={52} color="#C7C7CC" />
              <Text style={s.emptyText}>
                {search ? 'Ningún producto coincide con la búsqueda.' : 'No hay productos entregados en estas fechas.'}
              </Text>
            </View>
          )}
        />
      )}

      <DateTimePickerModal
        isVisible={!!pickerTarget}
        mode="date"
        locale="es"
        date={(pickerTarget === 'from' ? customFrom : customTo) || new Date()}
        maximumDate={new Date()}
        confirmTextIOS="Aceptar"
        cancelTextIOS="Cancelar"
        onConfirm={handleConfirmDate}
        onCancel={() => setPickerTarget(null)}
      />
    </View>
  );
}

// Tokens de ../DESIGN.md: Field Blue #007AFF, ink #1A1A1A, muted #8E8E93,
// borde #E0E0E0, lienzo #F5F6FA, Card Lift como única sombra.
const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 50, paddingHorizontal: 30 },
  list: { padding: 12, paddingBottom: 30, flexGrow: 1 },
  emptyText: { marginTop: 12, color: '#8E8E93', fontSize: 14, textAlign: 'center' },
  errorTitle: { marginTop: 12, fontSize: 15, fontWeight: '700', color: '#1A1A1A', textAlign: 'center' },
  errorText: { marginTop: 6, fontSize: 13, color: '#8E8E93', textAlign: 'center' },
  selectRouteBtn: {
    backgroundColor: '#007AFF', borderRadius: 30,
    paddingVertical: 14, paddingHorizontal: 28, marginTop: 24,
  },
  selectRouteBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  /* Ruta activa */
  routeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFFFF', paddingVertical: 8, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#EEEEEE',
  },
  routeBannerText: { fontSize: 13, fontWeight: '700', color: '#333333', flexShrink: 1 },

  /* Filtros */
  filterBar: {
    backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: '#EEEEEE', gap: 8,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: '#EEEEEE',
  },
  chipActive: { backgroundColor: '#007AFF' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#333333' },
  chipTextActive: { color: '#FFFFFF' },

  rangeRow: { flexDirection: 'row', gap: 8 },
  rangeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F5F6FA', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
  },
  rangeLabel: { fontSize: 10, fontWeight: '600', color: '#8E8E93' },
  rangeValue: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F5F6FA', borderRadius: 12, paddingHorizontal: 10,
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  searchInput: { flex: 1, paddingVertical: 8, fontSize: 14, fontWeight: '600', color: '#1A1A1A' },

  /* Resumen */
  summaryBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEEEEE',
  },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  summaryMeta: { fontSize: 11, fontWeight: '500', color: '#8E8E93', marginTop: 2 },
  summaryStrong: { fontWeight: '800', color: '#333333' },
  segment: { flexDirection: 'row', backgroundColor: '#EEEEEE', borderRadius: 8, padding: 2, gap: 2 },
  segmentBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  segmentBtnActive: { backgroundColor: '#007AFF' },

  /* Tarjeta de orden */
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, marginBottom: 10,
    shadowColor: '#0A2540', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  customer: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  meta: { fontSize: 11, fontWeight: '500', color: '#8E8E93', marginTop: 2 },
  unitsBadge: {
    alignItems: 'center', borderRadius: 8, borderWidth: 1.5, borderColor: '#007AFF',
    paddingHorizontal: 8, paddingVertical: 3, minWidth: 46,
  },
  unitsNum: { fontSize: 16, fontWeight: '800', color: '#007AFF' },
  unitsLabel: { fontSize: 9, fontWeight: '600', color: '#8E8E93' },

  peopleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, flexWrap: 'wrap' },
  peopleText: { fontSize: 12, fontWeight: '600', color: '#333333', flexShrink: 1 },

  linesBlock: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#EEEEEE', gap: 5 },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineQty: {
    fontSize: 12, fontWeight: '800', color: '#007AFF',
    minWidth: 28, textAlign: 'right',
  },
  lineName: { flex: 1, fontSize: 13, fontWeight: '500', color: '#333333' },

  expandHint: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#EEEEEE',
  },
  expandText: { fontSize: 11, fontWeight: '600', color: '#8E8E93' },

  /* Fila de producto */
  productRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 11, marginBottom: 8,
    shadowColor: '#0A2540', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  qtyBubble: {
    borderRadius: 8, borderWidth: 1.5, borderColor: '#007AFF',
    paddingHorizontal: 8, paddingVertical: 5, minWidth: 46, alignItems: 'center',
  },
  qtyNum: { fontSize: 17, fontWeight: '800', color: '#007AFF' },
  productName: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 3 },
  metaMuted: { fontSize: 11, fontWeight: '500', color: '#8E8E93' },
  metaStrong: { fontSize: 11, fontWeight: '700' },
});
