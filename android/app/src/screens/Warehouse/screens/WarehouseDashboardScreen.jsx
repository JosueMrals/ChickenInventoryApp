import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Icon from 'react-native-vector-icons/Ionicons';
import styles from '../styles/WarehouseDashboardStyles';
import globalStyles from '../../../styles/globalStyles';
import DashboardPanel from '../components/DashboardPanel';
import PreSaleItem from '../components/PreSaleItem';
import { useRoute } from '../../../context/RouteContext';
import { resolveCustomerName } from '../../../utils/customerUtils';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { updateAggregateProductStatus } from '../../../services/preSaleService';

// ── Habilitar caché offline de Firestore para carga inmediata al abrir la pantalla
// (persistencia habilitada por defecto en React Native Firebase, configuramos tamaño)
try {
  firestore().settings({
    cacheSizeBytes: firestore.CACHE_SIZE_UNLIMITED,
    persistence: true,
  });
} catch (_) {
  // Ignorar si ya fue configurado (solo puede llamarse una vez)
}

export default function WarehouseDashboardScreen({ navigation }) {
  const [preSales, setPreSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'list' | 'dashboard'

  // Restore tab from navigation params (e.g. coming back from detail)
  useEffect(() => {
    if (navigation) {
      const unsubscribe = navigation.addListener('focus', () => {
        const tab = navigation.getState?.()?.routes?.find(r => r.name === 'WarehouseDashboard')?.params?.tab;
        if (tab) {
          setActiveTab(tab);
        }
      });
      return unsubscribe;
    }
  }, [navigation]);
  const [customersById, setCustomersById] = useState({});
  const [todayPaidTotal, setTodayPaidTotal] = useState(0);
  const [todayAssignedCount, setTodayAssignedCount] = useState(0);
  const { selectedRoute } = useRoute();

  useEffect(() => {
    // Solo obtener órdenes relevantes para Bodega (pending -> preparing -> ready_for_delivery)
    let query = firestore()
      .collection('presales')
      .where('status', 'in', ['pending', 'credit_pending', 'credit_preparing', 'credit_ready_for_delivery', 'preparing', 'ready_for_delivery']);

    // Filtrar por ruta si está seleccionada
    if (selectedRoute && selectedRoute.id) {
        query = query.where('routeId', '==', selectedRoute.id);
    }

    const subscriber = query.onSnapshot(querySnapshot => {
        const sales = [];
        querySnapshot.forEach(doc => sales.push({ id: doc.id, ...doc.data() }));

        // Ordenar localmente para evitar índices complejos innecesarios por ahora
        sales.sort((a, b) => {
            const dateA = a.createdAt ? a.createdAt.toMillis() : 0;
            const dateB = b.createdAt ? b.createdAt.toMillis() : 0;
            return dateB - dateA;
        });

        setPreSales(sales);
        setLoading(false);
      }, error => {
        console.error("Error al escuchar pre-ventas:", error);
        setLoading(false);
      });
    return () => subscriber();
  }, [selectedRoute]); // Recargar si cambia la ruta

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
    const user = auth().currentUser;
    if (!user?.uid) return undefined;

    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const paidQuery = firestore()
      .collection('presales')
      .where('status', '==', 'paid')
      .where('entregadorId', '==', user.uid)
      .where('fechaPago', '>=', start)
      .where('fechaPago', '<=', end);

    const assignedQuery = firestore()
      .collection('presales')
      .where('status', '==', 'dispatched')
      .where('entregadorId', '==', user.uid)
      .where('fechaEntregaRepartidor', '>=', start)
      .where('fechaEntregaRepartidor', '<=', end);

    const paidSub = paidQuery.onSnapshot((snapshot) => {
      if (!snapshot) {
        setTodayPaidTotal(0);
        return;
      }
      const total = snapshot.docs.reduce((sum, doc) => {
        const value = Number(doc.data()?.total || 0);
        return sum + value;
      }, 0);
      setTodayPaidTotal(total);
    }, (error) => {
      console.error('Error al escuchar pagos de hoy:', error);
      setTodayPaidTotal(0);
    });

    const assignedSub = assignedQuery.onSnapshot((snapshot) => {
      if (!snapshot) {
        setTodayAssignedCount(0);
        return;
      }
      setTodayAssignedCount(snapshot.size);
    }, (error) => {
      console.error('Error al escuchar entregas asignadas:', error);
      setTodayAssignedCount(0);
    });

    return () => {
      paidSub();
      assignedSub();
    };
  }, []);

  const handleSelectPreSale = (presale) => {
      navigation.navigate('WarehouseOrderDetail', { presale });
  };

  /**
   * handleProductStatusChange — Actualización optimista del estado de un producto.
   *
   * 1. Actualiza el estado local (setPreSales) inmediatamente → UI responde al instante.
   * 2. Dispara la escritura en Firestore en segundo plano → garantiza persistencia.
   * 3. Si Firestore falla, el próximo onSnapshot reconcilia el estado real automáticamente.
   */
  const handleProductStatusChange = useCallback((productName, fromStatus, toStatus) => {
    const selectedRouteId = selectedRoute?.id || null;
    // Paso 1: Actualización optimista — reflejo inmediato en la UI
    setPreSales(prev => prev.map(sale => {
      if (selectedRouteId && sale.routeId !== selectedRouteId) return sale;

      const updateItem = (item) => {
        const name = item.productName || item.name;
        const itemStatus = item.status || 'pending';
        if (name === productName && itemStatus === fromStatus) {
          return { ...item, status: toStatus };
        }
        return item;
      };

      const items   = (sale.items   || []).map(updateItem);
      const bonuses = (sale.bonuses || []).map(updateItem);

      // Recalcular estado de la orden para reflejar progreso correcto
      const allItems = [...items, ...bonuses];
      let nextOrderStatus = sale.status;
      if (allItems.length > 0) {
        const allReady   = allItems.every(i => i.status === 'ready');
        const allPending = allItems.every(i => !i.status || i.status === 'pending');
        if (allReady) {
          nextOrderStatus = sale.paymentMethod === 'credit' ? 'credit_ready_for_delivery' : 'ready_for_delivery';
        } else if (allPending) {
          const canRegress = sale.status === 'preparing' || sale.status === 'credit_preparing';
          if (canRegress) nextOrderStatus = sale.paymentMethod === 'credit' ? 'credit_pending' : 'pending';
        } else {
          nextOrderStatus = sale.paymentMethod === 'credit' ? 'credit_preparing' : 'preparing';
        }
      }

      return { ...sale, items, bonuses, status: nextOrderStatus };
    }));

    // Paso 2: Sincronización con Firestore en segundo plano
    updateAggregateProductStatus(productName, toStatus, fromStatus, {
      routeId: selectedRouteId,
    })
      .catch(err => console.error('[Warehouse] Error sincronizando estado de producto:', err));
  }, [selectedRoute?.id]);

  const handleHandoverPress = () => {
      // Filter orders that are ready_for_delivery OR preparing (to allow forced partial handover with warning)
      const accessibleOrders = preSales.filter(s => ['ready_for_delivery', 'credit_ready_for_delivery', 'preparing', 'credit_preparing'].includes(s.status));
      if (accessibleOrders.length === 0) return;

      navigation.navigate('ProductHandover', { readyOrders: accessibleOrders });
  };

  const handleUpdateStatus = (id, newStatus) => {
      firestore().collection('presales').doc(id).update({ status: newStatus });
  };

  const renderSwipeableItem = ({ item }) => {
      const renderRightActions = () => {

          let nextStatus = '';
          let label = '';
          let color = '';
          let icon = '';

          if (item.status === 'pending' || item.status === 'credit_pending') {
              nextStatus = item.paymentMethod === 'credit' ? 'credit_preparing' : 'preparing';
              label = 'Preparar';
              color = '#007AFF';
              icon = 'construct-outline';
          } else if (item.status === 'preparing' || item.status === 'credit_preparing') {
              nextStatus = item.paymentMethod === 'credit' ? 'credit_ready_for_delivery' : 'ready_for_delivery';
              label = 'Listar';
              color = '#34C759';
              icon = 'checkmark-circle-outline';
          } else {
              return null;
          }

          return (
              <TouchableOpacity
                  style={{ backgroundColor: color, justifyContent: 'center', alignItems: 'center', width: 80, height: '100%', borderTopRightRadius: 12, borderBottomRightRadius: 12 }}
                  onPress={() => handleUpdateStatus(item.id, nextStatus)}
              >
                  <Icon name={icon} size={24} color="#FFF" />
                  <Text style={{color: 'white', fontSize: 12, fontWeight: 'bold'}}>{label}</Text>
              </TouchableOpacity>
          );
      };

      const renderLeftActions = () => {

          let prevStatus = '';
          let label = '';
          let color = '';
          let icon = '';

          if (item.status === 'preparing' || item.status === 'credit_preparing') {
              prevStatus = item.paymentMethod === 'credit' ? 'credit_pending' : 'pending';
              label = 'Pendiente';
              color = '#F2C94C';
              icon = 'time-outline';
          } else if (item.status === 'ready_for_delivery' || item.status === 'credit_ready_for_delivery') {
              prevStatus = item.paymentMethod === 'credit' ? 'credit_preparing' : 'preparing';
              label = 'Preparar';
              color = '#007AFF';
              icon = 'construct-outline';
          } else {
              return null;
          }

          return (
              <TouchableOpacity
                  style={{ backgroundColor: color, justifyContent: 'center', alignItems: 'center', width: 80, height: '100%', borderTopLeftRadius: 12, borderBottomLeftRadius: 12 }}
                  onPress={() => handleUpdateStatus(item.id, prevStatus)}
              >
                  <Icon name={icon} size={24} color="#FFF" />
                  <Text style={{color: 'white', fontSize: 12, fontWeight: 'bold'}}>{label}</Text>
              </TouchableOpacity>
          );
      };

      return (
           <Swipeable
               renderRightActions={renderRightActions}
               renderLeftActions={renderLeftActions}
               onSwipeableOpen={(direction) => {
                   if (direction === 'right') {
                       if (item.status === 'pending' || item.status === 'credit_pending') handleUpdateStatus(item.id, item.paymentMethod === 'credit' ? 'credit_preparing' : 'preparing');
                       else if (item.status === 'preparing' || item.status === 'credit_preparing') handleUpdateStatus(item.id, item.paymentMethod === 'credit' ? 'credit_ready_for_delivery' : 'ready_for_delivery');
                   } else if (direction === 'left') {
                       if (item.status === 'preparing' || item.status === 'credit_preparing') handleUpdateStatus(item.id, item.paymentMethod === 'credit' ? 'credit_pending' : 'pending');
                       else if (item.status === 'ready_for_delivery' || item.status === 'credit_ready_for_delivery') handleUpdateStatus(item.id, item.paymentMethod === 'credit' ? 'credit_preparing' : 'preparing');
                   }
               }}
           >
              <PreSaleItem
                item={item}
                onSelect={handleSelectPreSale}
                customerName={resolveCustomerName(item, customersById)}
              />
          </Swipeable>
      );
  };

  if (loading) {
    return (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color="#5856D6" />
            <Text style={{ marginTop: 10 }}>Cargando datos de bodega...</Text>
        </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={globalStyles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
              <Icon name="chevron-back" size={28} color="#FFF" />
          </TouchableOpacity>

          <Text style={globalStyles.title}>Bodega - Preparar Productos</Text>

          <View style={{ width: 28 }} />
      </View>

      {/* Route Banner */}
      {selectedRoute && (
        <View style={{
            backgroundColor: '#fff',
            paddingVertical: 8,
            paddingHorizontal: 16,
            marginBottom: 8,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottomWidth: 1,
            borderBottomColor: '#EEE',
            elevation: 1,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 1,
        }}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <View style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: '#E3F2FD', alignItems: 'center', justifyContent: 'center',
                    marginRight: 10
                }}>
                    <Icon name="map-outline" size={18} color="#1E88E5" />
                </View>
                <View>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#333' }}>{selectedRoute.name}</Text>
                </View>
            </View>
            {/* Optional: Add status indicator or refresh button here if needed */}
        </View>
      )}

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'dashboard' && styles.activeTabButton]}
          onPress={() => setActiveTab('dashboard')}
        >
          <Icon name="grid-outline" size={20} color={activeTab === 'dashboard' ? '#5856D6' : '#888'} />
          <Text style={[styles.tabText, activeTab === 'dashboard' && styles.activeTabText]}>Panel Control</Text>
        </TouchableOpacity>
        <TouchableOpacity
            style={[styles.tabButton, activeTab === 'list' && styles.activeTabButton]}
            onPress={() => setActiveTab('list')}
        >
            <Icon name="list-outline" size={20} color={activeTab === 'list' ? '#5856D6' : '#888'} />
            <Text style={[styles.tabText, activeTab === 'list' && styles.activeTabText]}>Ordenes</Text>
        </TouchableOpacity>
      </View>

      {/* Ambas vistas siempre montadas; se ocultan con display:'none' para evitar re-montaje
          y mantener los listeners de Firestore activos → cambio de pestaña instantáneo */}
      <View style={styles.contentContainer}>
        <View style={{ flex: 1, display: activeTab === 'dashboard' ? 'flex' : 'none' }}>
          <DashboardPanel
            preSales={preSales}
            onHandoverPress={handleHandoverPress}
            onStatusChange={handleProductStatusChange}
          />
        </View>

        <View style={{ flex: 1, display: activeTab === 'list' ? 'flex' : 'none' }}>
          <FlatList
            data={preSales}
            keyExtractor={item => item.id}
            renderItem={renderSwipeableItem}
            ListEmptyComponent={
                <View style={{ alignItems: 'center', marginTop: 50 }}>
                    <Icon name="checkmark-circle-outline" size={60} color="#ccc" />
                    <Text style={styles.emptyText}>No hay órdenes activas.</Text>
                    {selectedRoute && <Text style={{color: '#999', fontSize: 12, marginTop: 4}}>En la ruta seleccionada</Text>}
                </View>
            }
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        </View>
      </View>
    </View>
  );
}
