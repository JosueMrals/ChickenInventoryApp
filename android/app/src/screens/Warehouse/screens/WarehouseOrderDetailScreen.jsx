import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, SafeAreaView, Alert, Modal, TextInput } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import auth from '@react-native-firebase/auth';
import globalStyles from '../../../styles/globalStyles';
import styles from '../styles/WarehouseOrderDetailStyles';
import { getUsersByRole } from '../../../services/auth';

const formatCurrency = (value) => `$${(Number(value) || 0).toFixed(2)}`;

const STATUS_LABELS = {
  pending: 'Pendiente',
  preparing: 'En Preparación',
  ready_for_delivery: 'Lista para Entrega',
  dispatched: 'En Reparto',
  paid: 'Pagada',
  delivered: 'Entregada' // Agregando delivered por si acaso
};

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

export default function WarehouseOrderDetailScreen({ route, navigation }) {
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

            // If ready for delivery, we don't automatically show picker anymore to prefer Bulk Handover,
            // but we can still show a success message.
            if(newStatus === 'ready_for_delivery'){
                Alert.alert("Orden Lista", "La orden está lista para entrega. Puedes asignarla individualmente o usar la entrega masiva en el panel.");
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
            Alert.alert('Error', error.message || 'Error al asignar.');
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

        const statusLabel = STATUS_LABELS[presale.status] || presale.status;

        data.push({ type: 'section_title', key: 'title_customer', title: 'Cliente' });
        data.push({ type: 'info_row', key: 'customer_name', icon: 'person-outline', label: 'Nombre', value: customerName });
        data.push({ type: 'info_row', key: 'date', icon: 'calendar-outline', label: 'Fecha', value: presale.createdAt?.toDate ? presale.createdAt.toDate().toLocaleDateString('es-ES') : 'N/A' });

        // Use translated status
        data.push({ type: 'info_row', key: 'status', icon: 'information-circle-outline', label: 'Estado', value: statusLabel });

        data.push({ type: 'section_title', key: 'title_products', title: 'Productos' });
        (presale.items || []).forEach((item, index) => data.push({ type: 'item_card', key: `item-${index}`, ...item }));

        if (presale.bonuses?.length > 0) {
            data.push({ type: 'section_title', key: 'title_bonuses', title: 'Bonificaciones', color: '#007AFF' });
            presale.bonuses.forEach((bonus, index) => data.push({ type: 'item_card', key: `bonus-${index}`, ...bonus, isBonus: true }));
        }

        return data;
    }, [presale]);

    const renderItem = useCallback(({ item }) => {
        switch (item.type) {
            case 'section_title': return <SectionTitle title={item.title} color={item.color} />;
            case 'info_row': return <InfoRow label={item.label} value={item.value} icon={item.icon} />;
            case 'item_card': return <ItemCard item={item} isBonus={item.isBonus} />;
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
