import React, { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Linking, Alert } from "react-native";
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from "react-native-vision-camera";
import { useNavigation, useRoute } from "@react-navigation/native";
import Icon from 'react-native-vector-icons/Ionicons';

export default function BarcodeScannerScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { onScanned } = route.params || {};

  const device = useCameraDevice("back");
  const { hasPermission, requestPermission } = useCameraPermission();
  const [isActive, setIsActive] = useState(true);

  // Solicitar permiso al montar si no se tiene
  useEffect(() => {
      if (!hasPermission) {
          requestPermission();
      }
  }, [hasPermission, requestPermission]);

  // Handler para volver a solicitar o ir a ajustes
  const handleRequestPermission = useCallback(async () => {
      const granted = await requestPermission();
      if (!granted) {
          Alert.alert(
              "Permiso denegado",
              "Para escanear códigos es necesario el acceso a la cámara. Por favor habilítalo en la configuración.",
              [
                  { text: "Cancelar", style: "cancel", onPress: () => navigation.goBack() },
                  { text: "Ir a Configuración", onPress: () => Linking.openSettings() }
              ]
          );
      }
  }, [requestPermission, navigation]);

  const codeScanner = useCodeScanner({
    codeTypes: ['ean-13', 'ean-8', 'code-128', 'code-39', 'qr', 'upc-a', 'upc-e'],
    onCodeScanned: (codes) => {
        if (codes.length > 0 && isActive) {
            const val = codes[0].value;
            if (val) {
                setIsActive(false); // Evitar múltiples escaneos
                if (onScanned) {
                    onScanned(val);
                }
                navigation.goBack();
            }
        }
    }
  });

  // Estado: Sin Permiso
  if (!hasPermission) {
    return (
      <View style={styles.container}>
         <View style={styles.center}>
            <Icon name="camera-off-outline" size={60} color="#666" style={{ marginBottom: 20 }} />
            <Text style={styles.permissionText}>Se requiere acceso a la cámara</Text>
            <Text style={styles.permissionSubText}>Para poder escanear los códigos de barras de tus productos.</Text>
            
            <TouchableOpacity onPress={handleRequestPermission} style={styles.btn}>
                <Text style={styles.btnText}>Permitir Acceso</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelLink}>
                <Text style={styles.cancelLinkText}>Cancelar</Text>
            </TouchableOpacity>
         </View>
      </View>
    );
  }

  // Estado: Sin Dispositivo
  if (!device) {
    return (
        <View style={styles.container}>
             <View style={styles.center}>
                <Icon name="warning-outline" size={50} color="#FF3B30" style={{ marginBottom: 20 }} />
                <Text style={styles.permissionText}>Error de Cámara</Text>
                <Text style={styles.permissionSubText}>No se detectó ninguna cámara trasera en este dispositivo.</Text>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.btn, {marginTop: 20}]}>
                     <Text style={styles.btnText}>Regresar</Text>
                </TouchableOpacity>
             </View>
        </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        codeScanner={codeScanner}
      />
      
      {/* Overlay Visual */}
      <View style={styles.overlay}>
          <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
                  <Icon name="close" size={28} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.title}>Escanear Código</Text>
              <View style={{width: 44}} /> 
          </View>
          
          <View style={styles.scanAreaContainer}>
              <View style={styles.scanArea}>
                  <View style={[styles.corner, styles.tl]} />
                  <View style={[styles.corner, styles.tr]} />
                  <View style={[styles.corner, styles.bl]} />
                  <View style={[styles.corner, styles.br]} />
              </View>
              {/* Linea de escaneo animada (simulada estática por ahora) */}
              <View style={styles.scanLine} />
          </View>

          <View style={styles.footer}>
              <View style={styles.hintContainer}>
                  <Icon name="scan-outline" size={20} color="#fff" style={{marginRight: 8}} />
                  <Text style={styles.hintText}>Apunta la cámara al código</Text>
              </View>
          </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center', 
      padding: 30,
      backgroundColor: '#f5f5f5' 
  },
  permissionText: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#333',
      marginBottom: 10,
      textAlign: 'center'
  },
  permissionSubText: {
      fontSize: 15,
      color: '#666',
      textAlign: 'center',
      marginBottom: 30,
      lineHeight: 22
  },
  btn: { 
      paddingVertical: 14, 
      paddingHorizontal: 24, 
      backgroundColor: '#007AFF', 
      borderRadius: 12,
      elevation: 2 
  },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelLink: { marginTop: 20, padding: 10 },
  cancelLinkText: { color: '#888', fontSize: 16 },

  // Overlay Styles
  overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 50, // SafeArea aprox
      paddingBottom: 40
  },
  header: {
      width: '100%',
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
  },
  closeBtn: {
      padding: 8,
      backgroundColor: 'rgba(0,0,0,0.4)',
      borderRadius: 20
  },
  title: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '600',
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: {width: 0, height: 1},
      textShadowRadius: 3
  },
  scanAreaContainer: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center'
  },
  scanArea: {
      width: 280,
      height: 280,
  },
  corner: {
      width: 40,
      height: 40,
      borderColor: '#00E676',
      position: 'absolute',
      borderWidth: 5,
      borderRadius: 4
  },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  
  scanLine: {
      position: 'absolute',
      width: 260,
      height: 2,
      backgroundColor: 'rgba(255, 0, 0, 0.6)',
      top: '50%'
  },

  footer: {
      paddingBottom: 20
  },
  hintContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 30
  },
  hintText: {
      color: 'white',
      fontSize: 15,
      fontWeight: '500'
  }
});
