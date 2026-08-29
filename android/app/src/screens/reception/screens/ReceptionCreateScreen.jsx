import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  PermissionsAndroid,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import ProductPickerModal from '../components/ProductPickerModal';
import InvoicePhotoModal from '../components/InvoicePhotoModal';
import LineItemModal from '../components/LineItemModal';
import {
  createGoodsReceipt,
  computeReceiptTotals,
  validateReceptionDraft,
} from '../../../services/receptionService';
import { uploadInvoicePhoto, deleteInvoicePhoto } from '../services/invoicePhotosService';
import styles, { COLORS } from '../styles/receptionStyles';
import { formatCurrency } from '../../../utils/formatMoney';

export default function ReceptionCreateScreen({ navigation, route }) {
  const { role } = route?.params ?? {};
  const [supplier, setSupplier] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [invoicePhoto, setInvoicePhoto] = useState(null); // { url, path, uploadedAt }
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [lines, setLines] = useState([]); // { productId, productName, category, stock, quantity, unitCost }
  const [saving, setSaving] = useState(false);

  // Estado de las ventanas flotantes.
  const [pickerVisible, setPickerVisible] = useState(false);   // seleccionar producto
  const [photoModal, setPhotoModal] = useState(false);         // gestionar foto
  const [editingLineId, setEditingLineId] = useState(null);    // línea abierta en el modal

  // Candado de envío: evita doble creación por doble tap (una recepción duplica stock).
  const submittingRef = useRef(false);

  // ── Captura / selección de la foto de la factura ───────────────────────────
  const pickInvoicePhoto = async (fromCamera) => {
    try {
      if (fromCamera && Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Permiso de cámara',
            message: 'ChickenInventory necesita la cámara para fotografiar la factura.',
            buttonPositive: 'Permitir',
            buttonNegative: 'Cancelar',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permiso denegado', 'Activa el permiso de cámara en los ajustes para tomar fotos.');
          return;
        }
      }

      const pick = fromCamera ? launchCamera : launchImageLibrary;
      const result = await pick({ mediaType: 'photo', quality: 0.9, saveToPhotos: false });
      if (result.didCancel) return;
      if (result.errorCode) {
        Alert.alert('Error', result.errorMessage || 'No se pudo abrir la cámara/galería.');
        return;
      }
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;

      setUploadingPhoto(true);
      // Si ya había una foto subida, se limpia la anterior de Storage al reemplazar.
      const previous = invoicePhoto;
      const photo = await uploadInvoicePhoto(uri);
      setInvoicePhoto(photo);
      if (previous?.path) deleteInvoicePhoto(previous.path);
    } catch (e) {
      console.error('[ReceptionCreate] error subiendo factura:', e?.code || e?.message || e);
      let msg = e?.message || 'No se pudo subir la foto.';
      if (e?.code === 'storage/unauthorized') msg = 'No tienes permisos para subir la foto (revisa las reglas de Storage).';
      if (e?.code === 'camera_unavailable') msg = 'La cámara no está disponible en este dispositivo.';
      Alert.alert('Error', msg);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removeInvoicePhoto = () => {
    const previous = invoicePhoto;
    setInvoicePhoto(null);
    if (previous?.path) deleteInvoicePhoto(previous.path);
  };

  // ── Líneas de producto ─────────────────────────────────────────────────────
  // Al elegir un producto en el picker se agrega con valores vacíos y se abre de
  // inmediato el modal de captura de cantidad/costo.
  const addProduct = (product) => {
    setLines((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name || 'Producto',
        category: product.category || '',
        stock: Number(product.stock || 0),
        quantity: '',
        unitCost: '',
      },
    ]);
    setPickerVisible(false);
    setEditingLineId(product.id);
  };

  const saveLine = ({ productId, quantity, unitCost }) => {
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, quantity, unitCost } : l)));
    setEditingLineId(null);
  };

  const removeLine = (productId) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
    setEditingLineId(null);
  };

  // Si se cierra el modal de una línea recién agregada sin cantidad válida, se
  // descarta para no dejar filas vacías en la recepción.
  const closeLineModal = () => {
    setLines((prev) => prev.filter((l) => !(l.productId === editingLineId && !(Number(l.quantity) > 0))));
    setEditingLineId(null);
  };

  const excludedIds = useMemo(() => lines.map((l) => l.productId), [lines]);
  const editingLine = useMemo(() => {
    const l = lines.find((x) => x.productId === editingLineId);
    if (!l) return null;
    // `existing` indica al modal si ya tenía cantidad (para el texto y "Quitar").
    return { ...l, quantity: Number(l.quantity) || undefined, unitCost: Number(l.unitCost) || undefined, existing: Number(l.quantity) > 0 };
  }, [lines, editingLineId]);

  const totals = useMemo(
    () =>
      computeReceiptTotals(
        lines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity) || 0,
          unitCost: Number(l.unitCost) || 0,
        }))
      ),
    [lines]
  );

  const handleSave = async () => {
    if (submittingRef.current) return;

    const items = lines.map((l) => ({
      productId: l.productId,
      productName: l.productName,
      category: l.category,
      quantity: Number(l.quantity) || 0,
      unitCost: Number(l.unitCost) || 0,
    }));

    const validation = validateReceptionDraft({ items, supplier, reference });
    if (!validation.ok) {
      Alert.alert('Revisa la recepción', validation.message);
      return;
    }

    if (uploadingPhoto) {
      Alert.alert('Espera', 'La foto de la factura aún se está subiendo.');
      return;
    }

    Alert.alert(
      'Confirmar recepción',
      `Vas a ingresar ${totals.totalUnits} unidades (${totals.itemCount} productos) al inventario.\n\nEsta acción aumenta el stock.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar ingreso',
          onPress: async () => {
            submittingRef.current = true;
            setSaving(true);
            try {
              const res = await createGoodsReceipt({ items, supplier, reference, notes, invoicePhoto, role });
              Alert.alert('Recepción registrada', `Recepción #${res.receiptNumber} guardada correctamente.`);
              navigation.goBack();
            } catch (err) {
              console.error('Error creando recepción:', err);
              Alert.alert('No se pudo registrar', err?.message || 'Intenta nuevamente.');
            } finally {
              submittingRef.current = false;
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const canSave = lines.length > 0 && !saving;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nueva Recepción</Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Datos del documento */}
          <View style={styles.card}>
            <Text style={[styles.label, { marginBottom: 6 }]}>Proveedor <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre del proveedor"
              placeholderTextColor={COLORS.muted}
              value={supplier}
              onChangeText={setSupplier}
            />
            <Text style={[styles.label, { marginBottom: 6 }]}>N.º de factura <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. FAC-00123"
              placeholderTextColor={COLORS.muted}
              value={reference}
              onChangeText={setReference}
            />
            <Text style={[styles.label, { marginBottom: 6 }]}>Notas</Text>
            <TextInput
              style={[styles.input, { minHeight: 60, textAlignVertical: 'top', marginBottom: 0 }]}
              placeholder="Observaciones de la recepción (opcional)"
              placeholderTextColor={COLORS.muted}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>

          {/* Foto de la factura: fila compacta que abre la ventana flotante */}
          <TouchableOpacity style={styles.rowCard} activeOpacity={0.7} onPress={() => setPhotoModal(true)}>
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 12 }} />
            ) : invoicePhoto?.url ? (
              <Image source={{ uri: invoicePhoto.url }} style={styles.thumb} resizeMode="cover" />
            ) : (
              <View style={styles.rowIconWrap}>
                <Icon name="camera-outline" size={22} color={COLORS.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.value}>Foto de la factura</Text>
              <Text style={styles.lineSub}>
                {uploadingPhoto ? 'Subiendo...' : invoicePhoto?.url ? 'Adjuntada · toca para ver o cambiar' : 'Opcional · toca para adjuntar'}
              </Text>
            </View>
            <Icon name="chevron-forward" size={20} color={COLORS.faint} />
          </TouchableOpacity>

          {/* Productos: filas compactas tocables + botón para agregar */}
          <Text style={[styles.label, { marginBottom: 10, marginLeft: 4, marginTop: 8 }]}>Productos recibidos</Text>

          {lines.map((line) => {
            const qty = Number(line.quantity) || 0;
            const cost = Number(line.unitCost) || 0;
            const incomplete = qty <= 0;
            return (
              <TouchableOpacity
                key={line.productId}
                style={styles.rowCard}
                activeOpacity={0.7}
                onPress={() => setEditingLineId(line.productId)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.value} numberOfLines={1}>{line.productName}</Text>
                  {incomplete ? (
                    <Text style={[styles.lineSub, { color: COLORS.amber }]}>Toca para ingresar cantidad</Text>
                  ) : (
                    <Text style={styles.lineSub}>
                      {qty} u × {formatCurrency(cost)}  ·  stock {line.stock} → {line.stock + qty}
                    </Text>
                  )}
                </View>
                {!incomplete && <Text style={[styles.lineQty, { marginRight: 8 }]}>{formatCurrency(qty * cost)}</Text>}
                <Icon name="chevron-forward" size={20} color={COLORS.faint} />
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={styles.addLineBtn} onPress={() => setPickerVisible(true)}>
            <Icon name="add" size={20} color={COLORS.primary} />
            <Text style={styles.addLineText}>Agregar producto</Text>
          </TouchableOpacity>

          {/* Totales */}
          {lines.length > 0 && (
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.label}>Productos</Text>
                <Text style={styles.value}>{totals.itemCount}</Text>
              </View>
              <View style={[styles.rowBetween, { marginTop: 8 }]}>
                <Text style={styles.label}>Unidades totales</Text>
                <Text style={styles.value}>{totals.totalUnits}</Text>
              </View>
              <View style={[styles.rowBetween, { marginTop: 8 }]}>
                <Text style={styles.label}>Costo total</Text>
                <Text style={[styles.value, { fontSize: 18 }]}>{formatCurrency(totals.totalCost)}</Text>
              </View>
            </View>
          )}

          {saving ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 16 }} />
          ) : (
            <TouchableOpacity
              style={[styles.primaryBtn, !canSave && styles.primaryBtnDisabled]}
              onPress={handleSave}
              disabled={!canSave}
            >
              <Text style={styles.primaryBtnText}>Registrar recepción</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.ghostBtn} onPress={() => navigation.goBack()} disabled={saving}>
            <Text style={styles.ghostBtnText}>Cancelar</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Ventanas flotantes */}
      <ProductPickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={addProduct}
        excludedIds={excludedIds}
      />

      <InvoicePhotoModal
        visible={photoModal}
        onClose={() => setPhotoModal(false)}
        invoicePhoto={invoicePhoto}
        uploadingPhoto={uploadingPhoto}
        onTakePhoto={() => pickInvoicePhoto(true)}
        onPickGallery={() => pickInvoicePhoto(false)}
        onRemove={removeInvoicePhoto}
      />

      <LineItemModal
        visible={!!editingLineId}
        line={editingLine}
        onClose={closeLineModal}
        onSave={saveLine}
        onRemove={removeLine}
      />
    </View>
  );
}
