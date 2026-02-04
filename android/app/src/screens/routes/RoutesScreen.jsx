import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import globalStyles from '../../styles/globalStyles';
import { useFocusEffect } from '@react-navigation/native';
import RouteEditPanel from './components/RouteEditPanel';
import routesService from './services/routesService';

export default function RoutesScreen({ navigation }) {
    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editPanelVisible, setEditPanelVisible] = useState(false);
    const [selectedRoute, setSelectedRoute] = useState(null);

    useFocusEffect(
        React.useCallback(() => {
            loadRoutes();
        }, [])
    );

    const loadRoutes = async () => {
        setLoading(true);
        try {
            const data = await routesService.getRoutes();
            setRoutes(data);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudieron cargar las rutas.');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (route) => {
        setSelectedRoute(route);
        setEditPanelVisible(true);
    };

    const handleSaveRoute = async (updatedRoute) => {
        try {
            await routesService.updateRoute(updatedRoute.id, {
                name: updatedRoute.name,
                start: updatedRoute.start,
                end: updatedRoute.end
            });
            // Update local state to reflect changes without reloading
            setRoutes(prev => prev.map(r => r.id === updatedRoute.id ? updatedRoute : r));
            Alert.alert('Éxito', 'Ruta actualizada correctamente.');
        } catch (error) {
            console.error('Error updating route:', error);
            Alert.alert('Error', 'No se pudo actualizar la ruta.');
            throw error; // Propagate error to panel so it stops loading
        }
    };

    const renderEmptyComponent = () => (
        <View style={styles.emptyContainer}>
            <Icon name="map-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No hay rutas registradas</Text>
            <Text style={styles.emptySubText}>Agrega una nueva ruta para comenzar.</Text>
        </View>
    );

    const renderItem = ({ item }) => (
        <TouchableOpacity onPress={() => handleEdit(item)} activeOpacity={0.8}>
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Icon name="location" size={24} color="#E91E63" />
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Icon name="create-outline" size={20} color="#ccc" style={{marginLeft: 'auto'}} />
                </View>
                <View style={styles.cardBody}>
                    <View style={styles.locationRow}>
                        <Icon name="navigate-circle-outline" size={18} color="#4CAF50" />
                        <Text style={styles.locationLabel}>Inicio:</Text>
                        <Text style={styles.locationText}>{item.start}</Text>
                    </View>
                    <View style={styles.connector} />
                    <View style={styles.locationRow}>
                        <Icon name="flag-outline" size={18} color="#F44336" />
                        <Text style={styles.locationLabel}>Fin:</Text>
                        <Text style={styles.locationText}>{item.end}</Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={globalStyles.container}>
            <View style={globalStyles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="chevron-back" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={globalStyles.title}>Rutas de Entrega</Text>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#E91E63" style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={routes}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={renderEmptyComponent}
                />
            )}

            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('AddRouteScreen')}
            >
                <Icon name="add" size={30} color="#fff" />
            </TouchableOpacity>

            <RouteEditPanel
                visible={editPanelVisible}
                route={selectedRoute}
                onClose={() => setEditPanelVisible(false)}
                onSave={handleSaveRoute}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    listContent: {
        padding: 16,
        paddingBottom: 100,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 100,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#888',
        marginTop: 16,
    },
    emptySubText: {
        fontSize: 14,
        color: '#aaa',
        marginTop: 8,
    },
    fab: {
        position: 'absolute',
        right: 30,
        bottom: 30,
        backgroundColor: '#E91E63', // Pink to match dashboard module
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginLeft: 10,
    },
    cardBody: {
        paddingLeft: 4,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 4,
    },
    locationLabel: {
        fontSize: 14,
        color: '#666',
        fontWeight: '600',
        marginLeft: 8,
        marginRight: 4,
        width: 45,
    },
    locationText: {
        fontSize: 15,
        color: '#333',
        flex: 1,
    },
    connector: {
        height: 12,
        borderLeftWidth: 2,
        borderLeftColor: '#ddd',
        marginLeft: 9,
        marginVertical: 0,
    }
});
