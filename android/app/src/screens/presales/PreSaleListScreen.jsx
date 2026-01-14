import React, { useContext, useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { PreSaleContext } from './context/preSaleContext';
import Icon from 'react-native-vector-icons/Ionicons';
import PreSaleCard from './components/PreSaleCard';
import { useFocusEffect } from '@react-navigation/native';
import globalStyles from '../../styles/globalStyles';

const TABS = ['Pendientes', 'Pagadas', 'Productos'];

export default function PreSaleListScreen({ navigation }) {
    const { preSales, loadPreSales, loading } = useContext(PreSaleContext);
    const [activeTab, setActiveTab] = useState(TABS[0]);

    useFocusEffect(
        React.useCallback(() => {
            loadPreSales();
        }, [])
    );

    const filteredData = useMemo(() => {
        if (activeTab === 'Pendientes') return preSales.filter(p => p.status === 'pending');
        if (activeTab === 'Pagadas') return preSales.filter(p => p.status === 'paid');
        return [];
    }, [preSales, activeTab]);

    const aggregatedProducts = useMemo(() => {
        if (activeTab !== 'Productos') return [];
        const productMap = new Map();
        preSales.forEach(sale => {
            sale.cart.forEach(item => {
                const existing = productMap.get(item.productId);
                if (existing) {
                    productMap.set(item.productId, { ...existing, quantity: existing.quantity + item.quantity });
                } else {
                    productMap.set(item.productId, { 
                        productId: item.productId, 
                        productName: item.productName, 
                        quantity: item.quantity 
                    });
                }
            });
        });
        return Array.from(productMap.values()).sort((a, b) => b.quantity - a.quantity);
    }, [preSales, activeTab]);

    const renderEmptyComponent = () => (
        <View style={styles.emptyContainer}>
            <Icon name="file-tray-stacked-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No hay elementos</Text>
            <Text style={styles.emptySubText}>No hay pre-ventas en esta categoría.</Text>
        </View>
    );
    
    return (
        <SafeAreaView style={globalStyles.container}>
            <View style={globalStyles.header}>
                <TouchableOpacity onPress={() => navigation.navigate("DashboardScreen")}>
                    <Icon name="chevron-back" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={globalStyles.title}>Mis Pre-Ventas</Text>
                <View style={{ width: 28 }} />
            </View>

            <View style={styles.tabContainer}>
                {TABS.map(tab => (
                    <TouchableOpacity 
                        key={tab} 
                        style={[styles.tab, activeTab === tab && styles.activeTab]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? <ActivityIndicator size="large" style={{ marginTop: 50 }} /> : (
                <>
                    {activeTab !== 'Productos' ? (
                        <FlatList
                            data={filteredData}
                            renderItem={({ item }) => (
                                <TouchableOpacity onPress={() => navigation.navigate('PreSaleDetail', { presale: item })}>
                                    <PreSaleCard presale={item} />
                                </TouchableOpacity>
                            )}
                            keyExtractor={item => item.id}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={renderEmptyComponent}
                        />
                    ) : (
                        <FlatList
                            data={aggregatedProducts}
                            renderItem={({ item }) => (
                                <View style={styles.productItem}>
                                    <Text style={styles.productName}>{item.productName}</Text>
                                    <Text style={styles.productQuantity}>Total: {item.quantity}</Text>
                                </View>
                            )}
                            keyExtractor={item => item.productId}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={renderEmptyComponent}
                        />
                    )}
                </>
            )}

            <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('PreSaleProducts')}>
                <Icon name="add" size={30} color="#fff" />
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    listContent: { paddingBottom: 100, paddingTop: 10 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
    emptyText: { fontSize: 18, fontWeight: '600', color: '#888', marginTop: 16 },
    emptySubText: { fontSize: 14, color: '#aaa', marginTop: 8 },
    fab: { position: 'absolute', right: 30, bottom: 30, backgroundColor: '#007AFF', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 8 },
    tabContainer: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'white', paddingVertical: 10, marginHorizontal: 16, borderRadius: 8, marginTop: -5, elevation: 1 },
    tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
    activeTab: { backgroundColor: '#007AFF' },
    tabText: { color: '#333', fontWeight: '600' },
    activeTabText: { color: 'white' },
    productItem: { backgroundColor: 'white', padding: 16, marginVertical: 6, marginHorizontal: 16, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    productName: { fontSize: 16, fontWeight: '500' },
    productQuantity: { fontSize: 16, fontWeight: 'bold', color: '#007AFF' },
});
