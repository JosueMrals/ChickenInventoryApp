import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import DeliveryTicket from '../components/DeliveryTicket';
import ViewShot from 'react-native-view-shot';
import { printDeliveryTicket } from '../../settings/printers/services/printerService';
import Share from 'react-native-share';
import firestore from '@react-native-firebase/firestore';
import { resolveCustomerName } from '../../../utils/customerUtils';
import { getTicketCustomizationSettings, DEFAULT_TICKET_SETTINGS } from '../../settings/ticketCustomization/ticketCustomizationService';

export default function DeliveryDoneScreen({ navigation, route }) {
  const { sale } = route.params;
  const viewShotRef = useRef();
  const [printing, setPrinting] = useState(false);
  const [customersById, setCustomersById] = useState({});
  const [ticketSettings, setTicketSettings] = useState(DEFAULT_TICKET_SETTINGS);

  const ticketWidth = ticketSettings.paperWidthMm >= 75 ? 576 : 384;
  const bonuses = sale?.bonusesAwarded || sale?.bonuses || [];
  const hasBonuses = Array.isArray(bonuses) && bonuses.length > 0;
  const bonusKpis = React.useMemo(() => {
    if (!hasBonuses) return { skuCount: 0, unitsCount: 0 };

    const skuSet = new Set();
    let units = 0;

    bonuses.forEach((bonus, idx) => {
      const skuKey = String(bonus?.productId || bonus?.id || bonus?.productName || bonus?.name || `bonus_${idx}`)
        .trim()
        .toLowerCase();
      if (skuKey) skuSet.add(skuKey);
      units += Number(bonus?.quantity || bonus?.qty || bonus?.bonusQty || 0);
    });

    return {
      skuCount: skuSet.size,
      unitsCount: Number(units.toFixed(2)),
    };
  }, [bonuses, hasBonuses]);

  useEffect(() => {
    const unsub = firestore()
      .collection('customers')
      .onSnapshot(
        (snapshot) => {
          if (!snapshot) {
            setCustomersById({});
            return;
          }
          const map = snapshot.docs.reduce((acc, doc) => {
            acc[doc.id] = { id: doc.id, ...doc.data() };
            return acc;
          }, {});
          setCustomersById(map);
        },
        (error) => {
          console.error('Error al escuchar customers:', error);
          setCustomersById({});
        }
      );

    return () => unsub();
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadSettings = async () => {
      const stored = await getTicketCustomizationSettings();
      if (mounted) setTicketSettings(stored);
    };
    loadSettings();
    return () => {
      mounted = false;
    };
  }, []);

  const customerName = resolveCustomerName(sale, customersById, 'Cliente General');
  const ticketSale = { ...sale, customerName };

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
        await printDeliveryTicket(ticketSale);
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

      <ScrollView contentContainerStyle={styles.ticketScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.ticketContainer}>
          {hasBonuses && (
            <View style={[styles.bonusBanner, { maxWidth: ticketWidth }]}>
              <Icon name="gift-outline" size={16} color="#7C3AED" />
              <Text style={styles.bonusBannerText}>
                {bonusKpis.skuCount} regalo(s) · {bonusKpis.unitsCount} unidad(es)
              </Text>
            </View>
          )}
          <ViewShot
            ref={viewShotRef}
            options={{ format: "png", quality: 0.9 }}
            style={[styles.ticketShot, { width: ticketWidth }]}
          >
               <DeliveryTicket sale={ticketSale} settings={ticketSettings} />
          </ViewShot>
        </View>
      </ScrollView>

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
  ticketScroll: {
    paddingVertical: 12,
  },
  ticketContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  ticketShot: {
    backgroundColor: '#fff',
    alignSelf: 'center',
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
  bonusBanner: {
    width: '100%',
    maxWidth: 384,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3E8FF',
    borderRadius: 10,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 6,
  },
  bonusBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6D28D9',
  },
});