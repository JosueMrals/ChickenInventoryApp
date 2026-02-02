import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import auth from '@react-native-firebase/auth';
import { getUsersByRole } from '../../../services/auth';
import { warehouseStyles as globalStyles } from '../styles/warehouseStyles';

export default function ProductHandoverScreen({ route, navigation }) {
    const { readyOrders } = route.params; // Expecting an array of orders with status 'ready_for_delivery'

    const [entregadores, setEntregadores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [processing, setProcessing] = useState(false);
    const [selectedEntregador, setSelectedEntregador] = useState(null);

    // Calculate totals
    const { totalOrders, totalItems, aggregatedProducts } = useMemo(() => {
        let itemsCount = 0;
        const productsMap = {};

        readyOrders.forEach(order => {
            if (order.items && Array.isArray(order.items)) {
                order.items.forEach(item => {
                    const name = item.name || item.productName || 'Desconocido';
                    itemsCount += (item.quantity || 0);
                    productsMap[name] = (productsMap[name] || 0) + (item.quantity || 0);
                });
            }
        });

        const productsList = Object.entries(productsMap)
            .map(([name, quantity]) => ({ name, quantity }))
            .sort((a, b) => b.quantity - a.quantity);

        return {
            totalOrders: readyOrders.length,
            totalItems: itemsCount,
            aggregatedProducts: productsList
        };
    }, [readyOrders]);

    useEffect(() => {
        const fetchEntregadores = async () => {
            try {
                const users = await getUsersByRole('entregador');
                setEntregadores(users);
            } catch (error) {
                console.error("Error fetching deliverers:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchEntregadores();
    }, []);

    const filteredEntregadores = useMemo(() => entregadores.filter(e =>
        (e.email && e.email.toLowerCase().includes(searchText.toLowerCase())) ||
        (e.displayName && e.displayName.toLowerCase().includes(searchText.toLowerCase()))
    ), [entregadores, searchText]);

    const handleConfirmHandover = async () => {
        if (!selectedEntregador) {
            Alert.alert('Selección requerida', 'Por favor selecciona un entregador.');
            return;
        }

        Alert.alert(
            'Confirmar Entrega de Carga',
            `Se entregarán ${totalOrders} ordenes (${totalItems} productos) a ${selectedEntregador.email || 'el repartidor'}. ¿Continuar?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Entregar Carga', onPress: processHandover }
            ]
        );
    };

    const processHandover = async () => {
        setProcessing(true);
        const currentUser = auth().currentUser;

        try {
            const token = await currentUser.getIdToken(true);
            const batch = firestore().batch();
            const timestamp = firestore.Timestamp.now();

            // We update each order in the batch
            // Note: Firestore batches are limited to 500 operations.
            // If readyOrders > 500, this simple approach will fail. Assuming < 500 for now.

            readyOrders.forEach(order => {
                const ref = firestore().collection('presales').doc(order.id);
                batch.update(ref, {
                    status: 'dispatched',
                    entregadorId: selectedEntregador.uid,
                    dispatchedAt: timestamp,
                    dispatchedBy: currentUser.uid
                });
            });

            await batch.commit();

            Alert.alert('Éxito', 'La carga ha sido entregada al repartidor correctamente.');
            navigation.goBack();
        } catch (error) {
            console.error("Error en bulk handover:", error);
            Alert.alert('Error', 'No se pudo completar la entrega de carga. Intenta nuevamente.');
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return <View style={styles.center}><ActivityIndicator size="large" color="#5856D6" /></View>;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                 <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="close" size={28} color="#333" />
                 </TouchableOpacity>
                 <Text style={styles.headerTitle}>Entregar Carga</Text>
                 <View style={{width: 28}} />
            </View>

            <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Resumen de Entrega</Text>
                <View style={styles.row}>
                    <Text style={styles.label}>Total Ordenes:</Text>
                    <Text style={styles.value}>{totalOrders}</Text>
                </View>
                 <View style={styles.row}>
                    <Text style={styles.label}>Total Productos:</Text>
                    <Text style={styles.value}>{totalItems}</Text>
                </View>
                <View style={styles.divider} />
                <Text style={styles.subTitle}>Detalle:</Text>
                {aggregatedProducts.slice(0, 5).map(p => (
                    <Text key={p.name} style={styles.productText}>• {p.quantity} x {p.name}</Text>
                ))}
                {aggregatedProducts.length > 5 && <Text style={styles.moreText}>... y {aggregatedProducts.length - 5} más</Text>}
            </View>

            <Text style={styles.sectionTitle}>Seleccionar Entregador</Text>

            <View style={styles.searchContainer}>
                <Icon name="search" size={20} color="#999" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar repartidor..."
                    value={searchText}
                    onChangeText={setSearchText}
                />
            </View>

            <FlatList
                data={filteredEntregadores}
                keyExtractor={item => item.uid}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[
                            styles.userItem,
                            selectedEntregador?.uid === item.uid && styles.selectedItem
                        ]}
                        onPress={() => setSelectedEntregador(item)}
                    >
                         <View style={styles.avatar}>
                            <Icon name="person" size={20} color="#555" />
                         </View>
                         <View style={{flex: 1}}>
                             <Text style={styles.userName}>{item.email}</Text>
                             <Text style={styles.userRole}>Entregador</Text>
                         </View>
                         {selectedEntregador?.uid === item.uid && (
                             <Icon name="checkmark-circle" size={24} color="#34C759" />
                         )}
                    </TouchableOpacity>
                )}
            />

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[
                        styles.confirmButton,
                        (!selectedEntregador || processing) && styles.disabledButton
                    ]}
                    onPress={handleConfirmHandover}
                    disabled={!selectedEntregador || processing}
                >
                    {processing ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text style={styles.confirmButtonText}>Confirmar Transferencia</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F5F7' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: 'white' },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },

    summaryCard: { backgroundColor: 'white', margin: 16, padding: 16, borderRadius: 12, elevation: 2 },
    summaryTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#333' },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    label: { color: '#666', fontSize: 14 },
    value: { fontWeight: 'bold', fontSize: 14, color: '#333' },
    divider: { height: 1, backgroundColor: '#eee', marginVertical: 10 },
    subTitle: { fontSize: 14, fontWeight: '600', marginBottom: 6, color: '#555' },
    productText: { fontSize: 13, color: '#444', marginLeft: 10, marginBottom: 2 },
    moreText: { fontSize: 12, color: '#888', marginLeft: 10, fontStyle: 'italic' },

    sectionTitle: { marginLeft: 16, marginBottom: 8, fontSize: 14, fontWeight: 'bold', color: '#666', textTransform: 'uppercase' },

    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 10, height: 45, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },

    userItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 12, marginHorizontal: 16, marginBottom: 8, borderRadius: 10 },
    selectedItem: { borderColor: '#34C759', borderWidth: 2, backgroundColor: '#F0FFF4' },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    userName: { fontSize: 15, fontWeight: 'bold', color: '#333' },
    userRole: { fontSize: 12, color: '#888' },

    footer: { padding: 16, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#eee' },
    confirmButton: { backgroundColor: '#34C759', padding: 16, borderRadius: 12, alignItems: 'center' },
    disabledButton: { backgroundColor: '#A5D6A7' },
    confirmButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});
