import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import Icon from 'react-native-vector-icons/Ionicons';

// Componente para cada Entrega
const DeliveryItem = ({ item, onConfirmPayment }) => {
  // Cálculo seguro de items totales
  const totalItems = item.items && Array.isArray(item.items)
    ? item.items.reduce((acc, curr) => acc + (curr.quantity || 0), 0)
    : 0;

  // Formateo de fecha seguro
  const dateString = item.fechaEntregaRepartidor
    ? new Date(item.fechaEntregaRepartidor.toDate()).toLocaleString()
    : 'Fecha desconocida';

  return (
    <View style={styles.itemContainer}>
      <View style={styles.itemHeader}>
          <View style={styles.headerLeft}>
            <Icon name="bicycle" size={24} color="#2DCE89" />
            <Text style={styles.itemTitle}>Orden #{item.id.substring(0, 8).toUpperCase()}</Text>
          </View>
          <View style={styles.priceTag}>
            <Text style={styles.priceText}>${item.total ? item.total.toFixed(2) : '0.00'}</Text>
          </View>
      </View>

      <View style={styles.infoRow}>
        <Icon name="person-outline" size={16} color="#666" />
        <Text style={styles.infoText}>{item.customerName || 'Cliente sin nombre'}</Text>
      </View>

      <View style={styles.infoRow}>
        <Icon name="cube-outline" size={16} color="#666" />
        <Text style={styles.infoText}>{totalItems} productos</Text>
      </View>

      {item.address ? (
         <View style={styles.infoRow}>
            <Icon name="location-outline" size={16} color="#666" />
            <Text style={styles.infoText}>{item.address}</Text>
         </View>
      ) : (
         <View style={styles.infoRow}>
            <Icon name="location-outline" size={16} color="#999" />
            <Text style={[styles.infoText, {color: '#999', fontStyle: 'italic'}]}>Sin dirección especificada</Text>
         </View>
      )}

      <View style={styles.divider} />

      <View style={styles.infoRow}>
         <Icon name="time-outline" size={16} color="#888" />
         <Text style={styles.dateText}>Asignado: {dateString}</Text>
      </View>

      <TouchableOpacity
        style={styles.payButton}
        onPress={() => onConfirmPayment(item)}
      >
        <Icon name="cash-outline" size={20} color="white" style={{marginRight: 8}} />
        <Text style={styles.payButtonText}>Confirmar Pago y Entrega</Text>
      </TouchableOpacity>
    </View>
  );
};

export default function MyDeliveriesScreen({ user }) {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    if (!user || !user.uid) {
        setLoading(false);
        return;
    }

    console.log(`Escuchando entregas para: ${user.uid}`);

    // CORRECCIÓN: Colección 'presales' y estado 'dispatched'
    const subscriber = firestore()
      .collection('presales')
      .where('entregadorId', '==', user.uid)
      .where('status', '==', 'dispatched')
      .onSnapshot(querySnapshot => {
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
        setLoading(false);
      });

    return () => subscriber();
  }, [user]);

  const handleConfirmPayment = (item) => {
    Alert.alert(
        'Confirmar Entrega',
        `¿Recibiste el pago de $${item.total?.toFixed(2)} y entregaste los productos al cliente ${item.customerName || ''}?`,
        [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Confirmar',
                onPress: () => processPayment(item.id)
            }
        ]
    );
  };

  const processPayment = async (preSaleId) => {
    setProcessingId(preSaleId);
    try {
        const completePaymentFunction = functions().httpsCallable('completePreSalePayment');
        const result = await completePaymentFunction({ preSaleId });

        if (result.data.success) {
            Alert.alert('¡Excelente!', 'Entrega finalizada y stock actualizado.');
        }
    } catch (error) {
        console.error("Error al procesar pago:", error);
        Alert.alert('Error', error.message || 'No se pudo procesar el pago.');
    } finally {
        setProcessingId(null);
    }
  };

  if (loading) {
    return (
        <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2DCE89" />
            <Text style={{ marginTop: 10 }}>Cargando tus entregas...</Text>
        </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Mis Entregas Pendientes</Text>

      {processingId && (
          <View style={styles.processingOverlay}>
              <View style={styles.processingBox}>
                  <ActivityIndicator size="large" color="#2DCE89" />
                  <Text style={styles.processingText}>Procesando pago...</Text>
              </View>
          </View>
      )}

      <FlatList
        data={deliveries}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <DeliveryItem item={item} onConfirmPayment={handleConfirmPayment} />}
        ListEmptyComponent={
            <View style={styles.centerContainer}>
                <Icon name="bicycle-outline" size={80} color="#ddd" />
                <Text style={styles.emptyText}>No tienes entregas pendientes por cobrar.</Text>
            </View>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#F5F6FA' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  headerTitle: { fontSize: 26, fontWeight: 'bold', marginBottom: 20, color: '#1A1A1A' },
  emptyText: { textAlign: 'center', marginTop: 10, fontSize: 16, color: '#888', maxWidth: '80%' },

  itemContainer: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  itemTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 10, color: '#333' },
  priceTag: { backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  priceText: { color: '#2E7D32', fontWeight: 'bold', fontSize: 16 },

  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  infoText: { marginLeft: 8, fontSize: 15, color: '#555' },
  dateText: { marginLeft: 8, fontSize: 13, color: '#888' },

  divider: { height: 1, backgroundColor: '#eee', marginVertical: 10 },

  payButton: {
    flexDirection: 'row',
    backgroundColor: '#2DCE89',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#2DCE89',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4
  },
  payButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  processingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10,
    justifyContent: 'center', alignItems: 'center'
  },
  processingBox: {
      backgroundColor: 'white', padding: 25, borderRadius: 16, alignItems: 'center'
  },
  processingText: { marginTop: 10, fontSize: 16, fontWeight: '600' }
});
