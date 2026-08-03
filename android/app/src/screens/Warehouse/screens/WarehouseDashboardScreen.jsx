import React, { useState, useEffect, useCallback, useRef, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
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
import { updateAggregateProductStatus, updatePreSaleStatusGuarded } from '../../../services/preSaleService';
import { PreSaleContext } from '../../presales/context/preSaleContext';

// La caché offline de Firestore se configura en services/firebase.js, importado de
// primero en index.js (settings() solo admite una llamada, antes del primer uso).

export default function WarehouseDashboardScreen({ navigation, user, role }) {
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
  // El mapa de clientes lo mantiene PreSaleProvider a nivel app. Antes cada pantalla
  // de Bodega abría su propio listener sobre la colección `customers` completa.
  const { customersById } = useContext(PreSaleContext);
  const [todayPaidTotal, setTodayPaidTotal] = useState(0);
  const [todayAssignedCount, setTodayAssignedCount] = useState(0);
  const { selectedRoute } = useRoute();

  // El bodeguero SIEMPRE trabaja sobre una ruta seleccionada; sin ruta se le
  // exige elegir una (ver gate más abajo). Admin puede supervisar todas.
  const requiresRoute = role !== 'admin';
  const routeMissing = requiresRoute && !selectedRoute?.id;

  useEffect(() => {
    if (routeMissing) {
      setPreSales([]);
      setLoading(false);
      return undefined;
    }

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
        querySnapshot.forEach(doc => {
            const data = doc.data();
            // Compatibilidad con datos previos al fix de créditos: una preventa que ya
            // fue entregada al repartidor (dispatchedAt) no debe reaparecer en bodega
            // aunque su estado haya regresado a credit_* por un cobro parcial antiguo.
            if (data.dispatchedAt && String(data.status || '').startsWith('credit_')) return;
            sales.push({ id: doc.id, ...data });
        });

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
  }, [selectedRoute, routeMissing]); // Recargar si cambia la ruta


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
  // `productName` puede ser un nombre o un arreglo (mover una categoría completa
  // o toda la etapa de una vez).
  const handleProductStatusChange = useCallback((productName, fromStatus, toStatus) => {
    const selectedRouteId = selectedRoute?.id || null;
    const targetNames = new Set(
      (Array.isArray(productName) ? productName : [productName]).filter(Boolean)
    );
    if (targetNames.size === 0) return;

    // Órdenes candidatas según los datos EN VIVO del listener: el servicio abre
    // transacciones solo sobre estas, sin repetir la consulta de toda la ruta.
    const matchesMove = (item) => {
      const name = item.productName || item.name;
      return targetNames.has(name) && (item.status || 'pending') === fromStatus;
    };
    const candidateIds = preSales
      .filter(sale => (!selectedRouteId || sale.routeId === selectedRouteId) &&
        [...(sale.items || []), ...(sale.bonuses || [])].some(matchesMove))
      .map(sale => sale.id);

    // Paso 1: Actualización optimista — reflejo inmediato en la UI
    setPreSales(prev => prev.map(sale => {
      if (selectedRouteId && sale.routeId !== selectedRouteId) return sale;

      const updateItem = (item) => {
        const name = item.productName || item.name;
        const itemStatus = item.status || 'pending';
        if (targetNames.has(name) && itemStatus === fromStatus) {
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
      candidateIds,
    })
      .catch(err => console.error('[Warehouse] Error sincronizando estado de producto:', err));
  }, [selectedRoute?.id, preSales]);

  const handleHandoverPress = () => {
      // Filter orders that are ready_for_delivery OR preparing (to allow forced partial handover with warning)
      const accessibleOrders = preSales.filter(s => ['ready_for_delivery', 'credit_ready_for_delivery', 'preparing', 'credit_preparing'].includes(s.status));
      if (accessibleOrders.length === 0) return;

      navigation.navigate('ProductHandover', { readyOrders: accessibleOrders });
  };

  const handleUpdateStatus = (id, newStatus) => {
      // Guarded: relee el estado real antes de escribir, para no pisar una orden
      // que ya fue cobrada o devuelta. Ver updatePreSaleStatusGuarded.
      updatePreSaleStatusGuarded(id, newStatus).catch((error) => {
          console.error('[Warehouse] Error actualizando estado:', error);
          Alert.alert('No se pudo actualizar', error?.message || 'Intenta nuevamente.');
      });
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

  // Gate: el bodeguero debe seleccionar una ruta antes de ver/preparar productos.
  // Evita mezclar productos de rutas distintas durante la preparación.
  if (routeMissing) {
    return (
        <View style={styles.container}>
            <View style={globalStyles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="chevron-back" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={globalStyles.title}>Bodega - Preparar Productos</Text>
                <View style={{ width: 28 }} />
            </View>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 }}>
                <Icon name="map-outline" size={64} color="#C7C7CC" />
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#333', marginTop: 16, textAlign: 'center' }}>
                    Selecciona una ruta
                </Text>
                <Text style={{ fontSize: 14, color: '#8E8E93', marginTop: 8, textAlign: 'center' }}>
                    Para preparar productos primero debes elegir la ruta en la que vas a trabajar.
                </Text>
                <TouchableOpacity
                    style={{ backgroundColor: '#007AFF', borderRadius: 30, paddingVertical: 14, paddingHorizontal: 28, marginTop: 24 }}
                    onPress={() => navigation.navigate('RouteSelection', { user, role, returnTo: 'PreparePreSales' })}
                    activeOpacity={0.8}
                >
                    <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Seleccionar Ruta</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
  }

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

          <TouchableOpacity
              onPress={() => navigation.navigate('HandoverHistory', { user, role })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
              <Icon name="time-outline" size={26} color="#FFF" />
          </TouchableOpacity>
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
