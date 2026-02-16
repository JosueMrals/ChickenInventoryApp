import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

// Componente para cada Entrega (Versión Resumida)
const DeliveryItem = ({ item, onGoToPayment }) => {
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
                 <Text style={styles.customerName}>{item.customerName || 'Cliente General'}</Text>
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

export default function MyDeliveriesScreen({ user }) {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();

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

  const handleGoToPayment = (item) => {
      navigation.navigate('DeliveryPayment', { delivery: item });
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

      <FlatList
        data={deliveries}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <DeliveryItem item={item} onGoToPayment={handleGoToPayment} />}
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
  container: { flex: 1, padding: 16, backgroundColor: '#F2F4F8' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  headerTitle: { fontSize: 24, fontWeight: '800', marginBottom: 20, color: '#111' },
  emptyText: { textAlign: 'center', marginTop: 10, fontSize: 16, color: '#888', maxWidth: '80%' },

  // Estilos Nueva Card
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
      overflow: 'hidden'
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
      marginBottom: 2
  },
  customerName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#333',
      marginBottom: 4
  },
  dateText: {
      fontSize: 12,
      color: '#999',
  },
  totalText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#2DCE89',
      marginBottom: 4
  },
  badge: {
     backgroundColor: '#FFECB3',
     paddingHorizontal: 8,
     paddingVertical: 2,
     borderRadius: 4,
     alignSelf: 'flex-end'
  },
  badgeText: {
      fontSize: 10,
      fontWeight: 'bold',
      color: '#FF6F00'
  },
  cardBody: {
      paddingHorizontal: 16,
      paddingBottom: 16
  },
  divider: {
      height: 1,
      backgroundColor: '#eee',
      marginVertical: 10
  },
  sectionLabel: {
      fontSize: 12,
      fontWeight: 'bold',
      color: '#555',
      marginBottom: 2
  },
  bodyText: {
      fontSize: 14,
      color: '#444',
      marginBottom: 4
  },
  productText: {
      fontSize: 13,
      color: '#666',
      marginLeft: 6
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
      letterSpacing: 0.5
  }
});
