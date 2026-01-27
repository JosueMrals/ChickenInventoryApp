import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import auth from '@react-native-firebase/auth';
import Icon from 'react-native-vector-icons/Ionicons';
import { getUsersByRole } from '../../services/auth';

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

  return (
    <TouchableOpacity style={styles.itemContainer} onPress={() => onSelect(item)}>
      <View style={styles.itemHeader}>
          <Icon name="receipt-outline" size={24} color="#5856D6" />
          <Text style={styles.itemTitle}>ID: {item.id.substring(0, 8).toUpperCase()}</Text>
      </View>
      <Text style={styles.itemText}>Cliente: {item.customerName || 'Cliente sin nombre'}</Text>
      <Text style={styles.itemText}>Items Totales: {totalItems}</Text>

      <View style={styles.badgeContainer}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{STATUS_LABELS[item.status] || item.status}</Text>
        </View>
        <Text style={styles.dateText}>
            {item.createdAt ? new Date(item.createdAt.toDate()).toLocaleDateString() : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const ManagePreSaleModal = ({ visible, onClose, preSale, setPreSale, entregadores }) => {
  if (!preSale) return null;

  const [loading, setLoading] = useState(false);
  const [showEntregadorPicker, setShowEntregadorPicker] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [processingEntregadorId, setProcessingEntregadorId] = useState(null);

  const filteredEntregadores = entregadores.filter(e =>
    (e.email && e.email.toLowerCase().includes(searchText.toLowerCase())) ||
    (e.displayName && e.displayName.toLowerCase().includes(searchText.toLowerCase()))
  );

  const updateStatus = async (newStatus) => {
    setLoading(true);
    try {
      await firestore().collection('presales').doc(preSale.id).update({ status: newStatus });
      setPreSale(prev => ({ ...prev, status: newStatus }));

      if(newStatus === 'ready_for_delivery'){
        setShowEntregadorPicker(true);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el estado.');
      console.error(error);
    }
    setLoading(false);
  };

  const handleDispatch = (entregador) => {
    Alert.alert(
      'Confirmar Asignación',
      `¿Asignar entrega a ${entregador.email || 'este repartidor'}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Asignar', onPress: () => dispatchToEntregador(entregador.uid) }
      ]
    );
  };

  const dispatchToEntregador = async (entregadorId) => {
    const currentUser = auth().currentUser;
    if (!currentUser) {
        Alert.alert('Error de Sesión', 'No estás autenticado.');
        return;
    }

    setProcessingEntregadorId(entregadorId);
    try {
      // 1. OBTENER TOKEN FRESCO (Mecanismo de Respaldo)
      const token = await currentUser.getIdToken(true);

      // 2. LLAMADA REAL A LA CLOUD FUNCTION
      const dispatchFunction = functions().httpsCallable('dispatchPreSale');

      const response = await dispatchFunction({
          preSaleId: preSale.id,
          entregadorId,
          authToken: token // Token enviado manualmente
      });

      console.log("Respuesta del servidor:", response.data);

      Alert.alert('Éxito', 'La pre-venta ha sido asignada y está en reparto.');
      setSearchText('');
      setShowEntregadorPicker(false);
      onClose(); // Cerrar modal principal
    } catch (error) {
      console.error("❌ Error en dispatchToEntregador:", error);

      let errorMsg = error.message;
      if (error.code === 'functions/unauthenticated') {
          errorMsg = 'Error de autenticación. Verifica tu conexión e intenta nuevamente.';
      } else if (error.code === 'functions/not-found') {
          errorMsg = 'No se encontró la pre-venta o el documento.';
      } else if (error.code === 'functions/permission-denied') {
          errorMsg = 'No tienes permisos de bodeguero para realizar esta acción.';
      }

      Alert.alert('Error', errorMsg);
    } finally {
        setProcessingEntregadorId(null);
    }
  };

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Gestionar Pre-Venta</Text>
          <Text style={styles.modalSubtitle}>ID: {preSale.id.substring(0, 8).toUpperCase()}</Text>

          {loading && <ActivityIndicator size="large" color="#5856D6" style={{ marginBottom: 10 }} />}

          <Modal visible={showEntregadorPicker} transparent={true} animationType="fade" onRequestClose={() => setShowEntregadorPicker(false)}>
             <View style={styles.modalContainer}>
                <View style={styles.pickerContent}>
                  <Text style={styles.modalTitle}>Seleccionar Entregador</Text>

                  <View style={styles.searchContainer}>
                    <Icon name="search" size={20} color="#999" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar por correo..."
                        value={searchText}
                        onChangeText={setSearchText}
                        autoCapitalize="none"
                    />
                  </View>

                  {entregadores.length === 0 ? (
                      <Text style={styles.emptyListText}>No hay entregadores disponibles.</Text>
                  ) : (
                      <FlatList
                        data={filteredEntregadores}
                        keyExtractor={(item) => item.uid}
                        style={{ maxHeight: 300, width: '100%' }}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={styles.entregadorItem}
                            onPress={() => handleDispatch(item)}
                            disabled={!!processingEntregadorId}
                          >
                            <View style={styles.avatarContainer}>
                                <Icon name="person" size={20} color="#555" />
                            </View>
                            <Text style={styles.entregadorText}>{item.email || 'Sin Email'}</Text>

                            {processingEntregadorId === item.uid ? (
                                <ActivityIndicator size="small" color="#5856D6" />
                            ) : (
                                <Icon name="chevron-forward" size={20} color="#ccc" />
                            )}
                          </TouchableOpacity>
                        )}
                        ListEmptyComponent={<Text style={styles.emptyListText}>No se encontraron resultados.</Text>}
                      />
                  )}
                  <TouchableOpacity
                    style={[styles.closeButton, { marginTop: 15 }]}
                    onPress={() => {
                        setShowEntregadorPicker(false);
                        setSearchText('');
                    }}
                  >
                    <Text style={styles.buttonText}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
             </View>
          </Modal>

          {!loading && (
            <>
                {preSale.status === 'pending' && (
                    <TouchableOpacity style={styles.actionButton} onPress={() => updateStatus('preparing')}>
                        <Icon name="hammer-outline" size={20} color="white" style={{marginRight: 8}} />
                        <Text style={styles.buttonText}>Empezar Preparación</Text>
                    </TouchableOpacity>
                )}
                {preSale.status === 'preparing' && (
                    <TouchableOpacity style={[styles.actionButton, {backgroundColor: '#34C759'}]} onPress={() => updateStatus('ready_for_delivery')}>
                        <Icon name="checkmark-circle-outline" size={20} color="white" style={{marginRight: 8}} />
                        <Text style={styles.buttonText}>Marcar Lista para Entrega</Text>
                    </TouchableOpacity>
                )}
                {preSale.status === 'ready_for_delivery' && (
                    <TouchableOpacity style={[styles.actionButton, {backgroundColor: '#FF9500'}]} onPress={() => setShowEntregadorPicker(true)}>
                        <Icon name="bicycle-outline" size={20} color="white" style={{marginRight: 8}} />
                        <Text style={styles.buttonText}>Asignar Entregador</Text>
                    </TouchableOpacity>
                )}
            </>
          )}

          <TouchableOpacity style={[styles.closeButton, { marginTop: 10 }]} onPress={onClose}>
            <Text style={styles.buttonText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default function PreparePreSalesScreen() {
  const [preSales, setPreSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPreSale, setSelectedPreSale] = useState(null);
  const [entregadores, setEntregadores] = useState([]);

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

  useEffect(() => {
    const fetchEntregadores = async () => {
        const users = await getUsersByRole('entregador');
        setEntregadores(users);
    };
    fetchEntregadores();
  }, []);

  if (loading) {
    return (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color="#5856D6" />
            <Text style={{ marginTop: 10 }}>Cargando pre-ventas...</Text>
        </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Pre-Ventas por Preparar</Text>
      <FlatList
        data={preSales}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <PreSaleItem item={item} onSelect={setSelectedPreSale} />}
        ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 50 }}>
                <Icon name="checkmark-circle-outline" size={60} color="#ccc" />
                <Text style={styles.emptyText}>No hay pre-ventas pendientes.</Text>
            </View>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
      <ManagePreSaleModal
        visible={!!selectedPreSale}
        onClose={() => setSelectedPreSale(null)}
        preSale={selectedPreSale}
        setPreSale={setSelectedPreSale}
        entregadores={entregadores}
      />
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
  headerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 15, color: '#1c1c1e', marginLeft: 5 },
  emptyText: { textAlign: 'center', marginTop: 10, fontSize: 16, color: '#888' },

  itemContainer: { backgroundColor: 'white', padding: 15, marginVertical: 6, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  itemTitle: { fontSize: 16, fontWeight: 'bold', marginLeft: 8, color: '#333' },
  itemText: { fontSize: 14, color: '#666', marginBottom: 4 },
  badgeContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusText: { color: 'white', fontWeight: '700', fontSize: 12, textTransform: 'capitalize' },
  dateText: { fontSize: 12, color: '#999' },

  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { width: '85%', backgroundColor: 'white', padding: 25, borderRadius: 15, alignItems: 'center', elevation: 5 },
  pickerContent: { width: '90%', maxHeight: '80%', backgroundColor: 'white', padding: 20, borderRadius: 15, alignItems: 'center', elevation: 5 },

  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 5, color: '#333' },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 20 },

  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: 10, paddingHorizontal: 10, height: 45, width: '100%', marginBottom: 15 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: '#333' },

  actionButton: { flexDirection: 'row', backgroundColor: '#5856D6', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, width: '100%', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  closeButton: { backgroundColor: '#FF3B30', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, width: '100%', alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  entregadorItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', width: '100%', justifyContent: 'space-between' },
  avatarContainer: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  entregadorText: { fontSize: 16, color: '#333', flex: 1 },
  emptyListText: { textAlign: 'center', color: '#999', marginVertical: 20 }
});
