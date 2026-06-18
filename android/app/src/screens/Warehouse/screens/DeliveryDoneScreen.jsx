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
  Modal,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import DeliveryTicket from '../components/DeliveryTicket';
import ViewShot from 'react-native-view-shot';
import {
  printPngImageFromBase64,
  printDeliveryTicket,
} from '../../settings/printers/services/printerService';
import Share from 'react-native-share';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { resolveCustomerName } from '../../../utils/customerUtils';
import { buildUsersByEmailMap, resolveUserDisplayName } from '../../../utils/userUtils';
import {
  getTicketCustomizationSettings,
  DEFAULT_TICKET_SETTINGS,
} from '../../settings/ticketCustomization/ticketCustomizationService';
import {
  createReturnRequest,
  subscribeReturnRequestsByPresale,
} from '../../../services/returnService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DeliveryDoneScreen({ navigation, route }) {
  const { sale: routeSale } = route.params;
  const viewShotRef = useRef();
  const insets = useSafeAreaInsets();
  const [printing, setPrinting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [customersById, setCustomersById] = useState({});
  const [usersByEmail, setUsersByEmail] = useState({});
  const [ticketSettings, setTicketSettings] = useState(DEFAULT_TICKET_SETTINGS);
  const [bonusMovements, setBonusMovements] = useState([]);
  // Devolución
  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [existingReturnRequest, setExistingReturnRequest] = useState(null);

  const currentUser = auth().currentUser;
  const ticketWidth = ticketSettings.paperWidthMm >= 75 ? 576 : 384;

  // Combinar bonos embebidos en la venta con los BONUS_OUT de Firestore
  const embeddedBonuses = routeSale?.bonusesAwarded || routeSale?.bonuses || [];
  const allBonuses = bonusMovements.length > 0 ? bonusMovements : embeddedBonuses;

  // Usamos routeSale directamente sin mezclar deliveredBy en createdBy.
  // El override previo causaba que createdBy contuviera el email del entregador,
  // lo que hacía que el entregador apareciera como vendedor.
  const sale = { ...routeSale };

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

    // Escuchar usuarios (para resolver nombres de vendedor/entregador)
    const unsubUsers = firestore()
      .collection('users')
      .onSnapshot(
        (snap) => {
          if (!snap) { setUsersByEmail({}); return; }
          const map = buildUsersByEmailMap(
            snap.docs.map((d) => ({ id: d.id, ...d.data() })),
          );
          setUsersByEmail(map);
        },
        (err) => {
          console.error('[DeliveryDone] users:', err);
          setUsersByEmail({});
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
      unsubUsers();
      unsubBonuses();
      mounted = false;
    };
  }, [routeSale?.id]);

  // Escuchar si ya existe una solicitud de devolución para esta venta
  useEffect(() => {
    if (!routeSale?.id) return;
    const unsub = subscribeReturnRequestsByPresale(routeSale.id, (docs) => {
      const active = docs.find((d) => d.status === 'pending_review' || d.status === 'approved');
      setExistingReturnRequest(active || null);
    });
    return () => unsub();
  }, [routeSale?.id]);

  const customerName = resolveCustomerName(sale, customersById, 'Cliente General');
  // Extraer dirección del cliente desde el objeto embebido o desde customersById
  const customerId = sale.customerId || sale.customer?.id;
  const customerAddress =
    customersById[customerId]?.address ||
    sale.customer?.address ||
    sale.customerAddress ||
    null;

  // ── Vendedor ──────────────────────────────────────────────────────────────
  // En el doc de pre-venta, `createdBy` = email del vendedor original.
  // Cuando el Cloud Function crea el doc de venta, mapea ese campo a `originalCreatedBy`.
  // Aquí recibimos el objeto pre-venta directamente (DeliveryPaymentScreen pasa delivery,
  // no espera la respuesta de la cloud function), así que `originalCreatedBy` puede no existir.
  // Por eso mapeamos explícitamente: sale.createdBy → originalCreatedBy para que
  // getSeller() en DeliveryTicket y printerService lo encuentre.
  const resolvedSeller =
    sale.originalCreatedBy ||
    sale.preSaleCreatedBy ||
    sale.cashierName ||
    sale.operatorName ||
    sale.createdBy ||         // en doc pre-venta, createdBy = el vendedor
    null;

  // ── Entregador ────────────────────────────────────────────────────────────
  // deliveredBy con fallback al usuario actual.
  // Se mantiene separado de createdBy para no confundir roles.
  const resolvedDeliveredBy =
    sale.deliveredBy ||
    sale.collectedBy ||
    sale.paidBy ||
    currentUser?.email ||
    null;

  // ── Nombres para mostrar (resueltos desde la colección `users`) ───────────
  const sellerDisplayName = resolveUserDisplayName(resolvedSeller, usersByEmail);
  const delivererDisplayName = resolveUserDisplayName(resolvedDeliveredBy, usersByEmail);

  // Incluir bonuses combinados, dirección, vendedor y entregador en ticketSale
  const ticketSale = {
    ...sale,
    customerName,
    customerAddress,
    bonuses: allBonuses,
    originalCreatedBy: resolvedSeller,       // vendedor (email) — usado por getSeller()
    deliveredBy: resolvedDeliveredBy,        // entregador (email) — usado por getOperator()
    sellerDisplayName,                       // nombre completo del vendedor
    delivererDisplayName,                    // nombre completo del entregador
  };

  const handleFinish = () => navigation.popToTop();

  const handleShare = async () => {
    if (sharing) return;
    try {
      setSharing(true);
      const uri = await viewShotRef.current.capture();
      // ViewShot con result:'tmpfile' devuelve un path sin prefijo en algunos casos
      const fileUri = uri.startsWith('file://') || uri.startsWith('content://') ? uri : `file://${uri}`;
      await Share.open({
        title: `Ticket Entrega #${(routeSale?.id || '').substring(0, 6)}`,
        url: fileUri,
        type: 'image/png',
        failOnCancel: false,
      });
    } catch (error) {
      if (error?.message?.includes('User did not share') || error?.message?.includes('userDidNotShare')) return;
      console.error('[DeliveryDone] share:', error);
      Alert.alert('Error', 'No se pudo compartir el ticket.');
    } finally {
      setSharing(false);
    }
  };

  // Impresión por texto nativo (igual que PreSaleDoneScreen — no usa captura de pantalla)
  const handlePrint = async () => {
    if (printing) return;
    try {
      setPrinting(true);
      await printDeliveryTicket(ticketSale);
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

  const handleOpenReturnModal = () => {
    setReturnReason('');
    setReturnModalVisible(true);
  };

  const handleSubmitReturn = async () => {
    if (!returnReason.trim()) {
      Alert.alert('Campo requerido', 'Debes ingresar una razón detallada para la devolución.');
      return;
    }
    try {
      setSubmittingReturn(true);
      await createReturnRequest({
        presaleId: routeSale.id,
        sale: ticketSale,
        reason: returnReason.trim(),
        requestedByRole: 'entregador',
      });
      setReturnModalVisible(false);
      Alert.alert('Solicitud enviada', 'La solicitud de devolución fue enviada al equipo de bodega para revisión.');
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo enviar la solicitud.');
    } finally {
      setSubmittingReturn(false);
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
          options={{ format: 'png', quality: 1, result: 'tmpfile' }}
          collapsable={false}
          style={[styles.ticketShot, { width: ticketWidth }]}>
          <DeliveryTicket sale={ticketSale} settings={ticketSettings} />
        </ViewShot>
      </ScrollView>

      {/* ── Acciones ─────────────────────────────────────────────────────────── */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + 10 }]}>


        <View style={styles.rowButtons}>
          <TouchableOpacity
            style={[styles.iconBtn, styles.shareBtn, sharing && styles.btnDisabled]}
            onPress={handleShare}
            disabled={sharing}
            activeOpacity={0.85}>
            {sharing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Icon name="share-social-outline" size={20} color="#fff" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconBtn, styles.printBtn, printing && styles.btnDisabled]}
            onPress={handlePrint}
            disabled={printing}
            activeOpacity={0.85}>
            {printing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Icon name="print-outline" size={20} color="#fff" />
            )}
          </TouchableOpacity>

        {/* Botón devolución */}
        {existingReturnRequest ? (
          <View style={styles.returnStatusRow}>
            <Text style={[
              styles.returnStatusText,
              existingReturnRequest.status === 'approved' && { color: '#16A34A' },
            ]}>
              {existingReturnRequest.status === 'approved'
                ? 'Devolución aprobada'
                : 'Solicitud de devolución en revisión'}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.iconBtn, styles.returnBtn, existingReturnRequest && styles.returnBtnDisabled]}
            onPress={handleOpenReturnModal}
            disabled={!!existingReturnRequest}>
            <Icon
              name={existingReturnRequest ? (existingReturnRequest.status === 'approved' ? 'checkmark-circle-outline' : 'time-outline') : 'return-up-back-outline'}
              size={20}
              color={existingReturnRequest ? '#9CA3AF' : '#D92D20'}
            />
          </TouchableOpacity>
        )}
        </View>


        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleFinish}
          activeOpacity={0.85}>
          <Icon name="arrow-back-outline" size={18} color="#374151" />
          <Text style={styles.backBtnText}>Volver a Mis Entregas</Text>
        </TouchableOpacity>


      </View>

      {/* Modal de solicitud de devolución */}
      <Modal
        visible={returnModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !submittingReturn && setReturnModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Solicitar Devolución</Text>
            <Text style={styles.modalDesc}>
              La solicitud será enviada a bodega para verificación manual.
              Los productos serán devueltos al inventario solo tras su confirmación.
            </Text>
            <Text style={styles.modalLabel}>Razón de devolución (obligatoria)</Text>
            <TextInput
              value={returnReason}
              onChangeText={setReturnReason}
              placeholder="Ej: El cliente rechazó el pedido al momento de la entrega..."
              placeholderTextColor="#9CA3AF"
              style={styles.reasonInput}
              multiline
              numberOfLines={4}
              editable={!submittingReturn}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setReturnModalVisible(false)}
                disabled={submittingReturn}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleSubmitReturn}
                disabled={submittingReturn}>
                {submittingReturn
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalSubmitText}>Enviar solicitud</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingTop: 40,
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
  rowButtons: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
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
    marginBottom: 10,
  },
  backBtnText: { color: '#374151', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  returnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 14,
    paddingVertical: 12,
    marginBottom: 4,
  },
  returnBtnDisabled: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  returnReason: { color: '#D92D20', fontSize: 14, fontWeight: '700' },
  returnStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  returnStatusText: { fontSize: 13, fontWeight: '700', color: '#B45309' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 8 },
  modalDesc: { fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 14 },
  modalLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  modalCancelText: { color: '#374151', fontWeight: '600', fontSize: 14 },
  modalSubmitBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#D92D20',
    alignItems: 'center',
  },
  modalSubmitText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});