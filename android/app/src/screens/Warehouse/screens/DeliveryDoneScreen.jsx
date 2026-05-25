import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import DeliveryTicket from '../components/DeliveryTicket';
import ViewShot from 'react-native-view-shot';
import { printPngImageFromBase64 } from '../../settings/printers/services/printerService';
import Share from 'react-native-share';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { resolveCustomerName } from '../../../utils/customerUtils';
import {
  getTicketCustomizationSettings,
  DEFAULT_TICKET_SETTINGS,
} from '../../settings/ticketCustomization/ticketCustomizationService';

export default function DeliveryDoneScreen({ navigation, route }) {
  const { sale: routeSale } = route.params;
  const viewShotRef = useRef();
  const [printing, setPrinting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [customersById, setCustomersById] = useState({});
  const [ticketSettings, setTicketSettings] = useState(DEFAULT_TICKET_SETTINGS);
  const [bonusMovements, setBonusMovements] = useState([]);

  const currentUser = auth().currentUser;
  const ticketWidth = ticketSettings.paperWidthMm >= 75 ? 576 : 384;

  // Combinar bonos embebidos en la venta con los BONUS_OUT de Firestore
  const embeddedBonuses = routeSale?.bonusesAwarded || routeSale?.bonuses || [];
  const allBonuses = bonusMovements.length > 0 ? bonusMovements : embeddedBonuses;

  // Sale enriquecida con fallback de operador
  const sale = {
    ...routeSale,
    createdBy:
      routeSale?.createdBy ||
      routeSale?.deliveredBy ||
      currentUser?.email ||
      null,
  };

  useEffect(() => {
    // Escuchar clientes
    const unsubCustomers = firestore()
      .collection('customers')
      .onSnapshot(
        (snap) => {
          if (!snap) { setCustomersById({}); return; }
          setCustomersById(
            snap.docs.reduce((acc, doc) => {
              acc[doc.id] = { id: doc.id, ...doc.data() };
              return acc;
            }, {}),
          );
        },
        (err) => {
          console.error('[DeliveryDone] customers:', err);
          setCustomersById({});
        },
      );

    // Escuchar BONUS_OUT vinculados a esta venta
    let unsubBonuses = () => {};
    if (routeSale?.id) {
      unsubBonuses = firestore()
        .collection('inventoryMovements')
        .where('relatedSaleId', '==', routeSale.id)
        .where('type', '==', 'BONUS_OUT')
        .onSnapshot((snap) =>
          setBonusMovements(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        );
    }

    // Cargar ajustes de ticket
    let mounted = true;
    getTicketCustomizationSettings().then((s) => {
      if (mounted) setTicketSettings(s);
    });

    return () => {
      unsubCustomers();
      unsubBonuses();
      mounted = false;
    };
  }, [routeSale?.id]);

  const customerName = resolveCustomerName(sale, customersById, 'Cliente General');
  // Incluir bonuses combinados en ticketSale para que DeliveryTicket los muestre
  const ticketSale = { ...sale, customerName, bonuses: allBonuses };

  const handleFinish = () => navigation.popToTop();

  const handleShare = async () => {
    if (sharing) return;
    try {
      setSharing(true);
      const uri = await viewShotRef.current.capture();
      await Share.open({
        title: `Ticket Entrega #${(routeSale?.id || '').substring(0, 6)}`,
        url: uri,
        type: 'image/png',
        failOnCancel: false,
      });
    } catch (error) {
      if (error?.message?.includes('User did not share')) return;
      console.error('[DeliveryDone] share:', error);
      Alert.alert('Error', 'No se pudo compartir el ticket.');
    } finally {
      setSharing(false);
    }
  };

  // Impresión por imagen (igual que PreSaleDoneScreen)
  const handlePrint = async () => {
    if (printing) return;
    try {
      setPrinting(true);
      const base64 = await viewShotRef.current.capture();
      await printPngImageFromBase64(base64, { threshold: 170, mode: 'escstar' });
    } catch (error) {
      console.error('[DeliveryDone] print:', error);
      Alert.alert(
        'Error de Impresión',
        error.message || 'Verifica la conexión con la impresora.',
      );
    } finally {
      setPrinting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name="checkmark-done-circle" size={22} color="#22C55E" />
          <Text style={styles.headerTitle}>Entrega Completada</Text>
        </View>
        <TouchableOpacity onPress={handleFinish} style={styles.closeBtn}>
          <Icon name="close" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* ── Ticket (capturado por ViewShot para impresión/compartir) ─────────── */}
      <ScrollView
        contentContainerStyle={styles.ticketScroll}
        showsVerticalScrollIndicator={false}>
        <ViewShot
          ref={viewShotRef}
          options={{ format: 'png', quality: 1, result: 'base64' }}
          collapsable={false}
          style={[styles.ticketShot, { width: ticketWidth }]}>
          <DeliveryTicket sale={ticketSale} settings={ticketSettings} />
        </ViewShot>
      </ScrollView>

      {/* ── Acciones ─────────────────────────────────────────────────────────── */}
      <View style={styles.actions}>
        <View style={styles.rowButtons}>
          <TouchableOpacity
            style={[styles.shareBtn, sharing && styles.btnDisabled]}
            onPress={handleShare}
            disabled={sharing}
            activeOpacity={0.85}>
            {sharing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="share-social-outline" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Compartir</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.printBtn, printing && styles.btnDisabled]}
            onPress={handlePrint}
            disabled={printing}
            activeOpacity={0.85}>
            {printing ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.actionBtnText}>Imprimiendo…</Text>
              </>
            ) : (
              <>
                <Icon name="print-outline" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Imprimir</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleFinish}
          activeOpacity={0.85}>
          <Icon name="arrow-back-outline" size={18} color="#374151" />
          <Text style={styles.backBtnText}>Volver a Mis Entregas</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F6FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketScroll: { alignItems: 'center', paddingVertical: 12 },
  ticketShot: {
    backgroundColor: '#fff',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  actions: {
    padding: 14,
    gap: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  rowButtons: { flexDirection: 'row', gap: 10 },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#5E72E4',
    borderRadius: 14,
    paddingVertical: 14,
    elevation: 3,
  },
  printBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 14,
    elevation: 4,
  },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  backBtnText: { color: '#374151', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
});