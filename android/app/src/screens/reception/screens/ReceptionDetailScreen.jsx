import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { voidGoodsReceipt } from '../../../services/receptionService';
import { getProductById } from '../../productsNew1/services/productsService';
import styles, { COLORS } from '../styles/receptionStyles';
import { formatCurrency } from '../../../utils/formatMoney';

function formatDate(ts) {
  const millis = ts?.toMillis?.() ?? (typeof ts === 'number' ? ts : null);
  if (!millis) return '—';
  return format(new Date(millis), "d 'de' MMMM yyyy · HH:mm", { locale: es });
}

export default function ReceptionDetailScreen({ navigation, route }) {
  const { receiptId, role } = route.params || {};
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voiding, setVoiding] = useState(false);
  const [voidModal, setVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [photoViewer, setPhotoViewer] = useState(false);
  const [openingProductId, setOpeningProductId] = useState(null);

  // Suscripción en vivo: si otro usuario (admin) anula, la vista se actualiza sola.
  useEffect(() => {
    if (!receiptId) {
      setLoading(false);
      return undefined;
    }
    const unsubscribe = firestore()
      .collection('goodsReceipts')
      .doc(receiptId)
      .onSnapshot(
        (snap) => {
          if (snap.exists()) setReceipt({ id: snap.id, ...snap.data() });
          else setReceipt(null);
          setLoading(false);
        },
        (err) => {
          console.error('[ReceptionDetail] snapshot:', err);
          setLoading(false);
        }
      );
    return () => unsubscribe();
  }, [receiptId]);

  const doVoid = async () => {
    const reason = voidReason.trim();
    if (!reason) {
      Alert.alert('Motivo requerido', 'Indica el motivo de la anulación.');
      return;
    }
    setVoiding(true);
    try {
      await voidGoodsReceipt({ receiptId, reason, role });
      setVoidModal(false);
      setVoidReason('');
      Alert.alert('Recepción anulada', 'El stock fue revertido correctamente.');
    } catch (err) {
      console.error('Error anulando recepción:', err);
      Alert.alert('No se pudo anular', err?.message || 'Intenta nuevamente.');
    } finally {
      setVoiding(false);
    }
  };

  // Redirige al módulo de inventario (ProductDetail) para ver/editar el producto.
  // ProductsStack es un hermano en el drawer; se navega a él indicando la pantalla
  // interna y sus params. Se carga el producto completo por id porque esa pantalla
  // espera el objeto entero (precios por ruta, categoría, etc.), no solo el id.
  const openProductInInventory = async (item) => {
    if (!item?.productId) return;
    try {
      setOpeningProductId(item.productId);
      const product = await getProductById(item.productId);
      if (!product) {
        Alert.alert('Producto no encontrado', 'Este producto ya no existe en el inventario.');
        return;
      }
      navigation.navigate('ProductsStack', {
        screen: 'ProductDetail',
        params: { product, role },
      });
    } catch (e) {
      console.error('[ReceptionDetail] abrir producto:', e);
      Alert.alert('Error', 'No se pudo abrir el producto en el inventario.');
    } finally {
      setOpeningProductId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!receipt) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Icon name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalle</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.emptyWrap}>
          <Icon name="alert-circle-outline" size={48} color={COLORS.faint} />
          <Text style={styles.emptyText}>Esta recepción ya no está disponible.</Text>
        </View>
      </View>
    );
  }

  const isVoided = receipt.status === 'voided';
  const isAdmin = role === 'admin';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recepción #{receipt.receiptNumber ?? '—'}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Estado */}
        <View style={[styles.card, { alignItems: 'flex-start' }]}>
          <View style={[styles.badge, isVoided ? styles.badgeVoided : styles.badgeCompleted]}>
            <Text style={[styles.badgeText, isVoided ? styles.badgeVoidedText : styles.badgeCompletedText]}>
              {isVoided ? 'ANULADA' : 'COMPLETADA'}
            </Text>
          </View>

          <View style={{ height: 12 }} />
          <InfoLine label="Proveedor" value={receipt.supplier || 'Sin proveedor'} />
          {!!receipt.reference && <InfoLine label="N.º factura" value={receipt.reference} />}
          <InfoLine label="Registrada" value={formatDate(receipt.createdAt)} />
          <InfoLine label="Registrada por" value={`${receipt.createdBy || 'sistema'} (${receipt.createdByRole || '—'})`} />
          {!!receipt.notes && <InfoLine label="Notas" value={receipt.notes} />}
        </View>

        {/* Foto de la factura */}
        {receipt.invoicePhoto?.url && (
          <View style={styles.card}>
            <Text style={[styles.label, { marginBottom: 10 }]}>Factura</Text>
            <TouchableOpacity activeOpacity={0.9} onPress={() => setPhotoViewer(true)}>
              <Image source={{ uri: receipt.invoicePhoto.url }} style={styles.invoiceImage} resizeMode="cover" />
              <View style={[styles.rowBetween, { marginTop: 8 }]}>
                <Text style={styles.lineSub}>Toca para ampliar</Text>
                <Icon name="expand-outline" size={18} color={COLORS.muted} />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Aviso de anulación */}
        {isVoided && (
          <View style={[styles.card, { backgroundColor: '#FDECEA' }]}>
            <Text style={[styles.label, { color: COLORS.red }]}>Anulada</Text>
            <InfoLine label="Motivo" value={receipt.voidReason || '—'} />
            <InfoLine label="Anulada por" value={receipt.voidedBy || '—'} />
            <InfoLine label="Fecha" value={formatDate(receipt.voidedAt)} />
          </View>
        )}

        {/* Líneas de producto: se ve TODO el movimiento (antes → después).
            Cada fila abre el producto en el módulo de inventario (ver/editar). */}
        <Text style={[styles.label, { marginBottom: 10, marginLeft: 4 }]}>Detalle de productos</Text>
        <Text style={[styles.lineSub, { marginBottom: 8, marginLeft: 4 }]}>Toca un producto para verlo en el inventario</Text>
        <View style={styles.card}>
          {(receipt.items || []).map((item, idx) => (
            <TouchableOpacity
              key={`${item.productId || idx}`}
              style={[styles.lineRow, idx === (receipt.items.length - 1) && { borderBottomWidth: 0 }]}
              activeOpacity={item.productId ? 0.6 : 1}
              disabled={!item.productId || !!openingProductId}
              onPress={() => openProductInInventory(item)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.lineName} numberOfLines={1}>{item.productName}</Text>
                <Text style={styles.lineSub}>
                  Stock {item.previousStock} → {item.resultingStock}
                  {item.unitCost != null ? `  ·  ${formatCurrency(item.unitCost)} c/u` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
                <Text style={styles.lineQty}>+{item.quantity}</Text>
                <Text style={styles.lineSub}>{formatCurrency(item.lineCost)}</Text>
              </View>
              {openingProductId === item.productId ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                item.productId && <Icon name="open-outline" size={18} color={COLORS.muted} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Totales */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Unidades totales</Text>
            <Text style={styles.value}>{receipt.totalUnits ?? 0}</Text>
          </View>
          <View style={[styles.rowBetween, { marginTop: 8 }]}>
            <Text style={styles.label}>Costo total</Text>
            <Text style={[styles.value, { fontSize: 18 }]}>{formatCurrency(receipt.totalCost)}</Text>
          </View>
        </View>

        {/* Anular: solo admin y solo si sigue completada */}
        {isAdmin && !isVoided && (
          <TouchableOpacity style={styles.dangerBtn} onPress={() => setVoidModal(true)}>
            <Text style={styles.dangerBtnText}>Anular recepción (revertir stock)</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Modal de anulación con captura de motivo (Android no tiene Alert.prompt) */}
      <Modal visible={voidModal} transparent animationType="fade" onRequestClose={() => setVoidModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.card, { margin: 20, marginTop: 'auto', marginBottom: 'auto' }]}>
            <Text style={[styles.value, { fontSize: 18, marginBottom: 6 }]}>Anular recepción</Text>
            <Text style={[styles.lineSub, { marginBottom: 12 }]}>
              Esta acción revierte el stock ingresado. Indica el motivo:
            </Text>
            <TextInput
              style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
              placeholder="Motivo de la anulación"
              placeholderTextColor={COLORS.muted}
              value={voidReason}
              onChangeText={setVoidReason}
              multiline
              autoFocus
            />
            {voiding ? (
              <ActivityIndicator size="large" color={COLORS.red} style={{ marginTop: 8 }} />
            ) : (
              <>
                <TouchableOpacity style={styles.dangerBtn} onPress={doVoid}>
                  <Text style={styles.dangerBtnText}>Confirmar anulación</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ghostBtn} onPress={() => { setVoidModal(false); setVoidReason(''); }}>
                  <Text style={styles.ghostBtnText}>Cancelar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Visor de la factura a pantalla completa */}
      <Modal visible={photoViewer} transparent animationType="fade" onRequestClose={() => setPhotoViewer(false)}>
        <View style={styles.photoViewerOverlay}>
          <TouchableOpacity style={styles.photoViewerClose} onPress={() => setPhotoViewer(false)}>
            <Icon name="close" size={30} color="#fff" />
          </TouchableOpacity>
          <Image
            source={{ uri: receipt?.invoicePhoto?.url }}
            style={styles.photoViewerImage}
            resizeMode="contain"
          />
        </View>
      </Modal>
    </View>
  );
}

function InfoLine({ label, value }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { marginTop: 2, fontWeight: '600' }]}>{value}</Text>
    </View>
  );
}
