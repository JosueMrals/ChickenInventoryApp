import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

export default function RouteEditPanel({ visible, route, onClose, onSave }) {
    const [name, setName] = useState('');
    const [startLocation, setStartLocation] = useState('');
    const [endLocation, setEndLocation] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (route) {
            setName(route.name || '');
            setStartLocation(route.start || '');
            setEndLocation(route.end || '');
        } else {
            setName('');
            setStartLocation('');
            setEndLocation('');
        }
    }, [route, visible]);

    const handleSave = async () => {
        if (!name.trim() || !startLocation.trim() || !endLocation.trim()) return;

        setLoading(true);
        try {
            await onSave({ ...route, name, start: startLocation, end: endLocation });
            onClose();
        } catch (error) {
            console.error("Error saving route", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.modalOverlay}
            >
                <View style={styles.panel}>
                    <View style={styles.header}>
                        <View style={styles.headerTitleContainer}>
                            <Icon name="create-outline" size={22} color="#E91E63" />
                            <Text style={styles.title}>Editar Ruta</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Icon name="close" size={24} color="#666" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.body}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Nombre de la Ruta</Text>
                            <TextInput
                                style={styles.input}
                                value={name}
                                onChangeText={setName}
                                placeholder="Nombre de la ruta"
                            />
                        </View>

                        <View style={styles.locationGroup}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Inicio</Text>
                                <View style={styles.inputWithIcon}>
                                    <Icon name="navigate-circle-outline" size={20} color="#4CAF50" style={styles.inputIcon} />
                                    <TextInput
                                        style={[styles.input, { flex: 1, borderLeftWidth: 0, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }]}
                                        value={startLocation}
                                        onChangeText={setStartLocation}
                                        placeholder="Ubicación inicial"
                                    />
                                </View>
                            </View>

                            <View style={styles.connectorLine} />

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Fin</Text>
                                <View style={styles.inputWithIcon}>
                                    <Icon name="flag-outline" size={20} color="#F44336" style={styles.inputIcon} />
                                    <TextInput
                                        style={[styles.input, { flex: 1, borderLeftWidth: 0, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }]}
                                        value={endLocation}
                                        onChangeText={setEndLocation}
                                        placeholder="Ubicación final"
                                    />
                                </View>
                            </View>
                        </View>
                    </View>

                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={loading}>
                            <Text style={styles.cancelButtonText}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
                            {loading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.saveButtonText}>Guardar Cambios</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    panel: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginLeft: 8,
    },
    closeButton: {
        padding: 4,
    },
    body: {
        marginBottom: 20,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: '#666',
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    input: {
        backgroundColor: '#F5F6FA',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
        padding: 10,
        fontSize: 15,
        color: '#333',
    },
    inputWithIcon: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F6FA',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
    },
    inputIcon: {
        padding: 10,
    },
    locationGroup: {
        marginTop: 4,
    },
    connectorLine: {
        height: 16,
        borderLeftWidth: 2,
        borderLeftColor: '#DDD',
        borderStyle: 'dashed',
        marginLeft: 19,
        marginTop: -12,
        marginBottom: 4,
        zIndex: -1,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    cancelButton: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: '#F5F5F5',
    },
    cancelButtonText: {
        color: '#666',
        fontWeight: '600',
    },
    saveButton: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        backgroundColor: '#E91E63',
        minWidth: 100,
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});
