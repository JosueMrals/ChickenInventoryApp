
import { StyleSheet } from 'react-native';

export default StyleSheet.create({
    refreshBtnHeader: {
        padding: 8,
        marginRight: -8 
    },
    scanBtn: {
        backgroundColor: '#fff',
        padding: 10,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 2 },
        marginTop: 10,
        marginBottom: 10,
        justifyContent: 'center',
        alignItems: 'center',
        height: 48,
        width: 48
    },
    clearIconBtn: {
        padding: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 4
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
        paddingHorizontal: 20
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#555',
        marginTop: 16,
        textAlign: 'center',
        marginBottom: 8
    },
    emptySubText: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
        marginBottom: 20
    },
    createBtn: {
        flexDirection: 'row',
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 30,
        alignItems: 'center',
        marginTop: 20,
        elevation: 3
    },
    createBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 15
    },
    clearBtn: {
        marginTop: 20,
        padding: 10
    },
    clearBtnText: {
        color: '#007AFF',
        fontSize: 15
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '85%', 
        minHeight: '50%',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#111'
    },
    closeButton: {
        padding: 4,
        backgroundColor: '#f2f2f2',
        borderRadius: 20
    },
    headerInfo: {
        marginBottom: 16,
    },
    largeName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4
    },
    largePrice: {
        fontSize: 28,
        fontWeight: '900',
        color: '#007AFF'
    },
    divider: {
        height: 1,
        backgroundColor: '#eee',
        marginBottom: 16
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f9f9f9'
    },
    detailLabel: {
        fontSize: 14,
        color: '#888',
        fontWeight: '600',
    },
    detailValue: {
        fontSize: 16,
        color: '#333',
        fontWeight: '500'
    },
    descriptionBox: {
        backgroundColor: '#F5F6FA',
        padding: 12,
        borderRadius: 12,
        marginBottom: 16
    },
    descriptionText: {
        color: '#555',
        marginTop: 6,
        lineHeight: 20
    },
    wholesaleContainer: {
        marginTop: 4,
        backgroundColor: '#E3F2FD',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20
    },
    wholesaleTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#007AFF'
    },
    wholesaleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
        paddingBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.5)'
    },
    wholesaleQty: {
        color: '#444',
        fontWeight: '500'
    },
    wholesalePrice: {
        color: '#007AFF',
        fontWeight: '800'
    },
    modalFooter: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        flexDirection: 'column',
        gap: 10
    },
    editModalBtn: {
        backgroundColor: '#007AFF',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 8
    },
    editModalBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold'
    },
    closeModalBtn: {
        backgroundColor: '#f2f2f2',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center'
    },
    closeModalBtnText: {
        color: '#333',
        fontSize: 16,
        fontWeight: '600'
    }
});
