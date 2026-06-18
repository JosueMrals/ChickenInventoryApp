import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, SafeAreaView, Modal, TextInput, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import globalStyles from '../../styles/globalStyles';
import { PreSaleContext } from './context/preSaleContext';
import { getPreSaleHistory } from '../../services/preSaleService';
import HistoryDetailModal from './components/HistoryDetailModal';
import { useRoute as useRouteContext } from '../../context/RouteContext'; // Rename to avoid conflict with navigation route
import { resolveCustomerName } from '../../utils/customerUtils';
import { createReturnRequest, subscribeReturnRequestsByPresale } from '../../services/returnService';

const formatCurrency = (value) => `$${(Number(value) || 0).toFixed(2)}`;

function formatCategoryRule(item) {
    const minQty = Number(item?.categoryDiscountMinQty || 0);
    const type = String(item?.categoryDiscountType || '').toLowerCase();
    const value = Number(item?.categoryDiscountValue || 0);
    if (!minQty || !value || !['percent', 'amount'].includes(type)) return null;
    const valueText = type === 'percent' ? `${value}%` : formatCurrency(value);
    return `${minQty}+ -> ${valueText}`;
}

const CompactChip = React.memo(({ text, tone = 'neutral' }) => (
    <View style={[styles.compactChip, tone === 'category' && styles.compactChipCategory, tone === 'manual' && styles.compactChipManual]}>
        <Text style={[styles.compactChipText, tone === 'category' && styles.compactChipTextCategory, tone === 'manual' && styles.compactChipTextManual]}>{text}</Text>
    </View>
));

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

const ItemCard = React.memo(({ item, isBonus = false }) => {
    const categoryRuleText = formatCategoryRule(item);
    const hasManualDiscount = Number(item?.discount || 0) > 0;
    const bonusRuleIndex = Number(item?.bonusRuleIndex || 0);

    return (
        <View style={[styles.itemCard, isBonus && styles.bonusItemCard]}>
            <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.productName}</Text>
                <Text style={styles.itemDetails}>
                    {isBonus ? `${item.quantity} x GRATIS` : `${item.quantity} x ${formatCurrency(item.unitPrice)}`}
                </Text>

{/*                 {isBonus && bonusRuleIndex > 0 ? ( */}
{/*                     <Text style={styles.bonusRuleMeta}>Regla #{bonusRuleIndex}</Text> */}
{/*                 ) : null} */}

                {!isBonus && (
                    <View style={styles.compactChipRow}>
                        {item.pricingSource === 'category' && categoryRuleText ? (
                            <CompactChip text={`Categoria ${categoryRuleText}`} tone="category" />
                        ) : null}
                        {item.pricingSource === 'wholesale' ? (
                            <CompactChip text="Mayorista" />
                        ) : null}
                        {item.pricingSource === 'customer' ? (
                            <CompactChip text="Descuento cliente" />
                        ) : null}
                        {hasManualDiscount ? (
                            <CompactChip text="Descuento manual" tone="manual" />
                        ) : null}
                    </View>
                )}
            </View>
            {isBonus && (
                <View style={styles.bonusTag}><Text style={styles.bonusTagText}>REGALO</Text></View>
            )}
        </View>
    );
});

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

const FinancialSummary = React.memo(({ presale, categoryDiscountTotal = 0 }) => (
    <View style={styles.financialSection}>
        <InfoRow label="Subtotal" value={formatCurrency(presale.subtotal)} />
        <InfoRow label="Descuentos" value={`-${formatCurrency(presale.totalDiscount)}`} />
        {categoryDiscountTotal > 0 ? (
            <InfoRow label="Desc. categoria" value={`-${formatCurrency(categoryDiscountTotal)}`} />
        ) : null}
        <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(presale.total)}</Text>
        </View>
    </View>
));

export default function PreSaleDetailScreen({ route, navigation }) {
    const { presale } = route.params;
    const { loadPreSaleForEditing, customersById, deletePreSale } = useContext(PreSaleContext);
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [historyModalVisible, setHistoryModalVisible] = useState(false);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [deleteReason, setDeleteReason] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    // Devolución
    const [returnModalVisible, setReturnModalVisible] = useState(false);
    const [returnReason, setReturnReason] = useState('');
    const [submittingReturn, setSubmittingReturn] = useState(false);
    const [existingReturnRequest, setExistingReturnRequest] = useState(null);

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

    // Escuchar solicitudes de devolución activas para esta venta
    useEffect(() => {
        if (presale.status !== 'paid') return;
        const unsub = subscribeReturnRequestsByPresale(presale.id, (docs) => {
            const active = docs.find((d) => d.status === 'pending_review' || d.status === 'approved');
            setExistingReturnRequest(active || null);
        });
        return () => unsub();
    }, [presale.id, presale.status]);

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

    const openDeleteModal = useCallback(() => {
        setDeleteReason('');
        setDeleteModalVisible(true);
    }, []);

    const closeDeleteModal = useCallback(() => {
        if (isDeleting) return;
        setDeleteModalVisible(false);
    }, [isDeleting]);

    const handleDelete = useCallback(async () => {
        const reason = deleteReason.trim();
        if (!reason) {
            Alert.alert('Descripción requerida', 'Debe ingresar una descripción para eliminar la pre-venta.');
            return;
        }

        setIsDeleting(true);
        try {
            await deletePreSale({ preSaleId: presale.id, reason });
            setDeleteModalVisible(false);
            Alert.alert('Pre-venta eliminada', 'La pre-venta fue eliminada y el inventario fue restaurado.');
            navigation.navigate('PreSalesList');
        } catch (error) {
            Alert.alert('No se pudo eliminar', error?.message || 'Ocurrió un error al eliminar la pre-venta.');
        } finally {
            setIsDeleting(false);
        }
    }, [deleteReason, deletePreSale, navigation, presale.id]);

    const categoryDiscountTotal = useMemo(() => {
        if (Number(presale?.categoryDiscountTotal || 0) > 0) {
            return Number(presale.categoryDiscountTotal);
        }

        const items = Array.isArray(presale?.items) ? presale.items : [];
        const byCategory = items.reduce((acc, item) => {
            if (item?.pricingSource !== 'category') return acc;
            const key = String(item?.category || item?.categoryName || 'sin_categoria').toLowerCase();
            acc[key] = (acc[key] || 0) + Number(item?.autoDiscountTotal || 0);
            return acc;
        }, {});

        return Object.values(byCategory).reduce((sum, value) => sum + Number((Number(value) || 0).toFixed(2)), 0);
    }, [presale]);

    const listData = useMemo(() => {
        const data = [];
        const customerName = resolveCustomerName(presale, customersById);
        const totalItems = (presale.items || []).length;
        const totalBonuses = (presale.bonuses || []).length;

        data.push({ type: 'section_title', key: 'title_customer', title: 'Cliente' });
        data.push({ type: 'info_row', key: 'customer_name', icon: 'person-outline', label: 'Nombre', value: customerName });
        data.push({ type: 'info_row', key: 'date', icon: 'calendar-outline', label: 'Fecha', value: presale.createdAt?.toDate ? presale.createdAt.toDate().toLocaleDateString('es-ES') : 'N/A' });
        data.push({ type: 'info_row', key: 'status', icon: 'flag-outline', label: 'Estado', value: String(presale.status || 'N/A').toUpperCase() });
        data.push({
            type: 'info_row',
            key: 'payment_method',
            icon: 'card-outline',
            label: 'Tipo',
            value: presale.paymentMethod === 'credit' || presale.status === 'credit_pending' ? 'Crédito' : 'Contado',
        });

        // Mostrar Ruta si existe
        if (presale.route) {
             data.push({ type: 'info_row', key: 'route_info', icon: 'location-outline', label: 'Ruta', value: presale.route.name });
        }

        data.push({ type: 'info_row', key: 'items_count', icon: 'list-outline', label: 'Items', value: `${totalItems}` });
        if (totalBonuses > 0) {
            data.push({ type: 'info_row', key: 'bonuses_count', icon: 'gift-outline', label: 'Bonificados', value: `${totalBonuses}` });
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
    }, [presale, history, loadingHistory, customersById, categoryDiscountTotal]);

    const renderItem = useCallback(({ item }) => {
        switch (item.type) {
            case 'section_title': return <SectionTitle title={item.title} color={item.color} />;
            case 'info_row': return <InfoRow label={item.label} value={item.value} icon={item.icon} />;
            case 'item_card': return <ItemCard item={item} isBonus={item.isBonus} />;
            case 'financial_summary': return <FinancialSummary presale={presale} categoryDiscountTotal={categoryDiscountTotal} />;
            case 'history_item': return <HistoryItem item={item} onPress={openHistoryModal} />;
            case 'loader': return <ActivityIndicator style={{ margin: 20 }} />;
            default: return null;
        }
    }, [openHistoryModal, presale, categoryDiscountTotal]);

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
    const canDelete = presale.status === 'pending' || presale.status === 'credit_pending';
    const isPaid = presale.status === 'paid' || presale.status === 'returned';

    const handleOpenReturnModal = useCallback(() => {
        setReturnReason('');
        setReturnModalVisible(true);
    }, []);

    const handleSubmitReturn = useCallback(async () => {
        if (!returnReason.trim()) {
            Alert.alert('Campo requerido', 'Debes ingresar una razón detallada para la devolución.');
            return;
        }
        try {
            setSubmittingReturn(true);
            await createReturnRequest({
                presaleId: presale.id,
                sale: {
                    ...presale,
                    customerName: resolveCustomerName(presale, customersById),
                },
                reason: returnReason.trim(),
                requestedByRole: userRole === 'admin' ? 'admin' : 'vendedor',
            });
            setReturnModalVisible(false);
            Alert.alert('Solicitud enviada', 'La solicitud fue enviada a bodega para verificación.');
        } catch (e) {
            Alert.alert('Error', e.message || 'No se pudo enviar la solicitud.');
        } finally {
            setSubmittingReturn(false);
        }
    }, [returnReason, presale, customersById, userRole]);

    return (
        <SafeAreaView style={globalStyles.container}>
            <View style={globalStyles.header}>
                <TouchableOpacity onPress={() => navigation.navigate('PreSalesList')}><Icon name="chevron-back" size={28} color="#FFF" /></TouchableOpacity>
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

			{(presale.status === 'pending' || presale.status === 'credit_pending') && (
				<View style={styles.footer}>
					<TouchableOpacity style={[styles.editButton, { flex: 1, flexDirection: 'row', width: 'auto' }]} onPress={handleEdit} disabled={isEditing}>
						{isEditing ? <ActivityIndicator color="#007AFF" /> : (
                                <>
                                    <Icon name="create-outline" size={22} color="#007AFF" style={{ marginRight: 8 }}/>
                                    <Text style={{ color: '#007AFF', fontSize: 16, fontWeight: '600' }}>Editar Pedido</Text>
                                </>
                            )}
					</TouchableOpacity>

                        {canDelete && (
                            <TouchableOpacity style={styles.deleteButton} onPress={openDeleteModal}>
                                <Icon name="trash-outline" size={20} color="#D92D20" style={{ marginRight: 6 }} />
                                <Text style={styles.deleteButtonText}>Eliminar</Text>
                            </TouchableOpacity>
                        )}

                        {showPayButton && (
                            <TouchableOpacity style={styles.payButton} onPress={() => navigation.navigate('PreSalePayment', { presale })}>
                                <Icon name="cash-outline" size={22} color="#fff" style={{marginRight: 10}}/>
                                <Text style={styles.payButtonText}>Cobrar</Text>
                            </TouchableOpacity>
                        )}
				</View>
			)}

            {/* Botón de devolución para ventas pagadas */}
            {isPaid && (
                <View style={styles.returnFooter}>
                    {existingReturnRequest ? (
                        <View style={styles.returnStatusRow}>
                            <Icon
                                name={existingReturnRequest.status === 'approved' ? 'checkmark-circle' : 'time-outline'}
                                size={16}
                                color={existingReturnRequest.status === 'approved' ? '#16A34A' : '#B45309'}
                            />
                            <Text style={[
                                styles.returnStatusText,
                                existingReturnRequest.status === 'approved' && { color: '#16A34A' },
                            ]}>
                                {existingReturnRequest.status === 'approved'
                                    ? 'Devolución aprobada — inventario restituido'
                                    : 'Solicitud de devolución en revisión por bodega'}
                            </Text>
                        </View>
                    ) : presale.status !== 'returned' ? (
                        <TouchableOpacity style={styles.returnButton} onPress={handleOpenReturnModal}>
                            <Icon name="return-up-back-outline" size={20} color="#D92D20" style={{ marginRight: 8 }} />
                            <Text style={styles.returnButtonText}>Solicitar Devolución</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            )}
            </View>

            <Modal
                visible={deleteModalVisible}
                transparent
                animationType="fade"
                onRequestClose={closeDeleteModal}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Confirmar eliminación</Text>
                        <Text style={styles.modalText}>
                            Esta acción cancelará la pre-venta y devolverá su inventario al stock principal.
                        </Text>

                        <Text style={styles.modalLabel}>Descripción obligatoria</Text>
                        <TextInput
                            value={deleteReason}
                            onChangeText={setDeleteReason}
                            placeholder="Ejemplo: Cliente canceló el pedido"
                            placeholderTextColor="#9CA3AF"
                            style={styles.reasonInput}
                            multiline
                            numberOfLines={3}
                            editable={!isDeleting}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelButton} onPress={closeDeleteModal} disabled={isDeleting}>
                                <Text style={styles.modalCancelText}>Volver</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalDeleteButton} onPress={handleDelete} disabled={isDeleting}>
                                {isDeleting ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.modalDeleteText}>Confirmar</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal de solicitud de devolución */}
            <Modal
                visible={returnModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => !submittingReturn && setReturnModalVisible(false)}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Solicitar Devolución</Text>
                        <Text style={styles.modalText}>
                            La solicitud será revisada manualmente por bodega.
                            Los productos serán devueltos al inventario solo tras su confirmación.
                        </Text>
                        <Text style={styles.modalLabel}>Razón de devolución (obligatoria)</Text>
                        <TextInput
                            value={returnReason}
                            onChangeText={setReturnReason}
                            placeholder="Ej: Cliente devolvió el pedido por producto en mal estado..."
                            placeholderTextColor="#9CA3AF"
                            style={styles.reasonInput}
                            multiline
                            numberOfLines={4}
                            editable={!submittingReturn}
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={() => setReturnModalVisible(false)}
                                disabled={submittingReturn}>
                                <Text style={styles.modalCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalDeleteButton, { backgroundColor: '#D92D20' }]}
                                onPress={handleSubmitReturn}
                                disabled={submittingReturn}>
                                {submittingReturn
                                    ? <ActivityIndicator color="#fff" />
                                    : <Text style={styles.modalDeleteText}>Enviar</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    compactChipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 6 },
    compactChip: { backgroundColor: '#EEF2F7', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
    compactChipCategory: { backgroundColor: '#DBEAFE' },
    compactChipManual: { backgroundColor: '#FEE2E2' },
    compactChipText: { fontSize: 11, fontWeight: '700', color: '#334155' },
    compactChipTextCategory: { color: '#1D4ED8' },
    compactChipTextManual: { color: '#B91C1C' },
    bonusTag: { backgroundColor: '#007AFF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    bonusTagText: {
        color: '#007AFF',
        fontWeight: 'bold',
        fontSize: 11,
    },
    bonusRuleMeta: {
        marginTop: 2,
        fontSize: 11,
        fontWeight: '700',
        color: '#1D4ED8',
    },
    financialSection: { backgroundColor: 'white', borderRadius: 12, elevation: 1, marginVertical: 10 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 8, borderTopWidth: 1, borderTopColor: '#F0F0F0', padding: 16 },
    totalLabel: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    totalValue: { fontSize: 20, fontWeight: 'bold', color: '#007AFF' },
    footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#EEE', backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', gap: 10 },
    editButton: { borderWidth: 1, borderColor: '#007AFF', borderRadius: 12, padding: 14, justifyContent: 'center', alignItems: 'center' },
    deleteButton: { borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    deleteButtonText: { color: '#D92D20', fontSize: 15, fontWeight: '700' },
    payButton: { backgroundColor: '#28A745', flexDirection: 'row', flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, borderRadius: 12, elevation: 3 },
    payButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    historyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', backgroundColor: 'white', paddingHorizontal: 16, borderRadius: 8, marginBottom: 5 },
    historyIcon: { marginRight: 15 },
    historyDetails: { fontSize: 14, color: '#333', flexShrink: 1 },
    historyMeta: { fontSize: 12, color: '#999', marginTop: 4 },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', paddingHorizontal: 20 },
    modalCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
    modalText: { marginTop: 8, color: '#4B5563', fontSize: 14, lineHeight: 20 },
    modalLabel: { marginTop: 14, marginBottom: 6, fontSize: 13, fontWeight: '700', color: '#374151' },
    reasonInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#111827', minHeight: 84, textAlignVertical: 'top' },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14, gap: 10 },
    modalCancelButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#D1D5DB' },
    modalCancelText: { color: '#374151', fontWeight: '600' },
    modalDeleteButton: { backgroundColor: '#D92D20', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, minWidth: 96, alignItems: 'center' },
    modalDeleteText: { color: '#fff', fontWeight: '700' },
    returnFooter: {
        paddingHorizontal: 16,
        paddingBottom: 14,
        paddingTop: 6,
        backgroundColor: '#FFF',
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    returnButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FCA5A5',
        borderRadius: 12,
        paddingVertical: 14,
    },
    returnButtonText: { color: '#D92D20', fontWeight: '700', fontSize: 15 },
    returnStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 10 },
    returnStatusText: { fontSize: 13, fontWeight: '700', color: '#B45309', flexShrink: 1 },
});
