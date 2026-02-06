import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { warehouseStyles as styles } from '../styles/warehouseStyles';
import { groupItemsByProduct } from '../../../utils/warehouseUtils';
import { Swipeable } from 'react-native-gesture-handler';
import { updateAggregateProductStatus } from '../../../services/preSaleService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DashboardPanel = ({ preSales, onHandoverPress }) => {
    const [activeStatusTab, setActiveStatusTab] = useState('pending'); // 'pending', 'preparing', 'ready'

    // Calcular contadores globales de ITEMS para las pestañas
    const statusCounts = React.useMemo(() => {
        const counts = { pending: 0, preparing: 0, ready: 0 };
        // Hacemos una pasada rápida para contar items por estado
        const allProducts = groupItemsByProduct(preSales); // Sin filtro cuenta todo, pero necesitamos lógica custom rápida o reusar la function
        // Mejor iteramos preSales nosotros mismos para mayor eficiencia en contadores globales
        preSales.forEach(sale => {
             const items = [...(sale.items || []), ...(sale.bonuses || [])];
             items.forEach(i => {
                 const s = i.status || 'pending';
                 if (counts[s] !== undefined) counts[s] += (Number(i.quantity) || 0);
             });
        });
        return counts;
    }, [preSales]);

    const { aggregatedProducts, totalRegular, totalBonus } = React.useMemo(() => {
        // Obtenemos solo los productos que tienen items en el estado activo
        const products = groupItemsByProduct(preSales, activeStatusTab);

        let tReg = 0;
        let tBonus = 0;

        products.forEach(p => {
            tReg += p.regularQty;
            tBonus += p.bonusQty;
        });

        return {
            aggregatedProducts: products,
            totalRegular: tReg,
            totalBonus: tBonus,
        };
    }, [preSales, activeStatusTab]);

    const animateTransition = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    };

    const handleSwipeRight = (productName) => {
        // Retroceder estado (Antes era izquierda)
        let prevStatus = '';
        if (activeStatusTab === 'ready') prevStatus = 'preparing';
        else if (activeStatusTab === 'preparing') prevStatus = 'pending';
        else return;

        animateTransition();
        updateAggregateProductStatus(productName, prevStatus, activeStatusTab);
    };

    const handleSwipeLeft = (productName) => {
        // Avanzar estado (Antes era derecha)
        let nextStatus = '';
        if (activeStatusTab === 'pending') nextStatus = 'preparing';
        else if (activeStatusTab === 'preparing') nextStatus = 'ready';
        else return; // Ya en ready, no avanza más (o se maneja entrega)

        animateTransition();
        updateAggregateProductStatus(productName, nextStatus, activeStatusTab);
    };

    const renderRightActions = (progress, dragX) => {
        // Acciones derechas (al deslizar a la izquierda para revelar) -> Retroceder
        const isPendingTab = activeStatusTab === 'pending';
        if (isPendingTab) return null;

        const label = activeStatusTab === 'ready' ? 'Preparar' : 'Pendiente';
        const color = activeStatusTab === 'ready' ? '#007AFF' : '#F2C94C';
        const icon = activeStatusTab === 'ready' ? 'construct-outline' : 'time-outline';

        return (
            <TouchableOpacity
                style={{ backgroundColor: color, justifyContent: 'center', alignItems: 'center', width: 80, height: '100%' }}
                onPress={() => {}} // El trigger es por swipe completo
            >
                <Icon name={icon} size={24} color="#FFF" />
                <Text style={{color: 'white', fontSize: 11, fontWeight: 'bold'}}>{label}</Text>
            </TouchableOpacity>
        );
    };

    const renderLeftActions = (progress, dragX) => {
        // Acciones izquierdas (al deslizar a la derecha para revelar) -> Avanzar
        const isReadyTab = activeStatusTab === 'ready';
        if (isReadyTab) return null;

        const label = activeStatusTab === 'pending' ? 'Preparar' : 'Listo';
        const color = activeStatusTab === 'pending' ? '#007AFF' : '#34C759';
        const icon = activeStatusTab === 'pending' ? 'construct-outline' : 'checkmark-circle-outline';

        return (
            <TouchableOpacity
                style={{ backgroundColor: color, justifyContent: 'center', alignItems: 'center', width: 80, height: '100%' }}
                onPress={() => {}}
            >
                <Icon name={icon} size={24} color="#FFF" />
                <Text style={{color: 'white', fontSize: 11, fontWeight: 'bold'}}>{label}</Text>
            </TouchableOpacity>
        );
    };

    const TabButton = ({ id, label, icon, color, itemsCount }) => {
        const isActive = activeStatusTab === id;
        return (
            <TouchableOpacity
                style={{
                    flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 3,
                    borderBottomColor: isActive ? color : 'transparent'
                }}
                onPress={() => setActiveStatusTab(id)}
            >
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: isActive ? color : '#999' }}>{itemsCount}</Text>
                <Text style={{ fontSize: 10, color: isActive ? color : '#999', textTransform: 'uppercase', fontWeight: '600', marginTop: 2 }}>{label}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={{ flex: 1 }}>
            {/* --- PANEL DE PESTAÑAS (TABS) --- */}
            <View style={{
                flexDirection: 'row', backgroundColor: '#fff',
                borderBottomWidth: 1, borderBottomColor: '#eee', elevation: 2
            }}>
                <TabButton id="pending" label="Pendientes" color="#F2C94C" itemsCount={statusCounts.pending} />
                <TabButton id="preparing" label="En Proceso" color="#007AFF" itemsCount={statusCounts.preparing} />
                <TabButton id="ready" label="Listos" color="#34C759" itemsCount={statusCounts.ready} />
            </View>

            <ScrollView style={[styles.dashboardContainer, {paddingTop: 10}]} showsVerticalScrollIndicator={false}>

                {/* Cabecera de totales de la pestaña actual */}
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 4 }}>
                    <Text style={[styles.sectionHeader, {marginTop: 0, marginBottom: 0}]}>
                        {activeStatusTab === 'pending' ? 'Por Preparar' : (activeStatusTab === 'preparing' ? 'En Producción' : 'Listos para Entrega')}
                    </Text>
                    <View style={{flexDirection: 'row'}}>
                       <View style={{flexDirection: 'row', alignItems: 'center', marginRight: 10}}>
                           <View style={{width: 10, height: 10, borderRadius: 5, backgroundColor: '#43A047', marginRight: 4}} />
                           <Text style={{fontSize: 10, color: '#666'}}>Venta: <Text style={{fontWeight:'bold'}}>{totalRegular}</Text></Text>
                       </View>
                       <View style={{flexDirection: 'row', alignItems: 'center'}}>
                           <View style={{width: 10, height: 10, borderRadius: 5, backgroundColor: '#007AFF', marginRight: 4}} />
                           <Text style={{fontSize: 10, color: '#666'}}>Regalo: <Text style={{fontWeight:'bold'}}>{totalBonus}</Text></Text>
                       </View>
                    </View>
                </View>

                {/* --- LISTA DE PRODUCTOS FILTRADA --- */}
                {aggregatedProducts.map((item) => (
                     <Swipeable
                        key={`${item.name}-${activeStatusTab}`} // Key única para forzar re-render al cambiar tab
                        renderRightActions={activeStatusTab !== 'pending' ? renderRightActions : undefined}
                        renderLeftActions={activeStatusTab !== 'ready' ? renderLeftActions : undefined}
                        onSwipeableRightOpen={() => activeStatusTab !== 'pending' && handleSwipeRight(item.name)}
                        onSwipeableLeftOpen={() => activeStatusTab !== 'ready' && handleSwipeLeft(item.name)}
                     >
                         <View style={[styles.dashboardRow, {backgroundColor: '#fff', marginBottom: 1}]}>
                            <View style={styles.rowInfo}>
                                <View style={[styles.bulletPoint, {
                                    backgroundColor: activeStatusTab === 'ready' ? '#34C759' : (activeStatusTab === 'preparing' ? '#007AFF' : '#F2C94C')
                                }]} />
                                <View>
                                    <Text style={styles.rowName}>{item.name}</Text>
                                    {/* Desglose simplificado */}
                                    {(item.regularQty > 0 || item.bonusQty > 0) && (
                                        <View style={{flexDirection: 'row', marginTop: 2}}>
                                            {item.regularQty > 0 && <Text style={{fontSize: 11, color: '#43A047', marginRight: 8}}>Venta: {item.regularQty}</Text>}
                                            {item.bonusQty > 0 && <Text style={{fontSize: 11, color: '#007AFF'}}>Regalo: {item.bonusQty}</Text>}
                                        </View>
                                    )}
                                </View>
                            </View>
                            <View style={styles.rowValueContainer}>
                                <Text style={styles.rowValue}>{item.totalQty}</Text>
                                <Text style={styles.rowUnit}>und</Text>
                            </View>
                        </View>
                     </Swipeable>
                ))}

                {aggregatedProducts.length === 0 && (
                    <View style={{alignItems: 'center', marginTop: 40, opacity: 0.6}}>
                        <Icon name="file-tray-outline" size={40} color="#ccc" />
                        <Text style={{color: '#999', marginTop: 10}}>No hay productos en esta etapa.</Text>
                    </View>
                )}

                <View style={{height: 40}} />

                {/* Botón de Entrega (Solo visible en Listos) */}
                {activeStatusTab === 'ready' && aggregatedProducts.length > 0 && (
                    <TouchableOpacity style={[styles.handoverButton, {marginBottom: 30}]} onPress={onHandoverPress}>
                        <Icon name="bicycle" size={24} color="white" />
                        <Text style={styles.handoverButtonText}>
                            Entregar Carga al Repartidor
                        </Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </View>
    );
};

export default DashboardPanel;
