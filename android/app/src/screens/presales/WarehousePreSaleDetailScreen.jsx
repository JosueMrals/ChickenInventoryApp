import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, SafeAreaView, Alert, Modal, TextInput } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import auth from '@react-native-firebase/auth';
import globalStyles from '../../styles/globalStyles';
import { getUsersByRole } from '../../services/auth';

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
            <Text style={styles.itemName}>{item.productName || item.name}</Text>
            <Text style={styles.itemDetails}>
                {isBonus ? `${item.quantity} x GRATIS` : `${item.quantity} x ${formatCurrency(item.unitPrice)}`}
            </Text>
        </View>
        {isBonus && (
            <View style={styles.bonusTag}><Text style={styles.bonusTagText}>REGALO</Text></View>
        )}
    </View>
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

export default function WarehousePreSaleDetailScreen({ route, navigation }) {
    const { presale: initialPresale } = route.params;
    const [presale, setPresale] = useState(initialPresale);
    const [loading, setLoading] = useState(false);
    const [entregadores, setEntregadores] = useState([]);
    const [showEntregadorPicker, setShowEntregadorPicker] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [processingEntregadorId, setProcessingEntregadorId] = useState(null);

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
            await firestore().collection('presales').doc(presale.id).update({ status: newStatus });
            setPresale(prev => ({ ...prev, status: newStatus }));

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
            navigation.goBack();
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

    const filteredEntregadores = useMemo(() => entregadores.filter(e =>
        (e.email && e.email.toLowerCase().includes(searchText.toLowerCase())) ||
        (e.displayName && e.displayName.toLowerCase().includes(searchText.toLowerCase()))
    ), [entregadores, searchText]);

    const listData = useMemo(() => {
        const data = [];
        const customerName = presale.customer?.firstName
            ? `${presale.customer.firstName} ${presale.customer.lastName || ''}`
            : presale.customerName || 'Cliente sin nombre';

        data.push({ type: 'section_title', key: 'title_customer', title: 'Cliente' });
        data.push({ type: 'info_row', key: 'customer_name', icon: 'person-outline', label: 'Nombre', value: customerName });
        data.push({ type: 'info_row', key: 'date', icon: 'calendar-outline', label: 'Fecha', value: presale.createdAt?.toDate ? presale.createdAt.toDate().toLocaleDateString('es-ES') : 'N/A' });
        data.push({ type: 'info_row', key: 'status', icon: 'information-circle-outline', label: 'Estado', value: presale.status });

        data.push({ type: 'section_title', key: 'title_products', title: 'Productos' });
        (presale.items || []).forEach((item, index) => data.push({ type: 'item_card', key: `item-${index}`, ...item }));

        if (presale.bonuses?.length > 0) {
            data.push({ type: 'section_title', key: 'title_bonuses', title: 'Bonificaciones', color: '#007AFF' });
            presale.bonuses.forEach((bonus, index) => data.push({ type: 'item_card', key: `bonus-${index}`, ...bonus, isBonus: true }));
        }

        data.push({ type: 'section_title', key: 'title_summary', title: 'Resumen Financiero' });
        data.push({ type: 'financial_summary', key: 'summary' });

        return data;
    }, [presale]);

    const renderItem = useCallback(({ item }) => {
        switch (item.type) {
            case 'section_title': return <SectionTitle title={item.title} color={item.color} />;
            case 'info_row': return <InfoRow label={item.label} value={item.value} icon={item.icon} />;
            case 'item_card': return <ItemCard item={item} isBonus={item.isBonus} />;
            case 'financial_summary': return <FinancialSummary presale={presale} />;
            default: return null;
        }
    }, [presale]);

    return (
        <SafeAreaView style={globalStyles.container}>
            <View style={globalStyles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}><Icon name="chevron-back" size={28} color="#FFF" /></TouchableOpacity>
                <Text style={globalStyles.title}>Detalle Bodega</Text>
                <View style={{ width: 28 }} />
            </View>

            <View style={{ flex: 1 }}>
                <FlatList
                    data={listData}
                    renderItem={renderItem}
                    keyExtractor={item => item.key}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                />
            </View>

            <View style={styles.footer}>
                {loading ? <ActivityIndicator size="large" color="#5856D6" /> : (
                    <>
                        {presale.status === 'pending' && (
                            <TouchableOpacity style={styles.actionButton} onPress={() => updateStatus('preparing')}>
                                <Icon name="hammer-outline" size={20} color="white" style={{marginRight: 8}} />
                                <Text style={styles.buttonText}>Empezar Preparación</Text>
                            </TouchableOpacity>
                        )}
                        {presale.status === 'preparing' && (
                            <TouchableOpacity style={[styles.actionButton, {backgroundColor: '#34C759'}]} onPress={() => updateStatus('ready_for_delivery')}>
                                <Icon name="checkmark-circle-outline" size={20} color="white" style={{marginRight: 8}} />
                                <Text style={styles.buttonText}>Marcar Lista para Entrega</Text>
                            </TouchableOpacity>
                        )}
                        {presale.status === 'ready_for_delivery' && (
                            <TouchableOpacity style={[styles.actionButton, {backgroundColor: '#FF9500'}]} onPress={() => setShowEntregadorPicker(true)}>
                                <Icon name="bicycle-outline" size={20} color="white" style={{marginRight: 8}} />
                                <Text style={styles.buttonText}>Asignar Entregador</Text>
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

const styles = StyleSheet.create({
    listContainer: { paddingHorizontal: 16, paddingBottom: 20, backgroundColor: '#f5f5f5' },
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
    footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#EEE', backgroundColor: '#FFF' },
    actionButton: { flexDirection: 'row', backgroundColor: '#5856D6', paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    // Modal Styles
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    pickerContent: { width: '90%', maxHeight: '80%', backgroundColor: 'white', padding: 20, borderRadius: 15, alignItems: 'center', elevation: 5 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 5, color: '#333' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: 10, paddingHorizontal: 10, height: 45, width: '100%', marginBottom: 15 },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: '#333' },
    entregadorItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', width: '100%', justifyContent: 'space-between' },
    avatarContainer: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    entregadorText: { fontSize: 16, color: '#333', flex: 1 },
    emptyListText: { textAlign: 'center', color: '#999', marginVertical: 20 },
    closeButton: { backgroundColor: '#FF3B30', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, width: '100%', alignItems: 'center' },
});
