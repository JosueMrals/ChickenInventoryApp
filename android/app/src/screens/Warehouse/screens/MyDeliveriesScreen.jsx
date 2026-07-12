import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import globalStyles from '../../../styles/globalStyles';
import { useRoute } from '../../../context/RouteContext';
import { resolveCustomerName } from '../../../utils/customerUtils';
import StatCardGrid from '../../dashboard/components/StatCardGrid';

const isCreditSale = (item) =>
  item?.paymentMethod === 'credit' || String(item?.status || '').startsWith('credit_');

// Efectivo realmente recibido: el vuelto no cuenta, y un crédito puede abonarse parcial.
const getCollectedAmount = (item) => {
  const total = Number(item?.total) || 0;
  const paid = Number(item?.amountPaid);
  return Number.isFinite(paid) && paid > 0 ? Math.min(paid, total) : total;
};

// Componente para cada Entrega (Versión Resumida)
const DeliveryItem = ({ item, onGoToPayment, customerName }) => {
  const isCredit = isCreditSale(item);

  const createdDate = item.createdAt
    ? new Date(item.createdAt.toDate()).toLocaleDateString() + ' ' + new Date(item.createdAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    : '---';

  return (
    <View style={styles.card}>
        <View style={styles.cardHeader}>
             <View style={styles.cardHeaderInfo}>
                  <Text style={styles.customerName}>{customerName || 'Cliente General'}</Text>
                  <Text style={styles.metaText}>#{item.id.substring(0, 6).toUpperCase()} · {createdDate}</Text>
              </View>

             <View style={styles.cardHeaderRight}>
                  <Text style={styles.totalText}>${item.total?.toFixed(2)}</Text>
                  <View style={styles.badgeRow}>
                     <View style={styles.badge}>
                       <Text style={styles.badgeText}>Pendiente</Text>
                     </View>
                     {isCredit && (
                       <View style={styles.creditBadge}>
                         <Text style={styles.creditBadgeText}>Crédito</Text>
                       </View>
                     )}
                  </View>
             </View>
        </View>

        <TouchableOpacity style={styles.mainActionButton} onPress={() => onGoToPayment(item)}>
            <Text style={styles.mainActionText}>COBRAR</Text>
        </TouchableOpacity>
    </View>
  );
};

const formatTimestamp = (date) => {
  if (!date) return '---';
  if (typeof date.toDate === 'function') {
    const value = date.toDate();
    return value.toLocaleDateString() + ' ' + value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const value = date instanceof Date ? date : new Date(date);
  return value.toLocaleDateString() + ' ' + value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const normalizeQuery = (value) => (value || '').toString().toLowerCase().trim();

const matchesFilter = (item, query, customerName) => {
  if (!query) return true;
  const haystack = [
    item.id,
    customerName || item.customerName,
    item.phone,
    item.address,
    item.total?.toFixed ? item.total.toFixed(2) : item.total,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
};

const isWithinRange = (date, rangeKey) => {
  if (!date || !rangeKey) return true;
  const baseDate = typeof date.toDate === 'function' ? date.toDate() : new Date(date);
  const now = new Date();

  if (rangeKey === 'today') {
    return baseDate.toDateString() === now.toDateString();
  }

  if (rangeKey === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return baseDate.toDateString() === yesterday.toDateString();
  }

  if (rangeKey === 'week') {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    return baseDate >= weekStart && baseDate <= now;
  }

  if (rangeKey === 'month') {
    return baseDate.getFullYear() === now.getFullYear() && baseDate.getMonth() === now.getMonth();
  }

  return true;
};

const DATE_CHIPS = [
  { key: 'all', label: 'Todas' },
  { key: 'today', label: 'Hoy' },
  { key: 'yesterday', label: 'Ayer' },
  { key: 'week', label: '7 dias' },
  { key: 'month', label: 'Mes' },
];

const METHOD_CHIPS = [
  { key: 'all', label: 'Todos' },
  { key: 'cash', label: 'Efectivo' },
  { key: 'credit', label: 'Credito' },
];

const matchesMethod = (item, methodKey) => {
  if (methodKey === 'cash') return !isCreditSale(item);
  if (methodKey === 'credit') return isCreditSale(item);
  return true;
};

const FilterChips = ({ chips, value, onChange }) => (
  <View style={styles.filterChips}>
    {chips.map((chip) => (
      <TouchableOpacity
        key={chip.key}
        style={[styles.chip, value === chip.key && styles.chipActive]}
        onPress={() => onChange(chip.key)}
      >
        <Text style={[styles.chipText, value === chip.key && styles.chipTextActive]}>{chip.label}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

const getBonusSummary = (sale) => {
  const bonuses = sale?.bonusesAwarded || sale?.bonuses || [];
  if (!Array.isArray(bonuses) || bonuses.length === 0) {
    return { hasBonuses: false, skuCount: 0, unitsCount: 0 };
  }

  const skuSet = new Set();
  let units = 0;

  bonuses.forEach((bonus, idx) => {
    const skuKey = String(bonus?.productId || bonus?.id || bonus?.productName || bonus?.name || `bonus_${idx}`)
      .trim()
      .toLowerCase();
    if (skuKey) skuSet.add(skuKey);
    units += Number(bonus?.quantity || bonus?.qty || bonus?.bonusQty || 0);
  });

  return {
    hasBonuses: true,
    skuCount: skuSet.size,
    unitsCount: Number(units.toFixed(2)),
  };
};

const HistoryItem = ({ item, onOpen, customerName }) => {
  const paidDate = formatTimestamp(item.fechaPago || item.fechaEntregaRepartidor);
  const bonusSummary = getBonusSummary(item);
  return (
    <TouchableOpacity style={styles.historyCard} onPress={() => onOpen(item)}>
      <View style={styles.historyRow}>
        <View style={styles.historyInfo}>
          <Text style={styles.historyTitle}>Pre-Venta #{item.id.substring(0, 6).toUpperCase()}</Text>
          <Text style={styles.historyCustomer}>{customerName || 'Cliente General'}</Text>
          <Text style={styles.historyMeta}>{paidDate}</Text>
        </View>
        <View style={styles.historyRight}>
          <Text style={styles.historyTotal}>${item.total?.toFixed(2)}</Text>
          <Icon name="chevron-forward" size={20} color="#94A3B8" />
        </View>
      </View>

      {bonusSummary.hasBonuses && (
        <View style={styles.historyBonusRow}>
          <Icon name="gift-outline" size={14} color="#5856D6" />
          <Text style={styles.historyBonusText}>
            {bonusSummary.skuCount} regalo(s) · {bonusSummary.unitsCount} unidad(es)
          </Text>
        </View>
      )}

      {isCreditSale(item) && (
        <View style={styles.historyBadgeRow}>
          <View style={styles.creditBadge}>
            <Text style={styles.creditBadgeText}>Crédito</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default function MyDeliveriesScreen({ user, role }) {
  const [deliveries, setDeliveries] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [deliveryFilter, setDeliveryFilter] = useState('');
  const [deliveryMethodFilter, setDeliveryMethodFilter] = useState('all');
  const [historyFilter, setHistoryFilter] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState('all');
  const [historyMethodFilter, setHistoryMethodFilter] = useState('all');
  const [activePanel, setActivePanel] = useState('pending');
  const [showFilters, setShowFilters] = useState(false);
  const [customersById, setCustomersById] = useState({});
  const navigation = useNavigation();
  const { selectedRoute } = useRoute();

  const isAdmin = role === 'admin';
  // El entregador siempre trabaja sobre una ruta seleccionada, igual que el
  // bodeguero en WarehouseDashboardScreen; admin puede ver todas.
  const routeMissing = !isAdmin && !selectedRoute?.id;

  useEffect(() => {
    const unsub = firestore()
      .collection('customers')
      .onSnapshot(
        (snapshot) => {
          if (!snapshot) {
            setCustomersById({});
            return;
          }
          const map = snapshot.docs.reduce((acc, doc) => {
            acc[doc.id] = { id: doc.id, ...doc.data() };
            return acc;
          }, {});
          setCustomersById(map);
        },
        (error) => {
          console.error('Error al escuchar customers:', error);
          setCustomersById({});
        }
      );

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !user.uid) {
        setLoading(false);
        setLoadingHistory(false);
        return;
    }
    if (routeMissing) {
        setDeliveries([]);
        setHistory([]);
        setLoading(false);
        setLoadingHistory(false);
        return;
    }

    console.log(`Escuchando entregas para: ${user.uid}`);

    // CORRECCIÓN: Colección 'presales' y estado 'dispatched'
    let query = firestore()
      .collection('presales')
      .where('status', '==', 'dispatched');

    if (!isAdmin) {
      query = query.where('entregadorId', '==', user.uid);
    }

    if (!isAdmin && selectedRoute && selectedRoute.id) {
      query = query.where('routeId', '==', selectedRoute.id);
    }

    const subscriber = query.onSnapshot(querySnapshot => {
        if (!querySnapshot) {
          setDeliveries([]);
          setLoading(false);
          return;
        }
        const sales = [];
        querySnapshot.forEach(doc => sales.push({ id: doc.id, ...doc.data() }));

        sales.sort((a, b) => {
            const dateA = a.fechaEntregaRepartidor ? a.fechaEntregaRepartidor.toMillis() : 0;
            const dateB = b.fechaEntregaRepartidor ? b.fechaEntregaRepartidor.toMillis() : 0;
            return dateB - dateA;
        });

        console.log(`Entregas encontradas: ${sales.length}`);
        setDeliveries(sales);
        setLoading(false);
      }, error => {
        console.error("Error al escuchar entregas:", error);
        setDeliveries([]);
        setLoading(false);
      });

    // Historial de entregas pagadas por el repartidor
    let historyQuery = firestore()
      .collection('presales')
      .where('status', '==', 'paid');

    if (!isAdmin) {
      historyQuery = historyQuery.where('entregadorId', '==', user.uid);
    }

    if (!isAdmin && selectedRoute && selectedRoute.id) {
      historyQuery = historyQuery.where('routeId', '==', selectedRoute.id);
    }

    const historySubscriber = historyQuery.onSnapshot(querySnapshot => {
        if (!querySnapshot) {
          setHistory([]);
          setLoadingHistory(false);
          return;
        }
        const sales = [];
        querySnapshot.forEach(doc => sales.push({ id: doc.id, ...doc.data() }));

        sales.sort((a, b) => {
          const dateA = a.fechaPago ? a.fechaPago.toMillis() : 0;
          const dateB = b.fechaPago ? b.fechaPago.toMillis() : 0;
          return dateB - dateA;
        });

        setHistory(sales);
        setLoadingHistory(false);
      }, error => {
        console.error("Error al escuchar historial:", error);
        setHistory([]);
        setLoadingHistory(false);
      });

    return () => {
      subscriber();
      historySubscriber();
    };
  }, [user, isAdmin, selectedRoute, routeMissing]);

  const handleGoToPayment = (item) => {
      navigation.navigate('DeliveryPayment', { delivery: item });
  };

  const openHistory = useCallback((item) => {
    navigation.navigate('DeliveryDone', { sale: item });
  }, [navigation]);

  const filteredDeliveries = useMemo(() => {
    const query = normalizeQuery(deliveryFilter);
    return deliveries.filter((item) => {
      const customerName = resolveCustomerName(item, customersById);
      if (!matchesFilter(item, query, customerName)) return false;
      return matchesMethod(item, deliveryMethodFilter);
    });
  }, [deliveries, deliveryFilter, deliveryMethodFilter, customersById]);

  const filteredHistory = useMemo(() => {
    const query = normalizeQuery(historyFilter);
    const rangeKey = historyDateFilter === 'all' ? '' : historyDateFilter;
    return history.filter((item) => {
      const customerName = resolveCustomerName(item, customersById);
      if (!matchesFilter(item, query, customerName)) return false;
      if (!matchesMethod(item, historyMethodFilter)) return false;
      return isWithinRange(item.fechaPago || item.fechaEntregaRepartidor, rangeKey);
    });
  }, [history, historyFilter, historyDateFilter, historyMethodFilter, customersById]);

  // Efectivo vs credito: lo que el entregador debe traer en mano no incluye el credito.
  const pendingTotals = useMemo(() => {
    return filteredDeliveries.reduce(
      (acc, item) => {
        const total = Number(item.total) || 0;
        if (isCreditSale(item)) acc.credit += total;
        else acc.cash += total;
        return acc;
      },
      { cash: 0, credit: 0 }
    );
  }, [filteredDeliveries]);

  const collectedTotals = useMemo(() => {
    return filteredHistory.reduce(
      (acc, item) => {
        const amount = getCollectedAmount(item);
        if (isCreditSale(item)) acc.credit += amount;
        else acc.cash += amount;
        return acc;
      },
      { cash: 0, credit: 0 }
    );
  }, [filteredHistory]);

  const isPending = activePanel === 'pending';
  const searchValue = isPending ? deliveryFilter : historyFilter;
  const routeHint = isAdmin
    ? 'Administrador: todas las rutas'
    : `Ruta: ${selectedRoute?.name || '---'}`;

  // Chips activos (distintos del valor por defecto) para avisar que la lista viene filtrada
  // aunque el panel de filtros este colapsado.
  const activeFilterCount = isPending
    ? Number(deliveryMethodFilter !== 'all')
    : Number(historyMethodFilter !== 'all') + Number(historyDateFilter !== 'all');

  // Gate: el entregador debe seleccionar una ruta antes de ver sus entregas.
  // Mismo patrón que WarehouseDashboardScreen para el bodeguero.
  if (routeMissing) {
    return (
      <View style={globalStyles.container}>
        <View style={globalStyles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="chevron-back" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={globalStyles.title}>Mis Entregas</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 }}>
          <Icon name="map-outline" size={64} color="#C7C7CC" />
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#333', marginTop: 16, textAlign: 'center' }}>
            Selecciona una ruta
          </Text>
          <Text style={{ fontSize: 14, color: '#8E8E93', marginTop: 8, textAlign: 'center' }}>
            Para ver tus entregas primero debes elegir la ruta en la que vas a trabajar.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#007AFF', borderRadius: 30, paddingVertical: 14, paddingHorizontal: 28, marginTop: 24 }}
            onPress={() => navigation.navigate('RouteSelection', { user, role, returnTo: 'MyDeliveries' })}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Seleccionar Ruta</Text>
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
        <Text style={globalStyles.title}>Mis Entregas</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.bodyLayout}>
        <View style={styles.panelStrip}>
          <TouchableOpacity
            style={[styles.panelButton, activePanel === 'pending' && styles.panelButtonActive]}
            onPress={() => setActivePanel('pending')}
          >
            <Icon name="bicycle-outline" size={16} color={activePanel === 'pending' ? '#fff' : '#8E8E93'} />
            <Text style={[styles.panelText, activePanel === 'pending' && styles.panelTextActive]}>
              Pendientes ({filteredDeliveries.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.panelButton, activePanel === 'history' && styles.panelButtonActive]}
            onPress={() => setActivePanel('history')}
          >
            <Icon name="receipt-outline" size={16} color={activePanel === 'history' ? '#fff' : '#8E8E93'} />
            <Text style={[styles.panelText, activePanel === 'history' && styles.panelTextActive]}>
              Historial ({filteredHistory.length})
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.contentPanel}>
          <View style={styles.toolbar}>
            <View style={styles.searchBox}>
              <Icon name="search-outline" size={16} color="#8E8E93" />
              <TextInput
                value={isPending ? deliveryFilter : historyFilter}
                onChangeText={isPending ? setDeliveryFilter : setHistoryFilter}
                placeholder={isPending ? 'Buscar cliente, id o total' : 'Buscar en historial'}
                style={styles.searchInput}
                placeholderTextColor="#8E8E93"
                autoCorrect={false}
              />
              {!!searchValue && (
                <TouchableOpacity onPress={() => (isPending ? setDeliveryFilter('') : setHistoryFilter(''))}>
                  <Icon name="close-circle" size={16} color="#8E8E93" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.filterToggle, (showFilters || activeFilterCount > 0) && styles.filterToggleActive]}
              onPress={() => setShowFilters((prev) => !prev)}
            >
              <Icon
                name="options-outline"
                size={18}
                color={showFilters || activeFilterCount > 0 ? '#fff' : '#8E8E93'}
              />
              {activeFilterCount > 0 && <Text style={styles.filterToggleBadge}>{activeFilterCount}</Text>}
            </TouchableOpacity>
          </View>

          {isPending ? (
            loading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={{ marginTop: 6 }}>Cargando tus entregas...</Text>
              </View>
            ) : (
              <FlatList
                data={filteredDeliveries}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={(
                  <View>
                    {showFilters && (
                      <FilterChips
                        chips={METHOD_CHIPS}
                        value={deliveryMethodFilter}
                        onChange={setDeliveryMethodFilter}
                      />
                    )}
                    <Text style={styles.routeHint}>{routeHint}</Text>
                    <StatCardGrid
                      availableStats={{
                        pendingCash: {
                          icon: 'cash-outline',
                          color: '#007AFF',
                          title: 'Efectivo por cobrar',
                          value: `$${pendingTotals.cash.toFixed(2)}`,
                        },
                        pendingCredit: {
                          icon: 'card-outline',
                          color: '#5856D6',
                          title: 'Credito por cobrar',
                          value: `$${pendingTotals.credit.toFixed(2)}`,
                        },
                      }}
                      layout={[[
                        { key: 'pendingCash', size: 1 },
                        { key: 'pendingCredit', size: 1 },
                      ]]}
                    />
                  </View>
                )}
                renderItem={({ item }) => (
                  <DeliveryItem
                    item={item}
                    onGoToPayment={handleGoToPayment}
                    customerName={resolveCustomerName(item, customersById)}
                  />
                )}
                ListEmptyComponent={(
                  <View style={styles.centerContainer}>
                    <Icon name="bicycle-outline" size={64} color="#E0E0E0" />
                    <Text style={styles.emptyText}>No tienes entregas pendientes por cobrar.</Text>
                  </View>
                )}
                contentContainerStyle={styles.listContent}
              />
            )
          ) : loadingHistory ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={{ marginTop: 6 }}>Cargando historial...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredHistory}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={(
                <View>
                  {showFilters && (
                    <>
                      <FilterChips
                        chips={DATE_CHIPS}
                        value={historyDateFilter}
                        onChange={setHistoryDateFilter}
                      />
                      <FilterChips
                        chips={METHOD_CHIPS}
                        value={historyMethodFilter}
                        onChange={setHistoryMethodFilter}
                      />
                    </>
                  )}
                  <Text style={styles.routeHint}>{routeHint}</Text>
                  <StatCardGrid
                    availableStats={{
                      cashCollected: {
                        icon: 'cash-outline',
                        color: '#34C759',
                        title: 'Efectivo cobrado',
                        value: `$${collectedTotals.cash.toFixed(2)}`,
                      },
                      creditCollected: {
                        icon: 'card-outline',
                        color: '#5856D6',
                        title: 'Credito cobrado',
                        value: `$${collectedTotals.credit.toFixed(2)}`,
                      },
                    }}
                    layout={[[
                      { key: 'cashCollected', size: 1 },
                      { key: 'creditCollected', size: 1 },
                    ]]}
                  />
                </View>
              )}
              renderItem={({ item }) => (
                <HistoryItem
                  item={item}
                  onOpen={openHistory}
                  customerName={resolveCustomerName(item, customersById)}
                />
              )}
              ListEmptyComponent={(
                <View style={styles.centerContainer}>
                  <Icon name="receipt-outline" size={64} color="#E0E0E0" />
                  <Text style={styles.emptyText}>No tienes entregas cobradas.</Text>
                </View>
              )}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Tokens de ../DESIGN.md: Field Blue #007AFF (accion primaria/estado activo),
  // verde #34C759 solo para cobrado/pagado, morado #5856D6 para credito, Card Lift como
  // unica sombra.
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  emptyText: { textAlign: 'center', marginTop: 10, fontSize: 16, color: '#8E8E93', maxWidth: '80%' },
  bodyLayout: { flex: 1 },
  panelStrip: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F5F6FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  panelButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#EEEEEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelButtonActive: { backgroundColor: '#007AFF' },
  panelText: { fontSize: 12, fontWeight: '700', color: '#8E8E93' },
  panelTextActive: { color: '#FFFFFF' },
  contentPanel: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchInput: { flex: 1, paddingVertical: 8, color: '#1A1A1A', fontSize: 14, fontWeight: '600' },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#EEEEEE',
  },
  filterToggleActive: { backgroundColor: '#007AFF' },
  filterToggleBadge: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  filterChips: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#EEEEEE',
  },
  chipActive: { backgroundColor: '#007AFF' },
  chipText: { fontSize: 12, color: '#333333', fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  routeHint: { fontSize: 11, fontWeight: '500', color: '#8E8E93', marginBottom: 6 },
  listContent: { paddingBottom: 20, flexGrow: 1 },

  // Card Lift: la unica receta de sombra del sistema.
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 10,
    paddingBottom: 10,
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  cardHeaderInfo: { flex: 1, paddingRight: 12, minWidth: 0 },
  cardHeaderRight: { alignItems: 'flex-end', flexShrink: 0, minWidth: 94 },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  metaText: { fontSize: 11, fontWeight: '500', color: '#8E8E93' },
  // Pendiente: aun no es dinero cobrado, por eso va en tinta y no en verde.
  totalText: { fontSize: 16, fontWeight: '800', color: '#1A1A1A', lineHeight: 20, marginBottom: 4 },
  badge: {
    backgroundColor: '#EEEEEE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#8E8E93' },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
    gap: 6,
  },
  creditBadge: {
    backgroundColor: '#5856D6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  creditBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  mainActionButton: {
    backgroundColor: '#007AFF',
    marginHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.6,
  },

  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 10,
    padding: 12,
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyInfo: { flex: 1, paddingRight: 12, minWidth: 0 },
  historyTitle: { fontSize: 11, fontWeight: '500', color: '#8E8E93', marginBottom: 2 },
  historyCustomer: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  historyMeta: { fontSize: 11, fontWeight: '500', color: '#8E8E93' },
  historyRight: { alignItems: 'flex-end', gap: 4, flexShrink: 0, minWidth: 74 },
  // Cobrado: verde semantico, aqui si corresponde.
  historyTotal: { fontSize: 16, fontWeight: '800', color: '#34C759', lineHeight: 20 },
  historyBadgeRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, flexShrink: 0 },
  historyBonusRow: {
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: '#5856D615',
    borderWidth: 1,
    borderColor: '#5856D630',
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyBonusText: { color: '#5856D6', fontSize: 12, fontWeight: '600' },
});
