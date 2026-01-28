import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  ScrollView
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Icon from 'react-native-vector-icons/Ionicons';
import globalStyles from '../../styles/globalStyles';

const { width } = Dimensions.get('window');

const STATUS_LABELS = {
  pending: 'Pendiente',
  preparing: 'En Preparación',
  ready_for_delivery: 'Lista para Entrega',
  dispatched: 'En Reparto',
  paid: 'Pagada'
};

const PreSaleItem = ({ item, onSelect }) => {
  const totalItems = item.items && Array.isArray(item.items)
    ? item.items.reduce((acc, curr) => acc + (curr.quantity || 0), 0)
    : 0;

  const customerName = item.customer?.firstName
        ? `${item.customer.firstName} ${item.customer.lastName || ''}`
        : item.customerName || 'Cliente sin nombre';

  const customerPhone = item.customer?.phone || 'Sin teléfono';

  return (
    <TouchableOpacity style={styles.itemContainer} onPress={() => onSelect(item)}>
      <View style={styles.itemHeader}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Icon name="receipt-outline" size={24} color="#5856D6" />
            <Text style={styles.itemTitle}>ID: {item.id.substring(0, 8).toUpperCase()}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{STATUS_LABELS[item.status] || item.status}</Text>
          </View>
      </View>

      <View style={styles.customerContainer}>
        <View style={styles.customerRow}>
            <Icon name="person-outline" size={16} color="#666" style={{marginRight: 6}} />
            <Text style={styles.customerText}>{customerName}</Text>
        </View>
        <View style={styles.customerRow}>
            <Icon name="call-outline" size={16} color="#666" style={{marginRight: 6}} />
            <Text style={styles.customerSubText}>{customerPhone}</Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.itemText}>Items Totales: {totalItems}</Text>
        <Text style={styles.dateText}>
            {item.createdAt ? new Date(item.createdAt.toDate()).toLocaleDateString() : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const DashboardPanel = ({ preSales }) => {
    const { aggregatedProducts, totalUnits, totalOrders, statusCounts } = React.useMemo(() => {
        const totals = {};
        let units = 0;
        const sCounts = { pending: 0, preparing: 0, ready_for_delivery: 0 };

        preSales.forEach(sale => {
            if (sCounts[sale.status] !== undefined) sCounts[sale.status]++;

            if (sale.items && Array.isArray(sale.items)) {
                sale.items.forEach(item => {
                    const productName = item.name || item.productName || 'Producto Desconocido';
                    if (!totals[productName]) {
                        totals[productName] = 0;
                    }
                    totals[productName] += (item.quantity || 0);
                    units += (item.quantity || 0);
                });
            }
        });
        const products = Object.entries(totals)
            .map(([name, quantity]) => ({ name, quantity }))
            .sort((a, b) => b.quantity - a.quantity);

        return { aggregatedProducts: products, totalUnits: units, totalOrders: preSales.length, statusCounts: sCounts };
    }, [preSales]);

    return (
        <ScrollView style={styles.dashboardContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.dashboardSection}>
                <Text style={styles.sectionHeader}>Métricas Clave</Text>
                <View style={styles.statsContainer}>
                    <View style={[styles.statCard, { backgroundColor: '#E3F2FD', borderColor: '#BBDEFB' }]}>
                        <Icon name="receipt-outline" size={26} color="#1E88E5" />
                        <Text style={styles.statNumber}>{totalOrders}</Text>
                        <Text style={styles.statLabel}>Ordenes</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: '#E8F5E9', borderColor: '#C8E6C9' }]}>
                        <Icon name="layers-outline" size={26} color="#43A047" />
                        <Text style={[styles.statNumber, {color: '#2E7D32'}]}>{totalUnits}</Text>
                        <Text style={styles.statLabel}>Unidades</Text>
                    </View>
                </View>
            </View>

            <View style={styles.dashboardSection}>
                <Text style={styles.sectionHeader}>Estado de Ordenes</Text>
                <View style={styles.statusRow}>
                    <View style={[styles.statusItem, { borderLeftColor: '#F2C94C' }]}>
                        <Text style={styles.statusCount}>{statusCounts.pending}</Text>
                        <Text style={styles.statusLabel}>Pendientes</Text>
                    </View>
                     <View style={[styles.statusItem, { borderLeftColor: '#007AFF' }]}>
                        <Text style={styles.statusCount}>{statusCounts.preparing}</Text>
                        <Text style={styles.statusLabel}>Preparando</Text>
                    </View>
                     <View style={[styles.statusItem, { borderLeftColor: '#34C759' }]}>
                        <Text style={styles.statusCount}>{statusCounts.ready_for_delivery}</Text>
                        <Text style={styles.statusLabel}>Listas</Text>
                    </View>
                </View>
            </View>

            <Text style={[styles.sectionHeader, { marginTop: 15 }]}>Desglose de Productos</Text>

            {aggregatedProducts.map((item, index) => (
                 <View key={item.name} style={styles.dashboardRow}>
                    <View style={styles.rowInfo}>
                        <View style={styles.bulletPoint} />
                        <Text style={styles.rowName}>{item.name}</Text>
                    </View>
                    <View style={styles.rowValueContainer}>
                        <Text style={styles.rowValue}>{item.quantity}</Text>
                        <Text style={styles.rowUnit}>und</Text>
                    </View>
                </View>
            ))}
            {aggregatedProducts.length === 0 && <Text style={styles.emptyText}>No hay carga pendiente.</Text>}
            <View style={{height: 20}} />
        </ScrollView>
    );
};

export default function PreparePreSalesScreen({ navigation }) {
  const [preSales, setPreSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'dashboard'

  useEffect(() => {
    const subscriber = firestore()
      .collection('presales')
      .where('status', 'in', ['pending', 'preparing', 'ready_for_delivery'])
      .onSnapshot(querySnapshot => {
        const sales = [];
        querySnapshot.forEach(doc => sales.push({ id: doc.id, ...doc.data() }));

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
  }, []);

  const handleSelectPreSale = (presale) => {
      navigation.navigate('WarehousePreSaleDetail', { presale });
  };

  if (loading) {
    return (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color="#5856D6" />
            <Text style={{ marginTop: 10 }}>Cargando pre-ventas...</Text>
        </View>
    );
  }

  return (
    <View style={globalStyles.container}>
      <View style={globalStyles.header}>
          <TouchableOpacity onPress={() => navigation && navigation.navigate("DashboardScreen")}>
            <Icon name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={globalStyles.title}>Pre-Ventas</Text>
          <View style={{width: 26}} />
      </View>

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
                renderItem={({ item }) => <PreSaleItem item={item} onSelect={handleSelectPreSale} />}
                ListEmptyComponent={
                    <View style={{ alignItems: 'center', marginTop: 50 }}>
                        <Icon name="checkmark-circle-outline" size={60} color="#ccc" />
                        <Text style={styles.emptyText}>No hay pre-ventas pendientes.</Text>
                    </View>
                }
                contentContainerStyle={{ paddingBottom: 20 }}
            />
        ) : (
            <DashboardPanel preSales={preSales} />
        )}
      </View>
    </View>
  );
}

const getStatusColor = (status) => {
    switch(status) {
        case 'pending': return '#F2C94C';
        case 'preparing': return '#007AFF';
        case 'ready_for_delivery': return '#34C759';
        default: return '#8E8E93';
    }
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: '#f5f5f7' },
  contentContainer: { flex: 1, paddingHorizontal: 8 },

  // Tabs Styles
  tabContainer: { flexDirection: 'row', backgroundColor: 'white', margin: 10, borderRadius: 12, padding: 4 },
  tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8 },
  activeTabButton: { backgroundColor: '#F0F0FF' },
  tabText: { marginLeft: 8, fontWeight: '600', color: '#888', fontSize: 14 },
  activeTabText: { color: '#5856D6' },

  emptyText: { textAlign: 'center', marginTop: 10, fontSize: 16, color: '#888' },

  // List Item Styles
  itemContainer: { backgroundColor: 'white', padding: 15, marginVertical: 6, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  itemTitle: { fontSize: 16, fontWeight: 'bold', marginLeft: 8, color: '#333' },

  customerContainer: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  customerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  customerText: { fontSize: 16, fontWeight: '600', color: '#333' },
  customerSubText: { fontSize: 14, color: '#888' },

  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemText: { fontSize: 14, color: '#666' },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: 'white', fontWeight: '700', fontSize: 12, textTransform: 'capitalize' },
  dateText: { fontSize: 12, color: '#999' },

  // Dashboard Panel Styles
  dashboardContainer: { flex: 1, padding: 10 },
  dashboardSection: { marginBottom: 20 },
  sectionHeader: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.5 },

  statsContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  statCard: { flex: 1, padding: 15, borderRadius: 16, alignItems: 'center', marginHorizontal: 5, borderWidth: 1, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, backgroundColor: 'white' },
  statNumber: { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 5 },
  statLabel: { fontSize: 12, color: '#666', marginTop: 2 },

  statusRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'white', padding: 10, borderRadius: 16, elevation: 1 },
  statusItem: { flex: 1, alignItems: 'center', borderLeftWidth: 3, paddingLeft: 5 },
  statusCount: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  statusLabel: { fontSize: 10, color: '#888' },

  dashboardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: 12, borderRadius: 12, marginVertical: 4, elevation: 1 },
  rowInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  bulletPoint: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#5856D6', marginRight: 10 },
  rowName: { fontSize: 14, fontWeight: '600', color: '#333' },
  rowValueContainer: { alignItems: 'flex-end' },
  rowValue: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  rowUnit: { fontSize: 10, color: '#999' },
});
