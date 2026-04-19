import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, ActivityIndicator, SafeAreaView, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import globalStyles from '../../styles/globalStyles';
import packageJson from '../../../../../package.json';
import {
    checkForUpdates,
    startUpdate,
    isNotSupportedError,
} from './updates';

export default function SettingsScreen({ navigation }) {
    const [checkingUpdate, setCheckingUpdate] = useState(false);
    const [remoteVersion, setRemoteVersion] = useState<string | null>(null);
    const [updatesSupported, setUpdatesSupported] = useState(true);
    const [updateSource, setUpdateSource] = useState<string | null>(null);

    const syncUpdateState = async () => {
        try {
            const result = await checkForUpdates({ localVersion: packageJson.version });
            setUpdatesSupported(result.updatesSupported);
            setRemoteVersion(result.remoteVersion || packageJson.version);
            setUpdateSource(result.source || null);
            return result;
        } catch (error) {
            if (isNotSupportedError(error)) {
                setUpdatesSupported(false);
            }
            setRemoteVersion(packageJson.version);
            throw error;
        }
    };

    // Verificar versión remota al montar el componente
    useEffect(() => {
        const fetchRemoteVersion = async () => {
            try {
                await syncUpdateState();
            } catch (error) {
                console.log('Error fetching remote version:', error);
            }
        };

        fetchRemoteVersion();
    }, []);

    const handleCheckUpdate = async () => {
        setCheckingUpdate(true);
        try {
            const result = await syncUpdateState();

            if (!result.updatesSupported) {
                Alert.alert('Aviso', 'La verificacion de actualizaciones no esta disponible en este entorno.');
                return;
            }

            if (result.source === 'app-distribution' && !result.isTester) {
                Alert.alert('Sin acceso', 'El perfil actual no esta habilitado como tester para actualizaciones en Firebase App Distribution.');
                return;
            }

            if (result.hasUpdate) {
                const sourceLabel = result.source === 'play-store' ? 'Google Play' : 'App Distribution';
                Alert.alert(
                    'Nueva Actualizacion Disponible',
                    `Version ${result.remoteVersion} disponible via ${sourceLabel}.\nDeseas actualizar ahora?`,
                    [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                            text: 'Actualizar',
                            onPress: async () => {
                                try {
                                    await startUpdate(result);
                                } catch (err) {
                                    Alert.alert('Error', 'No se pudo iniciar la actualizacion.');
                                    console.error('Update error:', err);
                                }
                            },
                        },
                    ]
                );
            } else {
                Alert.alert('Sin nueva version', 'Ya tienes la version mas reciente.');
                setRemoteVersion(packageJson.version);
            }
        } catch (error) {
            console.error('Check update error:', error);
            if (isNotSupportedError(error)) {
                setUpdatesSupported(false);
                Alert.alert('Aviso', 'La verificacion de actualizaciones no esta disponible en este entorno.');
            } else {
                Alert.alert('Aviso', 'No se pudo verificar la actualizacion.');
            }
        } finally {
            setCheckingUpdate(false);
        }
    };

    const getUpdateSourceLabel = () => {
        if (!updatesSupported) return 'No disponible en este entorno';
        if (updateSource === 'play-store') return 'Actualizaciones via Google Play';
        if (updateSource === 'app-distribution') return 'Actualizaciones via App Distribution (tester)';
        return 'Buscar nueva version';
    };

    const renderSettingItem = (title, icon, onPress, description = '') => (
        <TouchableOpacity style={styles.settingItem} onPress={onPress}>
            <View style={styles.iconContainer}>
                <Icon name={icon} size={24} color="#007AFF" />
            </View>
            <View style={styles.textContainer}>
                <Text style={styles.itemTitle}>{title}</Text>
                {description ? <Text style={styles.itemDescription}>{description}</Text> : null}
            </View>
            <Icon name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={globalStyles.container}>
            <View style={globalStyles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="chevron-back" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={globalStyles.title}>Configuración</Text>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                <Text style={styles.sectionHeader}>Dispositivos</Text>
                {renderSettingItem(
                    'Impresoras Bluetooth',
                    'print-outline',
                    () => navigation.navigate('PrintersScreen'),
                    'Configurar impresoras térmicas'
                )}

                {renderSettingItem(
                    'Personalizacion de ticket',
                    'receipt-outline',
                    () => navigation.navigate('TicketCustomizationScreen'),
                    'Imagen, tipografia y tamano de impresion'
                )}

                <Text style={styles.sectionHeader}>Sistema</Text>
                <TouchableOpacity style={styles.settingItem} onPress={handleCheckUpdate} disabled={checkingUpdate || !updatesSupported}>
                    <View style={styles.iconContainer}>
                        {checkingUpdate ? (
                            <ActivityIndicator size="small" color="#007AFF" />
                        ) : (
                            <Icon name="cloud-download-outline" size={24} color="#007AFF" />
                        )}
                    </View>
                    <View style={styles.textContainer}>
                        <Text style={styles.itemTitle}>Buscar Actualizaciones</Text>
                        <Text style={styles.itemDescription}>
                            {checkingUpdate
                              ? 'Verificando...'
                              : getUpdateSourceLabel()}
                        </Text>
                    </View>
                    {!checkingUpdate && updatesSupported && <Icon name="chevron-forward" size={20} color="#C7C7CC" />}
                </TouchableOpacity>

                <View style={styles.versionContainer}>
                    <Text style={styles.versionText}>Version local: {packageJson.version}</Text>
                    {remoteVersion && remoteVersion !== packageJson.version && (
                        <Text style={[styles.versionText, { color: '#007AFF', fontWeight: 'bold', marginTop: 4 }]}>
                            Nueva Version Disponible: {remoteVersion}
                        </Text>
                    )}
                    {updatesSupported && remoteVersion && remoteVersion === packageJson.version && (
                        <Text style={[styles.versionText, { color: '#34C759', marginTop: 4, fontSize: 12 }]}>
                            (Ya tienes la version mas reciente)
                        </Text>
                    )}
                    {!updatesSupported && (
                        <Text style={[styles.versionText, { color: '#999', marginTop: 4, fontSize: 12 }]}>
                            (Actualizaciones no disponibles en este entorno)
                        </Text>
                    )}
                    <Text style={styles.copyrightText}>© 2025 DIALIFGH</Text>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    content: {
        padding: 16,
    },
    sectionHeader: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginTop: 20,
        marginBottom: 8,
        marginLeft: 4,
        textTransform: 'uppercase',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 12,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F0F8FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    textContainer: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    itemDescription: {
        fontSize: 13,
        color: '#888',
        marginTop: 2,
    },
    versionContainer: {
        marginTop: 40,
        alignItems: 'center',
    },
    versionText: {
        fontSize: 14,
        color: '#999',
        fontWeight: '500',
    },
    copyrightText: {
        fontSize: 12,
        color: '#CCC',
        marginTop: 4,
    },
});
