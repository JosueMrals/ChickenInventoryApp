import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import globalStyles from '../../styles/globalStyles';
import routesService from './services/routesService';

export default function AddRouteScreen({ navigation }) {
    const [name, setName] = useState('');
    const [startLocation, setStartLocation] = useState('');
    const [endLocation, setEndLocation] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!name.trim() || !startLocation.trim() || !endLocation.trim()) {
            Alert.alert('Error', 'Todos los campos son obligatorios.');
            return;
        }

        setSaving(true);
        try {
            await routesService.createRoute({
                name,
                start: startLocation,
                end: endLocation
            });

            Alert.alert('Éxito', 'Ruta creada correctamente.', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            console.error('Error creating route:', error);
            Alert.alert('Error', 'No se pudo crear la ruta. Inténtalo de nuevo.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={globalStyles.container}
        >
            <View style={globalStyles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="chevron-back" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={globalStyles.title}>Nueva Ruta</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.card}>
                    <Text style={styles.label}>Nombre de la Ruta</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Ej. Ruta Centro - Norte"
                        placeholderTextColor="#999"
                        value={name}
                        onChangeText={setName}
                    />

                    <View style={styles.divider} />

                    <View style={styles.locationContainer}>
                        <Icon name="navigate-circle-outline" size={24} color="#4CAF50" style={styles.inputIcon} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Inicio de la Ruta</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Ej. Almacén Central"
                                placeholderTextColor="#999"
                                value={startLocation}
                                onChangeText={setStartLocation}
                            />
                        </View>
                    </View>

                    <View style={styles.locationConnector} />

                    <View style={styles.locationContainer}>
                        <Icon name="flag-outline" size={24} color="#F44336" style={styles.inputIcon} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Fin de la Ruta</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Ej. Mercado Mayorista"
                                placeholderTextColor="#999"
                                value={endLocation}
                                onChangeText={setEndLocation}
                            />
                        </View>
                    </View>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Icon name="save-outline" size={24} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.saveButtonText}>Guardar Ruta</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    content: {
        padding: 16,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    input: {
        backgroundColor: '#F5F6FA',
        padding: 12,
        borderRadius: 8,
        fontSize: 16,
        color: '#333',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    divider: {
        height: 1,
        backgroundColor: '#EEE',
        marginVertical: 20,
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    inputIcon: {
        marginTop: 32,
        marginRight: 12,
    },
    locationConnector: {
        height: 30,
        borderLeftWidth: 2,
        borderLeftColor: '#DDD',
        marginLeft: 11,
        marginVertical: 4,
        borderStyle: 'dashed',
    },
    footer: {
        padding: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    },
    saveButton: {
        backgroundColor: '#E91E63',
        borderRadius: 12,
        paddingVertical: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#E91E63',
        shadowOpacity: 0.3,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 3 },
    },
    saveButtonDisabled: {
        backgroundColor: '#F8BBD0',
        elevation: 0,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
