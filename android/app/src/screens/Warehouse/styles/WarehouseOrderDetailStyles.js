import { StyleSheet } from 'react-native';

export default StyleSheet.create({
    listContainer: { paddingHorizontal: 12, paddingBottom: 20, backgroundColor: '#F5F6FA' },
    sectionHeader: { paddingTop: 14, paddingBottom: 8 },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: '#333', textTransform: 'uppercase', letterSpacing: 0.3 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, backgroundColor: 'white', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#F1F2F6' },
    label: { fontSize: 12, color: '#666', fontWeight: '600' },
    value: { fontSize: 13, fontWeight: '600', color: '#333' },

    summaryCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginTop: 10, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    summaryName: { fontSize: 16, fontWeight: '700', color: '#1F2937', flex: 1, marginRight: 8 },
    summaryMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
    summaryMeta: { fontSize: 11, color: '#6B7280' },
    summaryTotal: { fontSize: 18, fontWeight: '800', color: '#007AFF' },

    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
    statusBadgeText: { fontSize: 11, fontWeight: '700' },
    creditBadge: { backgroundColor: '#1F2937', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
    creditBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

    itemCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginVertical: 4 },
    bonusItemCard: { backgroundColor: '#EAF3FF' },
    itemInfo: { flex: 1 },
    itemName: { fontSize: 13, fontWeight: '700', color: '#333' },
    itemDetails: { fontSize: 11, color: '#6B7280', marginTop: 2 },
    itemRight: { alignItems: 'flex-end', marginLeft: 10 },
    itemTotal: { fontSize: 12, fontWeight: '700', color: '#111827' },
    bonusTag: { backgroundColor: '#007AFF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 2 },
    bonusTagText: { color: '#fff', fontSize: 10, fontWeight: '700' },

    financialSection: { backgroundColor: 'white', borderRadius: 12, elevation: 1, marginVertical: 10 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 8, borderTopWidth: 1, borderTopColor: '#F0F0F0', padding: 16 },
    totalLabel: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    totalValue: { fontSize: 18, fontWeight: 'bold', color: '#007AFF' },
    footer: { padding: 12, borderTopWidth: 1, borderTopColor: '#EEE', backgroundColor: '#FFF' },
    actionButton: { flexDirection: 'row', backgroundColor: '#5856D6', paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    buttonText: { color: 'white', fontWeight: '700', fontSize: 14 },

    // Modal Styles
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    pickerContent: { width: '90%', maxHeight: '75%', backgroundColor: 'white', padding: 16, borderRadius: 14, alignItems: 'center', elevation: 5 },
    modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, color: '#333' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 10, height: 40, width: '100%', marginBottom: 10 },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#333' },
    entregadorItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#F1F2F6', width: '100%', justifyContent: 'space-between' },
    avatarContainer: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    entregadorText: { fontSize: 13, color: '#333', flex: 1 },
    emptyListText: { textAlign: 'center', color: '#999', marginVertical: 16, fontSize: 12 },
    closeButton: { backgroundColor: '#FF3B30', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, width: '100%', alignItems: 'center' },
});
