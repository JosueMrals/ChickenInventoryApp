import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { warehouseStyles as styles } from '../styles/warehouseStyles';

const DashboardPanel = ({ preSales, onHandoverPress }) => {
    const { aggregatedProducts, totalUnits, totalOrders, statusCounts } = React.useMemo(() => {
        const totals = {};
        let units = 0;
        const sCounts = { pending: 0, preparing: 0, ready_for_delivery: 0 };

        preSales.forEach(sale => {
            if (sCounts[sale.status] !== undefined) sCounts[sale.status]++;

            // Solo agregar al conteo de productos si está en estado relevante (pending, preparing, ready_for_delivery)
            if (['pending', 'preparing', 'ready_for_delivery'].includes(sale.status)) {
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

            {/* Botón de Acción Principal para Bodeguero */}
            {statusCounts.ready_for_delivery > 0 && (
                <TouchableOpacity style={styles.handoverButton} onPress={onHandoverPress}>
                    <Icon name="bicycle" size={24} color="white" />
                    <Text style={styles.handoverButtonText}>
                        Entregar {statusCounts.ready_for_delivery} Ordenes al Entregador
                    </Text>
                </TouchableOpacity>
            )}

            <Text style={[styles.sectionHeader, { marginTop: 25 }]}>Carga Total (Productos)</Text>

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

export default DashboardPanel;
