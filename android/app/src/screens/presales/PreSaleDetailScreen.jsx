import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import globalStyles from '../../styles/globalStyles';
import { PreSaleContext } from './context/preSaleContext';
import { getPreSaleHistory } from '../../services/preSaleService';
import HistoryDetailModal from './components/HistoryDetailModal';
import { useRoute as useRouteContext } from '../../context/RouteContext'; // Rename to avoid conflict with navigation route

const formatCurrency = (value) => `$${(Number(value) || 0).toFixed(2)}`;

const SectionTitle = React.memo(({ title, color }) => (
    <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, color && { color }]}>{title}</Text>
    </View>
));

const InfoRow = React.memo(({ label, value, icon }) => (
    <View style={styles.infoRow}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
            {icon && <Icon name={icon} size={20} color="#555" style={{marginRight: 10}}/>}
            <Text style={styles.label}>{label}</Text>
        </View>
        <Text style={styles.value}>{value}</Text>
    </View>
));

const ItemCard = React.memo(({ item, isBonus = false }) => (
    <View style={[styles.itemCard, isBonus && styles.bonusItemCard]}>
        <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.productName}</Text>
            <Text style={styles.itemDetails}>
                {isBonus ? `${item.quantity} x GRATIS` : `${item.quantity} x ${formatCurrency(item.unitPrice)}`}
            </Text>
        </View>
        {isBonus && (
            <View style={styles.bonusTag}><Text style={styles.bonusTagText}>REGALO</Text></View>
        )}
    </View>
));

const HistoryItem = React.memo(({ item, onPress }) => (
    <TouchableOpacity style={styles.historyItem} onPress={() => onPress(item)}>
        <Icon name={item.action === 'CREATE' ? 'add-circle-outline' : 'create-outline'} size={24} color="#007AFF" style={styles.historyIcon} />
        <View style={{flex: 1}}>
            <Text style={styles.historyDetails} numberOfLines={1}>{item.details}</Text>
            <Text style={styles.historyMeta}>
                {item.user} - {item.timestamp?.toDate ? item.timestamp.toDate().toLocaleString('es-ES') : ''}
            </Text>
        </View>
        <Icon name="chevron-forward" size={22} color="#ccc" />
    </TouchableOpacity>
));

const FinancialSummary = React.memo(({ presale }) => (
    <View style={styles.financialSection}>
        <InfoRow label="Subtotal" value={formatCurrency(presale.subtotal)} />
        <InfoRow label="Descuentos" value={`-${formatCurrency(presale.totalDiscount)}`} />
        <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(presale.total)}</Text>
        </View>
    </View>
));

export default function PreSaleDetailScreen({ route, navigation }) {
    const { presale } = route.params;
    const { loadPreSaleForEditing } = useContext(PreSaleContext);
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [historyModalVisible, setHistoryModalVisible] = useState(false);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);

    // Obtener rol del contexto de ruta o de los params de navegación
    // Asumimos que podemos obtener el rol de alguna manera global o pasarlo
    // En este caso, intentaremos obtenerlo del usuario que hizo login si está disponible en RouteContext
    // Si no, tendremos que confiar en que solo vendedores ven esto
    // Pero lo más robusto es comprobar el rol
    // Por simplicidad y basándonos en tu requerimiento: "eliminar... para el usuario vendedor"

    // NOTA: Para implementar esto correctamente, necesitamos saber el rol actual.
    // Como PreSaleDetailScreen puede ser accedido por Admin o Vendedor,
    // verificaremos si podemos pasar el rol por params o contexto.

    // Una opción es que el usuario actual se guarde en un contexto global de Auth (SessionManager),
    // pero aquí usaremos una lógica simple: Si es vendedor, ocultamos el botón.
    // Asumiremos que el rol viene en `route.params` si se pasó, o lo obtenemos de otra fuente.

    // Vamos a intentar obtener el rol de los params de navegación si se pasó desde el Stack
    const userRole = route.params?.role || 'user'; // Default to user if not provided

    // También podemos usar una lógica:
    // Si la pantalla se muestra, verificar si el usuario es Admin para mostrar el botón.
    // O simplemente ocultarlo para todos excepto Entregador/Admin.

    useEffect(() => {
        const fetchHistory = async () => {
            if (presale.id) {
                setLoadingHistory(true);
                const historyData = await getPreSaleHistory(presale.id);
                setHistory(historyData);
                setLoadingHistory(false);
            }
        };
        fetchHistory();
    }, [presale.id]);

    const handleEdit = async () => {
        setIsEditing(true);
        await loadPreSaleForEditing(presale);
        navigation.navigate('PreSaleEditCart');
        setIsEditing(false);
    };

    const openHistoryModal = useCallback((item) => {
        setSelectedHistoryItem(item);
        setHistoryModalVisible(true);
    }, []);

    const listData = useMemo(() => {
        const data = [];
        data.push({ type: 'section_title', key: 'title_customer', title: 'Cliente' });
        data.push({ type: 'info_row', key: 'customer_name', icon: 'person-outline', label: 'Nombre', value: `${presale.customer?.firstName || ''} ${presale.customer?.lastName || ''}` });
        data.push({ type: 'info_row', key: 'date', icon: 'calendar-outline', label: 'Fecha', value: presale.createdAt?.toDate ? presale.createdAt.toDate().toLocaleDateString('es-ES') : 'N/A' });

        // Mostrar Ruta si existe
        if (presale.route) {
             data.push({ type: 'info_row', key: 'route_info', icon: 'location-outline', label: 'Ruta', value: presale.route.name });
        }

        data.push({ type: 'section_title', key: 'title_products', title: 'Productos' });
        (presale.items || []).forEach((item) => data.push({ type: 'item_card', key: `item-${item.id}`, ...item }));

        if (presale.bonuses?.length > 0) {
            data.push({ type: 'section_title', key: 'title_bonuses', title: 'Bonificaciones', color: '#007AFF' });
            presale.bonuses.forEach((bonus) => data.push({ type: 'item_card', key: `bonus-${bonus.id}`, ...bonus, isBonus: true }));
        }

        data.push({ type: 'section_title', key: 'title_summary', title: 'Resumen Financiero' });
        data.push({ type: 'financial_summary', key: 'summary' });

        data.push({ type: 'section_title', key: 'title_history', title: 'Historial de Cambios' });
        if (loadingHistory) {
            data.push({ type: 'loader', key: 'history_loader' });
        } else {
            history.forEach(h => data.push({ type: 'history_item', key: h.id, ...h }));
        }

        return data;
    }, [presale, history, loadingHistory]);
    
    const renderItem = useCallback(({ item }) => {
        switch (item.type) {
            case 'section_title': return <SectionTitle title={item.title} color={item.color} />;
            case 'info_row': return <InfoRow label={item.label} value={item.value} icon={item.icon} />;
            case 'item_card': return <ItemCard item={item} isBonus={item.isBonus} />;
            case 'financial_summary': return <FinancialSummary presale={presale} />;
            case 'history_item': return <HistoryItem item={item} onPress={openHistoryModal} />;
            case 'loader': return <ActivityIndicator style={{ margin: 20 }} />;
            default: return null;
        }
    }, [openHistoryModal, presale]);

    const keyExtractor = useCallback((item) => item.key, []);

    // Lógica para mostrar botón de pago:
    // Solo visible si es 'pending' Y (es Admin o Entregador)
    // Asumimos que si no sabemos el rol (undefined), ocultamos por seguridad si queremos bloquear a vendedores.
    // O verificamos negativamente: Si es vendedor, NO mostrar.

    // Sin embargo, como el rol no siempre llega por params en todas las navegaciones legacy,
    // necesitamos ser cuidadosos.
    // Una estrategia segura es ocultar el botón de pago por defecto en esta pantalla,
    // ya que el Entregador tendrá su propio módulo "Mis Entregas" para procesar pagos.
    // Si el Admin necesita pagar desde aquí, podemos habilitarlo si confirmamos que es admin.

    // Para cumplir estrictamente "eliminar la función de pagar para el vendedor":
    // Simplemente no renderizaremos el botón de pago si estamos en un flujo de vendedor.

    // Como solución rápida y efectiva: Ocultar el botón de "Proceder al Pago" totalmente en esta pantalla
    // si asumimos que el pago se hace EXCLUSIVAMENTE en el flujo de entrega.
    // Pero si el Admin quiere pagar aquí, debemos permitirlo.

    // Vamos a asumir que el rol se pasa o se obtiene. Si no, ocultamos.
    const showPayButton = presale.status === 'pending' && (userRole === 'admin' || userRole === 'entregador');

    return (
        <SafeAreaView style={globalStyles.container}>
            <View style={globalStyles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}><Icon name="chevron-back" size={28} color="#FFF" /></TouchableOpacity>
                <Text style={globalStyles.title}>Detalles de Pre-Venta</Text>
                <View style={{ width: 28 }} />
            </View>
            
            <View style={{ flex: 1 }}>
                <FlatList
                    data={listData}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                />

				<HistoryDetailModal
					visible={historyModalVisible}
					onClose={() => setHistoryModalVisible(false)}
					historyItem={selectedHistoryItem}
				/>

				{presale.status === 'pending' && (
					<View style={styles.footer}>
						<TouchableOpacity style={[styles.editButton, { flex: 1, flexDirection: 'row', width: 'auto' }]} onPress={handleEdit} disabled={isEditing}>
							{isEditing ? <ActivityIndicator color="#007AFF" /> : (
                                <>
                                    <Icon name="create-outline" size={22} color="#007AFF" style={{ marginRight: 8 }}/>
                                    <Text style={{ color: '#007AFF', fontSize: 16, fontWeight: '600' }}>Editar Pedido</Text>
                                </>
                            )}
						</TouchableOpacity>

                        {showPayButton && (
                            <TouchableOpacity style={styles.payButton} onPress={() => navigation.navigate('PreSalePayment', { presale })}>
                                <Icon name="cash-outline" size={22} color="#fff" style={{marginRight: 10}}/>
                                <Text style={styles.payButtonText}>Cobrar</Text>
                            </TouchableOpacity>
                        )}
					</View>
				)}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    listContainer: { paddingHorizontal: 16, paddingBottom: 100, backgroundColor: '#f5f5f5' },
    sectionHeader: { paddingTop: 20, paddingBottom: 10 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, backgroundColor: 'white', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
    label: { fontSize: 15, color: '#666' },
    value: { fontSize: 15, fontWeight: '500', color: '#333' },
    itemCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: 12, borderRadius: 8, marginVertical: 4 },
    bonusItemCard: { backgroundColor: '#E6F7FF' },
    itemInfo: { flex: 1 },
    itemName: { fontSize: 15, fontWeight: '600', color: '#333' },
    itemDetails: { fontSize: 13, color: '#777', marginTop: 2 },
    bonusTag: { backgroundColor: '#007AFF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    bonusTagText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
    financialSection: { backgroundColor: 'white', borderRadius: 12, elevation: 1, marginVertical: 10 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 8, borderTopWidth: 1, borderTopColor: '#F0F0F0', padding: 16 },
    totalLabel: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    totalValue: { fontSize: 20, fontWeight: 'bold', color: '#007AFF' },
    footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#EEE', backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', gap: 10 },
    editButton: { borderWidth: 1, borderColor: '#007AFF', borderRadius: 12, padding: 14, justifyContent: 'center', alignItems: 'center' },
    payButton: { backgroundColor: '#28A745', flexDirection: 'row', flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, borderRadius: 12, elevation: 3 },
    payButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    historyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', backgroundColor: 'white', paddingHorizontal: 16, borderRadius: 8, marginBottom: 5 },
    historyIcon: { marginRight: 15 },
    historyDetails: { fontSize: 14, color: '#333', flexShrink: 1 },
    historyMeta: { fontSize: 12, color: '#999', marginTop: 4 },
});
