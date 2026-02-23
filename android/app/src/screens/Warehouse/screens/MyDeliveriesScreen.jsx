import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import globalStyles from '../../../styles/globalStyles';
import { useRoute } from '../../../context/RouteContext';
import { resolveCustomerName } from '../../../utils/customerUtils';
import StatCardGrid from '../../dashboard/components/StatCardGrid';

// Componente para cada Entrega (Versión Resumida)
const DeliveryItem = ({ item, onGoToPayment, customerName }) => {
  const [expanded, setExpanded] = useState(false);

  // Fechas y Textos
  const createdDate = item.createdAt
    ? new Date(item.createdAt.toDate()).toLocaleDateString() + ' ' + new Date(item.createdAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    : '---';

  const totalItems = item.items ? item.items.reduce((a, b) => a + (b.quantity || 0), 0) : 0;

  return (
    <View style={styles.card}>
        {/* Header: Orden - Cliente - Total - Estado Pagada dummy (invisible por ahora) */}
        <TouchableOpacity style={styles.cardHeader} onPress={() => setExpanded(!expanded)}>
             <View style={{flex: 1}}>
                 <Text style={styles.orderTitle}>#{item.id.substring(0, 6).toUpperCase()}</Text>
                 <Text style={styles.customerName}>{customerName || 'Cliente General'}</Text>
                 <Text style={styles.dateText}>{createdDate}</Text>
             </View>

             <View style={{alignItems: 'flex-end'}}>
                 <Text style={styles.totalText}>${item.total?.toFixed(2)}</Text>
                 <View style={styles.badge}>
                    <Text style={styles.badgeText}>Pendiente</Text>
                 </View>
             </View>
        </TouchableOpacity>

        {/* Detalle Expandible */}
        {expanded && (
            <View style={styles.cardBody}>
                <View style={styles.divider} />
                <Text style={styles.sectionLabel}>Dirección:</Text>
                <Text style={styles.bodyText}>{item.address || 'Sin dirección'}</Text>

                {item.phone && <Text style={styles.bodyText}>Tel: {item.phone}</Text>}

                <Text style={[styles.sectionLabel, {marginTop: 10}]}>Productos ({totalItems}):</Text>
                {item.items && item.items.map((prod, i) => (
                    <Text key={i} style={styles.productText}>• {prod.quantity}x {prod.productName || prod.name}</Text>
                ))}
            </View>
        )}

        {/* Botón Acción Full Width */}
        <TouchableOpacity style={styles.mainActionButton} onPress={() => onGoToPayment(item)}>
            <Text style={styles.mainActionText}>COBRAR ORDEN</Text>
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

const HistoryItem = ({ item, onOpen, customerName }) => {
  const paidDate = formatTimestamp(item.fechaPago || item.fechaEntregaRepartidor);
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
    </TouchableOpacity>
  );
};

export default function MyDeliveriesScreen({ user, role }) {
  const [deliveries, setDeliveries] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [deliveryFilter, setDeliveryFilter] = useState('');
  const [historyFilter, setHistoryFilter] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState('all');
  const [activePanel, setActivePanel] = useState('pending');
  const [customersById, setCustomersById] = useState({});
  const navigation = useNavigation();
  const { selectedRoute } = useRoute();

  const isAdmin = role === 'admin';

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
  }, [user, isAdmin, selectedRoute]);

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
      return matchesFilter(item, query, customerName);
    });
  }, [deliveries, deliveryFilter, customersById]);

  const filteredHistory = useMemo(() => {
    const query = normalizeQuery(historyFilter);
    const rangeKey = historyDateFilter === 'all' ? '' : historyDateFilter;
    return history.filter((item) => {
      const customerName = resolveCustomerName(item, customersById);
      if (!matchesFilter(item, query, customerName)) return false;
      return isWithinRange(item.fechaPago || item.fechaEntregaRepartidor, rangeKey);
    });
  }, [history, historyFilter, historyDateFilter, customersById]);

  const totalPending = useMemo(() => {
    return filteredDeliveries.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  }, [filteredDeliveries]);

  const totalCollected = useMemo(() => {
    return filteredHistory.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  }, [filteredHistory]);

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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.panelStripContent}
          >
            <TouchableOpacity
              style={[styles.panelButton, activePanel === 'pending' && styles.panelButtonActive]}
              onPress={() => setActivePanel('pending')}
            >
              <Icon name="bicycle-outline" size={18} color={activePanel === 'pending' ? '#fff' : '#475569'} />
              <Text style={[styles.panelText, activePanel === 'pending' && styles.panelTextActive]}>Pendientes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.panelButton, activePanel === 'history' && styles.panelButtonActive]}
              onPress={() => setActivePanel('history')}
            >
              <Icon name="receipt-outline" size={18} color={activePanel === 'history' ? '#fff' : '#475569'} />
              <Text style={[styles.panelText, activePanel === 'history' && styles.panelTextActive]}>Historial</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <View style={styles.contentPanel}>
          {activePanel === 'pending' ? (
            <View style={styles.panelContent}>
              <Text style={styles.sectionTitle}>Pendientes por cobrar</Text>
              {!isAdmin && selectedRoute?.name && (
                <Text style={styles.routeHint}>Ruta activa: {selectedRoute.name}</Text>
              )}
              {isAdmin && (
                <Text style={styles.routeHint}>Administrador: mostrando todas las rutas</Text>
              )}
              <TextInput
                value={deliveryFilter}
                onChangeText={setDeliveryFilter}
                placeholder="Buscar por cliente, id o total"
                style={styles.filterInput}
                placeholderTextColor="#9AA0A6"
                autoCorrect={false}
              />
              <View style={styles.statsContainer}>
                <StatCardGrid
                  availableStats={{
                    pendingCount: {
                      icon: 'bicycle-outline',
                      color: '#2DCE89',
                      title: 'Pendientes',
                      value: filteredDeliveries.length,
                    },
                    pendingTotal: {
                      icon: 'cash-outline',
                      color: '#34C759',
                      title: 'Total pendiente',
                      value: `$${totalPending.toFixed(2)}`,
                    },
                  }}
                  layout={[[
                    { key: 'pendingCount', size: 1 },
                    { key: 'pendingTotal', size: 1 },
                  ]]}
                />
              </View>
              {loading ? (
                <View style={styles.centerContainer}>
                  <ActivityIndicator size="small" color="#2DCE89" />
                  <Text style={{ marginTop: 6 }}>Cargando tus entregas...</Text>
                </View>
              ) : (
                <FlatList
                  data={filteredDeliveries}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <DeliveryItem
                      item={item}
                      onGoToPayment={handleGoToPayment}
                      customerName={resolveCustomerName(item, customersById)}
                    />
                  )}
                  ListEmptyComponent={(
                    <View style={styles.centerContainer}>
                      <Icon name="bicycle-outline" size={80} color="#ddd" />
                      <Text style={styles.emptyText}>No tienes entregas pendientes por cobrar.</Text>
                    </View>
                  )}
                  contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
                />
              )}
            </View>
          ) : (
            <View style={styles.panelContent}>
              <Text style={styles.sectionTitle}>Historial de entregas</Text>
              {!isAdmin && selectedRoute?.name && (
                <Text style={styles.routeHint}>Ruta activa: {selectedRoute.name}</Text>
              )}
              {isAdmin && (
                <Text style={styles.routeHint}>Administrador: mostrando todas las rutas</Text>
              )}
              <TextInput
                value={historyFilter}
                onChangeText={setHistoryFilter}
                placeholder="Buscar en historial"
                style={styles.filterInput}
                placeholderTextColor="#9AA0A6"
                autoCorrect={false}
              />
              <View style={styles.filterChips}>
                {[
                  { key: 'all', label: 'Todas' },
                  { key: 'today', label: 'Hoy' },
                  { key: 'week', label: '7 dias' },
                  { key: 'month', label: 'Mes' },
                ].map((chip) => (
                  <TouchableOpacity
                    key={chip.key}
                    style={[styles.chip, historyDateFilter === chip.key && styles.chipActive]}
                    onPress={() => setHistoryDateFilter(chip.key)}
                  >
                    <Text style={[styles.chipText, historyDateFilter === chip.key && styles.chipTextActive]}>
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.statsContainer}>
                <StatCardGrid
                  availableStats={{
                    paidCount: {
                      icon: 'receipt-outline',
                      color: '#007AFF',
                      title: 'Cobradas',
                      value: filteredHistory.length,
                    },
                    totalCollected: {
                      icon: 'cash-outline',
                      color: '#34C759',
                      title: 'Total recaudado',
                      value: `$${totalCollected.toFixed(2)}`,
                    },
                  }}
                  layout={[[
                    { key: 'paidCount', size: 1 },
                    { key: 'totalCollected', size: 1 },
                  ]]}
                />
              </View>
              {loadingHistory ? (
                <View style={styles.centerContainer}>
                  <ActivityIndicator size="small" color="#2DCE89" />
                  <Text style={{ marginTop: 6 }}>Cargando historial...</Text>
                </View>
              ) : (
                <FlatList
                  data={filteredHistory}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <HistoryItem
                      item={item}
                      onOpen={openHistory}
                      customerName={resolveCustomerName(item, customersById)}
                    />
                  )}
                  ListEmptyComponent={(
                    <View style={styles.centerContainer}>
                      <Icon name="receipt-outline" size={80} color="#ddd" />
                      <Text style={styles.emptyText}>No tienes entregas cobradas.</Text>
                    </View>
                  )}
                  contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
                />
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  emptyText: { textAlign: 'center', marginTop: 10, fontSize: 16, color: '#888', maxWidth: '80%' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 6 },
  bodyLayout: { flex: 1 },
  panelStrip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  panelStripContent: {
    gap: 10,
    alignItems: 'center',
  },
  panelButton: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelButtonActive: { backgroundColor: '#2DCE89' },
  panelText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  panelTextActive: { color: '#fff' },
  contentPanel: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  panelContent: { flex: 1 },
  filterInput: {
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    color: '#111',
  },
  filterChips: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  statsContainer: {
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: '#111827' },
  chipText: { fontSize: 12, color: '#334155', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  routeHint: { fontSize: 12, color: '#64748B', marginBottom: 8 },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyInfo: { flex: 1, paddingRight: 12 },
  historyTitle: { fontSize: 14, fontWeight: 'bold', color: '#444', marginBottom: 2 },
  historyCustomer: { fontSize: 15, fontWeight: '600', color: '#222', marginBottom: 2 },
  historyMeta: { fontSize: 12, color: '#888' },
  historyRight: { alignItems: 'flex-end', gap: 4 },
  historyTotal: { fontSize: 16, fontWeight: 'bold', color: '#2DCE89' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    padding: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  orderTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#888',
    marginBottom: 2,
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#999',
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2DCE89',
    marginBottom: 4,
  },
  badge: {
    backgroundColor: '#FFECB3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-end',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FF6F00',
  },
  cardBody: {},
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 2,
  },
  bodyText: {
    fontSize: 14,
    color: '#444',
    marginBottom: 4,
  },
  productText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
  },
  mainActionButton: {
    backgroundColor: '#2DCE89',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainActionText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },
});
