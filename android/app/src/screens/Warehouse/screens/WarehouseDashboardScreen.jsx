import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Icon from 'react-native-vector-icons/Ionicons';
import styles from '../styles/WarehouseDashboardStyles';
import globalStyles from '../../../styles/globalStyles';
import DashboardPanel from '../components/DashboardPanel';
import PreSaleItem from '../components/PreSaleItem';
import { useRoute } from '../../../context/RouteContext';
import { Swipeable } from 'react-native-gesture-handler';

export default function WarehouseDashboardScreen({ navigation }) {
  const [preSales, setPreSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'list' | 'dashboard'
  const { selectedRoute } = useRoute();

  useEffect(() => {
    // Solo obtener órdenes relevantes para Bodega (pending -> preparing -> ready_for_delivery)
    let query = firestore()
      .collection('presales')
      .where('status', 'in', ['pending', 'preparing', 'ready_for_delivery']);

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

  const handleSelectPreSale = (presale) => {
      navigation.navigate('WarehouseOrderDetail', { presale });
  };

  const handleHandoverPress = () => {
      // Filter orders that are ready_for_delivery OR preparing (to allow forced partial handover with warning)
      const accessibleOrders = preSales.filter(s => ['ready_for_delivery', 'preparing'].includes(s.status));
      if (accessibleOrders.length === 0) return;

      navigation.navigate('ProductHandover', { readyOrders: accessibleOrders });
  };

  const handleUpdateStatus = (id, newStatus) => {
      firestore().collection('presales').doc(id).update({ status: newStatus });
  };

  const renderSwipeableItem = ({ item }) => {
      const renderRightActions = (progress, dragX) => {
          const trans = dragX.interpolate({
              inputRange: [0, 50, 100, 101],
              outputRange: [-20, 0, 0, 1],
          });

          let nextStatus = '';
          let label = '';
          let color = '';
          let icon = '';

          if (item.status === 'pending') {
              nextStatus = 'preparing';
              label = 'Preparar';
              color = '#007AFF';
              icon = 'construct-outline';
          } else if (item.status === 'preparing') {
              nextStatus = 'ready_for_delivery';
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

      const renderLeftActions = (progress, dragX) => {
          const trans = dragX.interpolate({
              inputRange: [0, 50, 100, 101],
              outputRange: [-20, 0, 0, 1],
          });

          let prevStatus = '';
          let label = '';
          let color = '';
          let icon = '';

          if (item.status === 'preparing') {
              prevStatus = 'pending';
              label = 'Pendiente';
              color = '#F2C94C';
              icon = 'time-outline';
          } else if (item.status === 'ready_for_delivery') {
              prevStatus = 'preparing';
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
              onSwipeableRightOpen={() => {
                  // Opcional: Auto-trigger al deslizar completo
                  if (item.status === 'pending') handleUpdateStatus(item.id, 'preparing');
                  else if (item.status === 'preparing') handleUpdateStatus(item.id, 'ready_for_delivery');
              }}
              onSwipeableLeftOpen={() => {
                  if (item.status === 'preparing') handleUpdateStatus(item.id, 'pending');
                  else if (item.status === 'ready_for_delivery') handleUpdateStatus(item.id, 'preparing');
              }}
          >
              <PreSaleItem item={item} onSelect={handleSelectPreSale} />
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

      <View style={styles.contentContainer}>
        {activeTab === 'list' ? (
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
        ) : (
            <DashboardPanel
                preSales={preSales}
                onHandoverPress={handleHandoverPress}
            />
        )}
      </View>
    </View>
  );
}
