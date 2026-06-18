import React, { useContext, useState, useMemo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Modal } from 'react-native';
import auth from '@react-native-firebase/auth';
import { PreSaleContext } from './context/preSaleContext';
import Icon from 'react-native-vector-icons/Ionicons';
import PreSaleCard from './components/PreSaleCard';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import globalStyles from '../../styles/globalStyles';
import { resolveCustomerName } from '../../utils/customerUtils';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { format, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAdaptiveBottom } from '../../hooks/useAdaptiveBottom';

const TABS = ['Pendientes', 'Crédito', 'Pagadas'];

const formatCurrency = (value) => `C$${(Number(value) || 0).toFixed(2)}`;
const formatDateShort = (date) => format(date, 'dd MMM yyyy', { locale: es });

function SummaryCards({ data }) {
    const totalAmount = data.reduce((sum, p) => sum + (Number(p.total) || 0), 0);
    const totalItems = data.reduce((sum, p) => sum + (p.items?.length || 0), 0);
    const cashCount = data.filter(p => p.paymentMethod === 'cash' || (!p.paymentMethod && p.status === 'pending')).length;
    const creditCount = data.filter(p => p.paymentMethod === 'credit' || p.status === 'credit_pending').length;

    return (
        <View style={summaryStyles.container}>
            <View style={summaryStyles.card}>
                <Icon name="receipt-outline" size={18} color="#007AFF" />
                <Text style={summaryStyles.cardValue}>{data.length}</Text>
                <Text style={summaryStyles.cardLabel}>Ventas</Text>
            </View>
            <View style={summaryStyles.card}>
                <Icon name="cash-outline" size={18} color="#34C759" />
                <Text style={[summaryStyles.cardValue, { color: '#34C759' }]}>{formatCurrency(totalAmount)}</Text>
                <Text style={summaryStyles.cardLabel}>Total</Text>
            </View>
        </View>
    );
}

const summaryStyles = StyleSheet.create({
    container: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, marginBottom: 4, gap: 8 },
    card: { flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center', borderWidth: 1, borderColor: '#F0F0F0' },
    cardValue: { fontSize: 15, fontWeight: '800', color: '#111', marginTop: 4 },
    cardLabel: { fontSize: 10, color: '#888', fontWeight: '600', marginTop: 2 },
});

export default function PreSaleListScreen({ navigation }) {
    const { preSales, loadPreSales, loading, customersById } = useContext(PreSaleContext);
    const route = useRoute();
    const [activeTab, setActiveTab] = useState(TABS[0]);
    const { bottomPadding } = useAdaptiveBottom();
    const role = route?.params?.role || 'vendedor';
    const currentEmail = route?.params?.user?.email || auth().currentUser?.email || '';
    const isAdmin = role === 'admin';

    // --- Date filter state ---
    const [dateFrom, setDateFrom] = useState(null);
    const [dateTo, setDateTo] = useState(null);
    const [pickerTarget, setPickerTarget] = useState(null); // 'from' | 'to'
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    const hasDateFilter = dateFrom || dateTo;

    const clearDateFilter = () => { setDateFrom(null); setDateTo(null); };

    const openDatePicker = (target) => {
        setPickerTarget(target);
        setShowDatePicker(true);
    };

    const handleDateConfirm = (date) => {
        if (pickerTarget === 'from') setDateFrom(date);
        else setDateTo(date);
        setShowDatePicker(false);
    };

    useFocusEffect(
        React.useCallback(() => {
            // Data loads via real-time listener in context — no manual fetch needed
        }, [])
    );

    const filteredData = useMemo(() => {
        let data;
        if (activeTab === 'Pendientes') data = preSales.filter(p => p.status === 'pending');
        else if (activeTab === 'Crédito') data = preSales.filter(p => p.status === 'credit_pending' || p.paymentMethod === 'credit');
        else if (activeTab === 'Pagadas') data = preSales.filter(p => p.status === 'paid');
        else data = [];

        if (!isAdmin) {
            const mine = normalizeKey(currentEmail);
            data = data.filter((p) => normalizeKey(p.createdBy) === mine);
        }

        // Apply date filter
        if (dateFrom || dateTo) {
            data = data.filter(p => {
                const pDate = p.createdAt?.toDate ? p.createdAt.toDate() : (p.createdAt ? new Date(p.createdAt) : null);
                if (!pDate) return false;
                if (dateFrom && pDate < startOfDay(dateFrom)) return false;
                if (dateTo && pDate > endOfDay(dateTo)) return false;
                return true;
            });
        }

        return data;
    }, [preSales, activeTab, dateFrom, dateTo, isAdmin, currentEmail]);

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
                <TouchableOpacity onPress={() => setShowMenu(!showMenu)}>
                    <Icon name="ellipsis-vertical" size={24} color="#FFF" />
                </TouchableOpacity>
            </View>

            {/* Dropdown menu */}
            {showMenu && (
                <View style={menuStyles.overlay}>
                    <TouchableOpacity style={menuStyles.backdrop} activeOpacity={1} onPress={() => setShowMenu(false)} />
                    <View style={menuStyles.menu}>
                        <TouchableOpacity style={menuStyles.menuItem} onPress={() => { setShowMenu(false); setShowFilterModal(true); }}>
                            <Icon name="calendar-outline" size={18} color="#333" />
                            <Text style={menuStyles.menuText}>Filtrar por fecha</Text>
                            {hasDateFilter && <View style={filterStyles.activeDot} />}
                        </TouchableOpacity>
                        <TouchableOpacity style={menuStyles.menuItem} onPress={() => { setShowMenu(false); clearDateFilter(); }}>
                            <Icon name="refresh-outline" size={18} color="#333" />
                            <Text style={menuStyles.menuText}>Limpiar filtros</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Date filter chip */}
            {hasDateFilter && (
                <View style={filterStyles.chipRow}>
                    <View style={filterStyles.chip}>
                        <Icon name="calendar" size={14} color="#007AFF" />
                        <Text style={filterStyles.chipText}>
                            {dateFrom ? formatDateShort(dateFrom) : '...'} — {dateTo ? formatDateShort(dateTo) : '...'}
                        </Text>
                        <TouchableOpacity onPress={clearDateFilter} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Icon name="close-circle" size={16} color="#999" />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

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
                    <SummaryCards data={filteredData} />
                        <FlatList
                            data={filteredData}
                            renderItem={({ item }) => (
                                <TouchableOpacity onPress={() => navigation.navigate('PreSaleDetail', { presale: item, role })}>
                                     <PreSaleCard presale={item} customerName={resolveCustomerName(item, customersById)} />
                                 </TouchableOpacity>
                            )}
                            keyExtractor={item => item.id}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={renderEmptyComponent}
                        />
                </>
            )}

            {/* Date Range Filter Modal */}
            <Modal visible={showFilterModal} transparent animationType="slide" onRequestClose={() => setShowFilterModal(false)}>
                <TouchableOpacity style={filterStyles.overlay} activeOpacity={1} onPress={() => setShowFilterModal(false)}>
                    <TouchableOpacity style={filterStyles.modal} activeOpacity={1} onPress={() => {}}>
                        <Text style={filterStyles.modalTitle}>Filtrar por Fecha</Text>

                        <Text style={filterStyles.label}>Desde</Text>
                        <TouchableOpacity style={filterStyles.dateBtn} onPress={() => openDatePicker('from')}>
                            <Icon name="calendar-outline" size={18} color="#007AFF" />
                            <Text style={filterStyles.dateBtnText}>{dateFrom ? formatDateShort(dateFrom) : 'Seleccionar fecha inicio'}</Text>
                        </TouchableOpacity>

                        <Text style={filterStyles.label}>Hasta</Text>
                        <TouchableOpacity style={filterStyles.dateBtn} onPress={() => openDatePicker('to')}>
                            <Icon name="calendar-outline" size={18} color="#007AFF" />
                            <Text style={filterStyles.dateBtnText}>{dateTo ? formatDateShort(dateTo) : 'Seleccionar fecha fin'}</Text>
                        </TouchableOpacity>

                        <View style={filterStyles.modalActions}>
                            <TouchableOpacity style={filterStyles.clearBtn} onPress={() => { clearDateFilter(); setShowFilterModal(false); }}>
                                <Text style={filterStyles.clearBtnText}>Limpiar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={filterStyles.applyBtn} onPress={() => setShowFilterModal(false)}>
                                <Text style={filterStyles.applyBtnText}>Aplicar</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            <DateTimePickerModal
                isVisible={showDatePicker}
                mode="date"
                locale="es"
                date={pickerTarget === 'from' ? (dateFrom || new Date()) : (dateTo || new Date())}
                onConfirm={handleDateConfirm}
                onCancel={() => setShowDatePicker(false)}
                maximumDate={new Date()}
            />

            <TouchableOpacity style={[styles.fab, { bottom: bottomPadding + 14 }]} onPress={() => navigation.navigate('PreSaleProducts')}>
                <Icon name="add" size={30} color="#fff" />
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const menuStyles = StyleSheet.create({
    overlay: { position: 'absolute', top: 0, right: 0, left: 0, bottom: 0, zIndex: 100 },
    backdrop: { position: 'absolute', top: 0, right: 0, left: 0, bottom: 0 },
    menu: { position: 'absolute', top: 52, right: 16, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 6, minWidth: 200, elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
    menuText: { fontSize: 14, color: '#333', fontWeight: '500' },
});

const filterStyles = StyleSheet.create({
    activeDot: { position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30' },
    chipRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 8, marginBottom: 4 },
    chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EBF5FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
    chipText: { fontSize: 12, color: '#007AFF', fontWeight: '600' },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
    modal: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, paddingBottom: 30 },
    modalTitle: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 20 },
    label: { fontSize: 13, color: '#666', fontWeight: '600', textTransform: 'uppercase', marginBottom: 6 },
    dateBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F6FA', borderRadius: 10, padding: 14, marginBottom: 16, gap: 10, borderWidth: 1, borderColor: '#F0F0F0' },
    dateBtnText: { fontSize: 15, color: '#333' },
    modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
    clearBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: '#DDD', alignItems: 'center' },
    clearBtnText: { fontSize: 15, color: '#666', fontWeight: '600' },
    applyBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#007AFF', alignItems: 'center' },
    applyBtnText: { fontSize: 15, color: '#fff', fontWeight: '700' },
});

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

const normalizeKey = (value) => String(value || '').trim().toLowerCase();
