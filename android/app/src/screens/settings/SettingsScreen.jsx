import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, ActivityIndicator, SafeAreaView, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import appDistribution from '@react-native-firebase/app-distribution';
import globalStyles from '../../styles/globalStyles';
import packageJson from '../../../../../package.json';

export default function SettingsScreen({ navigation }) {
    const [checkingUpdate, setCheckingUpdate] = useState(false);
    const [remoteVersion, setRemoteVersion] = useState(null);

    // Verificar versión remota al montar el componente
    useEffect(() => {
        const fetchRemoteVersion = async () => {
            try {
                // checkForUpdate devuelve una Release si hay una NUEVA versión disponible.
                // Si devuelve null, significa que estamos en la última versión.
                const release = await appDistribution().checkForUpdate();
                if (release) {
                    setRemoteVersion(release.displayVersion);
                } else {
                    // Si no hay actualización, la versión remota es igual a la actual (o estamos al día)
                    setRemoteVersion(packageJson.version);
                }
            } catch (error) {
                // Suppress specific "not supported" error in console to avoid clutter during dev
                if (error.message && error.message.includes("not supported")) {
                    console.log('App Distribution not supported in this environment (Simulator/Dev).');
                } else {
                    console.log('Error fetching remote version:', error);
                }
                // En caso de error (ej: dev mode), mostramos la local
                setRemoteVersion(packageJson.version);
            }
        };

        fetchRemoteVersion();
    }, []);

    const handleCheckUpdate = async () => {
        setCheckingUpdate(true);
        try {
            const release = await appDistribution().checkForUpdate();
            if (release && release.downloadUrl) {
                Alert.alert(
                    'Nueva Actualización Disponible',
                    `Versión ${release.displayVersion} (${release.versionCode}).\n¿Deseas descargarla e instalarla ahora?`,
                    [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                            text: 'Actualizar',
                            onPress: async () => {
                                try {
                                    await release.download();
                                } catch (err) {
                                    Alert.alert('Error', 'No se pudo iniciar la descarga.');
                                    console.error('Download error:', err);
                                }
                            },
                        },
                    ]
                );
            } else {
                Alert.alert('Todo al día', 'Ya tienes la última versión instalada.');
                // Actualizamos la versión remota por si acaso
                setRemoteVersion(packageJson.version);
            }
        } catch (error) {
            console.error('Check update error:', error);
            let msg = 'No se pudo verificar la actualización.';
            if (error.message && error.message.includes("not supported")) {
                msg = 'La verificación de actualizaciones no está soportada en este dispositivo o entorno.';
            } else if (error.code === 'app-distribution/not-supported') {
                 msg = 'Esta función no está disponible en simuladores o versiones de desarrollo no distribuidas.';
            }
            Alert.alert('Aviso', msg);
        } finally {
            setCheckingUpdate(false);
        }
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

                <Text style={styles.sectionHeader}>Sistema</Text>
                <TouchableOpacity style={styles.settingItem} onPress={handleCheckUpdate} disabled={checkingUpdate}>
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
                            {checkingUpdate ? 'Verificando...' : 'Buscar nueva versión en Firebase'}
                        </Text>
                    </View>
                    {!checkingUpdate && <Icon name="chevron-forward" size={20} color="#C7C7CC" />}
                </TouchableOpacity>

                <View style={styles.versionContainer}>
                    <Text style={styles.versionText}>Versión Instalada: {packageJson.version}</Text>
                    {remoteVersion && remoteVersion !== packageJson.version && (
                        <Text style={[styles.versionText, { color: '#007AFF', fontWeight: 'bold', marginTop: 4 }]}>
                            Nueva Versión Disponible: {remoteVersion}
                        </Text>
                    )}
                    {remoteVersion && remoteVersion === packageJson.version && (
                        <Text style={[styles.versionText, { color: '#34C759', marginTop: 4, fontSize: 12 }]}>
                            (Sincronizada con App Distribution)
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
