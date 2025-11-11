import { StyleSheet } from 'react-native';

export default StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modal: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        elevation: 5,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 10,
    },
    subtitle: {
        textAlign: 'center',
        color: '#666',
        marginBottom: 12,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 10,
        marginBottom: 10,
    },
        customerItem: {
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderColor: '#eee',
    },
    customerName: { fontWeight: '600' },
    customerInfo: { fontSize: 12, color: '#777' },
    selectedCustomerCard: {
        backgroundColor: '#E8F0FE',
        padding: 10,
        borderRadius: 8,
        marginBottom: 10,
    },
    selectedCustomerName: {
        fontWeight: '700',
        color: '#007AFF',
    },
    selectedCustomerId: {
        color: '#555',
        fontSize: 12,
    },
    searchResultContainer: {
        maxHeight: 150,
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 8,
        marginTop: 4,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    btn: {
        flex: 1,
        borderRadius: 8,
        paddingVertical: 10,
        alignItems: 'center',
        marginHorizontal: 4,
    },
    discountRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 6,
    },
    discountBtn: {
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 8,
    },
    totalBox: {
        marginTop: 10,
        backgroundColor: '#F1F6FF',
        borderRadius: 10,
        padding: 10,
    },
    totalText: {
        color: '#555',
        fontSize: 14,
    },
    totalMain: {
        fontWeight: '700',
        fontSize: 16,
        color: '#007AFF',
        textAlign: 'center',
        marginTop: 4,
    },
    paymentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    paymentBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 4,
        paddingVertical: 10,
        borderRadius: 10,
        flexBasis: 0,
    },

    btnPrimary: { backgroundColor: '#007AFF' },
    btnCancel: { backgroundColor: '#FF3B30' },
    btnText: { color: '#fff', fontWeight: '600' },
});
