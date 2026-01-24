import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const HistoryDetailModal = ({ visible, onClose, historyItem }) => {
    if (!historyItem) return null;

    const renderChanges = () => {
        if (typeof historyItem.details === 'string') {
            return <Text style={styles.detailText}>{historyItem.details}</Text>;
        }
        return null;
    };

    const timestamp = historyItem.timestamp?.toDate ? historyItem.timestamp.toDate().toLocaleString('es-ES') : 'N/A';

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <View style={styles.modalView}>
                    <TouchableOpacity style={styles.closeIcon} onPress={onClose}>
                        <Icon name="close-circle" size={28} color="#ccc" />
                    </TouchableOpacity>

                    <Icon
                        name={historyItem.action === 'CREATE' ? 'add-circle' : 'create'}
                        size={40}
                        color="#007AFF"
                        style={styles.headerIcon}
                    />

                    <Text style={styles.modalTitle}>Detalle del Cambio</Text>
                    
                    <View style={styles.infoContainer}>
                        <Text style={styles.infoLabel}>Realizado por:</Text>
                        <Text style={styles.infoValue}>{historyItem.user || 'Desconocido'}</Text>
                    </View>
                    <View style={styles.infoContainer}>
                        <Text style={styles.infoLabel}>Fecha:</Text>
                        <Text style={styles.infoValue}>{timestamp}</Text>
                    </View>

                    <View style={styles.detailsBox}>
                        <Text style={styles.detailsTitle}>Cambios Realizados:</Text>
                        {renderChanges()}
                    </View>

                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeButtonText}>Cerrar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    modalView: {
        width: '90%',
        backgroundColor: "white",
        borderRadius: 20,
        padding: 25,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    closeIcon: {
        position: 'absolute',
        top: 15,
        right: 15,
    },
    headerIcon: {
        marginBottom: 15,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#333',
    },
    infoContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    infoLabel: {
        fontSize: 16,
        color: '#666',
    },
    infoValue: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
    },
    detailsBox: {
        width: '100%',
        marginTop: 20,
        backgroundColor: '#f9f9f9',
        borderRadius: 8,
        padding: 15,
        borderWidth: 1,
        borderColor: '#eee'
    },
    detailsTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#333',
    },
    detailText: {
        fontSize: 15,
        color: '#555',
        lineHeight: 22,
    },
    closeButton: {
        backgroundColor: "#007AFF",
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 30,
        elevation: 2,
        marginTop: 25,
    },
    closeButtonText: {
        color: "white",
        fontWeight: "bold",
        textAlign: "center",
        fontSize: 16,
    },
});

export default HistoryDetailModal;
