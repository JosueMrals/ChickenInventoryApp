import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import DeliveryTicket from '../components/DeliveryTicket';
import ViewShot from 'react-native-view-shot';
import { printDeliveryTicket } from '../../settings/printers/services/printerService';
import Share from 'react-native-share';

export default function DeliveryDoneScreen({ navigation, route }) {
  const { sale } = route.params;
  const viewShotRef = useRef();
  const [printing, setPrinting] = useState(false);

  const handleFinish = () => {
    navigation.popToTop(); // Go back to MyDeliveries (assuming it is root of stack or close)
  };

  const handleShare = async () => {
    try {
      const uri = await viewShotRef.current.capture();
      
      const shareOptions = {
        title: `Ticket Entrega #${sale.id.substring(0,6)}`,
        url: uri,
        type: 'image/png',
        failOnCancel: false,
      };

      await Share.open(shareOptions);
    } catch (error) {
      if (error && error.message && error.message.includes('User did not share')) {
          // Usuario canceló, no mostrar error
          return;
      }
      console.error(error);
      Alert.alert("Error", "No se pudo compartir el ticket.");
    }
  };

  const handlePrint = async () => {
    if (printing) return;
    setPrinting(true);
    try {
        await printDeliveryTicket(sale);
    } catch (error) {
        Alert.alert("Error de Impresión", error.message || "Verifique la conexión con la impresora");
    } finally {
        setPrinting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Icon name="checkmark-circle" size={60} color="#2DCE89" />
        <Text style={styles.title}>¡Entrega Completada!</Text>
        <Text style={styles.subtitle}>El pago ha sido registrado correctamente.</Text>
      </View>

      <View style={styles.ticketContainer}>
        <ViewShot ref={viewShotRef} options={{ format: "png", quality: 0.9 }} style={{ backgroundColor: '#fff' }}>
             <DeliveryTicket sale={sale} />
        </ViewShot>
      </View>

      <View style={styles.footer}>
        <View style={styles.rowButtons}>
            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                <Icon name="share-social-outline" size={20} color="#fff" style={{marginRight: 8}}/>
                <Text style={styles.buttonText}>Compartir</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.printButton} onPress={handlePrint} disabled={printing}>
                {printing ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <>
                        <Icon name="print-outline" size={20} color="#fff" style={{marginRight: 8}}/>
                        <Text style={styles.buttonText}>Imprimir</Text>
                    </>
                )}
            </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.homeButton} onPress={handleFinish}>
            <Text style={styles.homeButtonText}>Volver a Mis Entregas</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FE',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2DCE89',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  ticketContainer: {
    flex: 1,
    padding: 20,
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    elevation: 5,
  },
  rowButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 10,
  },
  shareButton: {
    flex: 1,
    backgroundColor: '#5E72E4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
  },
  printButton: {
    flex: 1,
    backgroundColor: '#11CDEF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
  },
  homeButton: {
    backgroundColor: '#f4f5f7',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  homeButtonText: {
     color: '#555',
     fontSize: 16,
     fontWeight: '600',
  },
});