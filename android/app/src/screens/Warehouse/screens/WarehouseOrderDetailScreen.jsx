import React, { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, SafeAreaView, Alert, Modal, TextInput } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import functions from '@react-native-firebase/functions';
import auth from '@react-native-firebase/auth';
import globalStyles from '../../../styles/globalStyles';
import styles from '../styles/WarehouseOrderDetailStyles';
import { getUsersByRole } from '../../../services/auth';
import { updatePreSaleStatusGuarded } from '../../../services/preSaleService';
import { resolveCustomerName } from '../../../utils/customerUtils';
import { useAdaptiveBottom } from '../../../hooks/useAdaptiveBottom';
import { useSubmitLock } from '../../../hooks/useSubmitLock';
import { PreSaleContext } from '../../presales/context/preSaleContext';

const formatCurrency = (value) => `$${(Number(value) || 0).toFixed(2)}`;

const getStatusBadge = (status) => {
    switch (status) {
        case 'pending':
        case 'credit_pending':
            return { label: STATUS_LABELS[status] || status, color: '#F2C94C', textColor: '#3E2F00' };
        case 'preparing':
        case 'credit_preparing':
            return { label: STATUS_LABELS[status] || status, color: '#DCE9FF', textColor: '#0F3D91' };
        case 'ready_for_delivery':
        case 'credit_ready_for_delivery':
            return { label: STATUS_LABELS[status] || status, color: '#DFF5E6', textColor: '#1E6B34' };
        default:
            return { label: STATUS_LABELS[status] || status, color: '#EEE', textColor: '#555' };
    }
};

const STATUS_LABELS = {
  pending: 'Pendiente',
  credit_pending: 'Pendiente (Crédito)',
  preparing: 'En Preparación',
  credit_preparing: 'En Preparación (Crédito)',
  ready_for_delivery: 'Lista para Entrega',
  credit_ready_for_delivery: 'Lista para Entrega (Crédito)',
  dispatched: 'En Reparto',
  paid: 'Pagada',
  delivered: 'Entregada' // Agregando delivered por si acaso
};

const SectionTitle = React.memo(({ title, color }) => (
    <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, color && { color }]}>{title}</Text>
    </View>
));

const InfoRow = React.memo(({ label, value, icon, badgeText, badgeColor, badgeTextColor }) => (
    <View style={styles.infoRow}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
            {icon && <Icon name={icon} size={18} color="#555" style={{marginRight: 8}}/>}
            <Text style={styles.label}>{label}</Text>
        </View>
        {badgeText ? (
            <View style={[styles.statusBadge, { backgroundColor: badgeColor }]}>
                <Text style={[styles.statusBadgeText, { color: badgeTextColor }]}>{badgeText}</Text>
            </View>
        ) : (
            <Text style={styles.value}>{value}</Text>
        )}
    </View>
));

const ItemCard = React.memo(({ item, isBonus = false }) => {
    const qty = Number(item.quantity) || 0;
    const unit = Number(item.unitPrice) || 0;
    const lineTotal = isBonus ? null : formatCurrency(item.total ?? (qty * unit));

    return (
        <View style={[styles.itemCard, isBonus && styles.bonusItemCard]}>
            <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.productName || item.name}</Text>
                <Text style={styles.itemDetails}>
                    {isBonus ? `${qty} x GRATIS` : `${qty} x ${formatCurrency(unit)}`}
                </Text>
            </View>
            <View style={styles.itemRight}>
                {!isBonus && <Text style={styles.itemTotal}>{lineTotal}</Text>}
                {isBonus && (
                    <View style={styles.bonusTag}><Text style={styles.bonusTagText}>REGALO</Text></View>
                )}
            </View>
        </View>
    );
});

export default function WarehouseOrderDetailScreen({ route, navigation }) {
    const routePresale = route.params?.presale;
    const [presale, setPresale] = useState(routePresale);
    const [loading, setLoading] = useState(false);
    const [entregadores, setEntregadores] = useState([]);
    const [showEntregadorPicker, setShowEntregadorPicker] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [processingEntregadorId, setProcessingEntregadorId] = useState(null);
    const { runLocked } = useSubmitLock();
    const { bottomPadding } = useAdaptiveBottom();

    // Esta pantalla vive en el Drawer: es una ÚNICA instancia que NO se remonta al
    // navegar a otra orden. `useState(routePresale)` capturaba la primera orden y
    // nunca cambiaba → siempre se abría la misma. Sincronizamos con los params
    // cuando cambia el id (y reseteamos el selector de entregador).
    useEffect(() => {
        if (routePresale?.id && routePresale.id !== presale?.id) {
            setPresale(routePresale);
            setShowEntregadorPicker(false);
            setSearchText('');
            setProcessingEntregadorId(null);
        }
    }, [routePresale?.id]);

    // El mapa de clientes lo mantiene PreSaleProvider a nivel app. Antes cada pantalla
    // de Bodega abría su propio listener sobre la colección `customers` completa.
    const { customersById } = useContext(PreSaleContext);

    useEffect(() => {
        const fetchEntregadores = async () => {
            const users = await getUsersByRole('entregador');
            setEntregadores(users);
        };
        fetchEntregadores();
    }, []);

    const updateStatus = async (newStatus) => {
        setLoading(true);
        try {
            // Guarded: relee el estado real antes de escribir. Ver updatePreSaleStatusGuarded.
            await updatePreSaleStatusGuarded(presale.id, newStatus);
            setPresale(prev => ({ ...prev, status: newStatus }));

            // If ready for delivery, we don't automatically show picker anymore to prefer Bulk Handover,
            // but we can still show a success message.
            if(newStatus === 'ready_for_delivery' || newStatus === 'credit_ready_for_delivery'){
                Alert.alert("Orden Lista", "La orden está lista para entrega. Puedes asignarla individualmente o usar la entrega masiva en el panel.");
            }
        } catch (error) {
            // El mensaje de la guarda explica el porqué (p. ej. la orden ya fue cobrada).
            Alert.alert('Error', error?.message || 'No se pudo actualizar el estado.');
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

        // runLocked descarta el segundo toque sobre "Asignar": sin esto se
        // llamaba dos veces a dispatchPreSale para la misma preventa.
        // OJO: sin keepLockedOnSuccess. Esta pantalla es del Drawer (no se remonta),
        // así que un cerrojo que no se libera tras éxito dejaba la asignación
        // bloqueada para SIEMPRE tras el primer despacho. El cerrojo por-ref ya
        // cubre el doble toque durante la llamada en vuelo.
        return runLocked(async () => {
            setProcessingEntregadorId(entregadorId);
            try {
                const token = await currentUser.getIdToken(true);
                const dispatchFunction = functions().httpsCallable('dispatchPreSale');

                await dispatchFunction({
                    preSaleId: presale.id,
                    entregadorId,
                    authToken: token
                });

                Alert.alert('Éxito', 'La pre-venta ha sido asignada y está en reparto.');
                setSearchText('');
                setShowEntregadorPicker(false);
                navigation.navigate('PreparePreSales', { tab: 'list' });
            } catch (error) {
                console.error("❌ Error en dispatchToEntregador:", error);
                Alert.alert('Error', error.message || 'Error al asignar.');
                throw error;
            } finally {
                setProcessingEntregadorId(null);
            }
        }).catch(() => {});
    };

    const filteredEntregadores = useMemo(() => entregadores.filter(e =>
        (e.email && e.email.toLowerCase().includes(searchText.toLowerCase())) ||
        (e.displayName && e.displayName.toLowerCase().includes(searchText.toLowerCase()))
    ), [entregadores, searchText]);

    const listData = useMemo(() => {
        const data = [];
        const customerName = resolveCustomerName(presale, customersById);
        const statusBadge = getStatusBadge(presale.status);

        data.push({ type: 'section_title', key: 'title_products', title: 'Productos' });
        (presale.items || []).forEach((item, index) => data.push({ type: 'item_card',
            key: `item-${index}`, ...item }));

        if (presale.bonuses?.length > 0) {
            data.push({ type: 'section_title', key: 'title_bonuses', title: 'Bonificaciones', color: '#007AFF' });
            presale.bonuses.forEach((bonus, index) => data.push({ type: 'item_card', key: `bonus-${index}`, ...bonus, isBonus: true }));
        }

        data.unshift({
            type: 'info_row',
            key: 'status',
            icon: 'information-circle-outline',
            label: 'Estado',
            badgeText: statusBadge.label,
            badgeColor: statusBadge.color,
            badgeTextColor: statusBadge.textColor
        });
        data.unshift({ type: 'info_row', key: 'date', icon: 'calendar-outline', label: 'Fecha', value: presale.createdAt?.toDate ? presale.createdAt.toDate().toLocaleDateString('es-ES') : 'N/A' });
        data.unshift({ type: 'info_row', key: 'customer_name', icon: 'person-outline', label: 'Cliente', value: customerName });

        return data;
    }, [presale, customersById]);

    const renderItem = useCallback(({ item }) => {
        switch (item.type) {
            case 'section_title': return <SectionTitle title={item.title} color={item.color} />;
            case 'info_row': return <InfoRow label={item.label} value={item.value} icon={item.icon} />;
            case 'item_card': return <ItemCard item={item} isBonus={item.isBonus} />;
            default: return null;
        }
    }, []); // no depende de presale: los datos llegan por `item`

    return (
        <SafeAreaView style={globalStyles.container}>
            <View style={globalStyles.header}>
                <TouchableOpacity onPress={() => {
                    navigation.navigate('PreparePreSales', { tab: 'list' });
                }}>
                    <Icon name="chevron-back" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={globalStyles.title}>Detalle de la Orden</Text>
                <View style={{ width: 28 }} />
            </View>

            <View style={{ flex: 1 }}>
                <FlatList
                    data={listData}
                    renderItem={renderItem}
                    keyExtractor={item => item.key}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={() => {
                        const customerName = resolveCustomerName(presale, customersById);
                        const statusBadge = getStatusBadge(presale.status);
                        const totalItems = [...(presale.items || []), ...(presale.bonuses || [])].reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
                        const isCredit = presale.paymentMethod === 'credit';

                        return (
                            <View style={styles.summaryCard}>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryName}>{customerName}</Text>
                                    <View style={[styles.statusBadge, { backgroundColor: statusBadge.color }]}>
                                        <Text style={[styles.statusBadgeText, { color: statusBadge.textColor }]}>{statusBadge.label}</Text>
                                    </View>
                                </View>
                                <View style={styles.summaryMetaRow}>
                                    <Text style={styles.summaryMeta}>Fecha: {presale.createdAt?.toDate ? presale.createdAt.toDate().toLocaleDateString('es-ES') : 'N/A'}</Text>
                                    <Text style={styles.summaryMeta}>Items: {totalItems}</Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryTotal}>{formatCurrency(presale.total)}</Text>
                                    {isCredit && (
                                        <View style={styles.creditBadge}>
                                            <Text style={styles.creditBadgeText}>Crédito</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        );
                    }}
                />
            </View>

            <View style={[styles.footer, { paddingBottom: bottomPadding }]}>
                {loading ? <ActivityIndicator size="large" color="#5856D6" /> : (
                    <>
                        {(presale.status === 'pending' || presale.status === 'credit_pending') && (
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => updateStatus(presale.paymentMethod === 'credit' ? 'credit_preparing' : 'preparing')}
                            >
                                <Icon name="hammer-outline" size={20} color="white" style={{marginRight: 8}} />
                                <Text style={styles.buttonText}>Empezar Preparación</Text>
                            </TouchableOpacity>
                        )}
                        {(presale.status === 'preparing' || presale.status === 'credit_preparing') && (
                            <TouchableOpacity
                                style={[styles.actionButton, {backgroundColor: '#34C759'}]}
                                onPress={() => updateStatus(presale.paymentMethod === 'credit' ? 'credit_ready_for_delivery' : 'ready_for_delivery')}
                            >
                                <Icon name="checkmark-circle-outline" size={20} color="white" style={{marginRight: 8}} />
                                <Text style={styles.buttonText}>Marcar Lista para Entrega</Text>
                            </TouchableOpacity>
                        )}
                        {(presale.status === 'ready_for_delivery' || presale.status === 'credit_ready_for_delivery') && (
                            <TouchableOpacity style={[styles.actionButton, {backgroundColor: '#FF9500'}]} onPress={() => setShowEntregadorPicker(true)}>
                                <Icon name="bicycle-outline" size={20} color="white" style={{marginRight: 8}} />
                                <Text style={styles.buttonText}>Asignar Individualmente</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}
            </View>

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
        </SafeAreaView>
    );
}
