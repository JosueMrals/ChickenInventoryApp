import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import ImageResizer from '@bam.tech/react-native-image-resizer';
import RNFS from 'react-native-fs';
import globalStyles from '../../../styles/globalStyles';
import SaleReceipt from '../../sales/components/SaleReceipt';
import {
  DEFAULT_TICKET_SETTINGS,
  getTicketCustomizationSettings,
  resetTicketCustomizationSettings,
  saveTicketCustomizationSettings,
} from './ticketCustomizationService';

// ── Constantes ────────────────────────────────────────────────────────────────

const FONT_OPTIONS = [
  { label: 'Sistema', value: 'System' },
  { label: 'Sans', value: 'sans-serif' },
  { label: 'Serif', value: 'serif' },
  { label: 'Mono', value: 'monospace' },
];

/** Datos de demostración para la vista previa real del recibo */
const MOCK_SALE = {
  id: 'preview',
  receiptNumber: '0001',
  createdAt: null,
  customerName: 'Cliente Ejemplo',
  paymentMethod: 'cash',
  cashierName: 'Vendedor Demo',
  subtotal: 165.0,
  totalDiscount: 0,
  categoryDiscountTotal: 0,
  total: 165.0,
  items: [
    { productName: 'Pollo Entero', quantity: 2, unitPrice: 60.0, discount: 0, total: 120.0, pricingSource: 'regular' },
    { productName: 'Muslos x kg', quantity: 1, unitPrice: 45.0, discount: 0, total: 45.0, pricingSource: 'wholesale' },
  ],
  bonuses: [],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizePreviewUri = (uri) => {
  if (!uri) return '';
  if (uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('http')) return uri;
  return `file://${uri}`;
};

const normalizeFileUriForRead = (uri) => {
  if (!uri) return uri;
  return uri.startsWith('file://') ? uri.replace('file://', '') : uri;
};

const getImageSize = (uri) =>
  new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });

// ── Componente ────────────────────────────────────────────────────────────────

export default function TicketCustomizationScreen({ navigation }) {
  const [settings, setSettings] = useState(DEFAULT_TICKET_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getTicketCustomizationSettings()
      .then((stored) => { if (isMounted) { setSettings(stored); setLoading(false); } })
      .catch(() => { if (isMounted) setLoading(false); });
    return () => { isMounted = false; };
  }, []);

  const previewWidth = useMemo(() => {
    const minPx = 280;
    const maxPx = 360;
    const ratio = (settings.paperWidthMm - 58) / (80 - 58);
    return Math.round(minPx + (maxPx - minPx) * clamp(ratio, 0, 1));
  }, [settings.paperWidthMm]);

  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const normalized = {
        ...settings,
        fontSize: clamp(Number(settings.fontSize) || 14, 10, 24),
        paperWidthMm: clamp(Number(settings.paperWidthMm) || 58, 58, 80),
      };
      const saved = await saveTicketCustomizationSettings(normalized);
      setSettings(saved);
      Alert.alert('Listo', 'Se guardaron los cambios.');
    } catch (error) {
      console.log('Save ticket settings error:', error);
      Alert.alert('Error', 'No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    Alert.alert('Restablecer', '¿Deseas volver a la configuración por defecto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Restablecer',
        style: 'destructive',
        onPress: async () => {
          const defaults = await resetTicketCustomizationSettings();
          setSettings(defaults);
        },
      },
    ]);
  };

  const handlePickImage = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.9 });
      if (result.didCancel) return;
      if (result.errorCode) {
        Alert.alert('Error', 'No se pudo abrir la galería.');
        return;
      }

      const asset = result.assets?.[0] ?? null;
      const uri = asset?.uri || '';
      if (!uri) { Alert.alert('Aviso', 'No se seleccionó ninguna imagen.'); return; }

      const size = asset?.width && asset?.height
        ? { width: asset.width, height: asset.height }
        : await getImageSize(uri);

      const maxDim = 1200;
      const resized = await ImageResizer.createResizedImage(
        uri,
        Math.min(size.width || maxDim, maxDim),
        Math.min(size.height || maxDim, maxDim),
        'PNG',
        100,
        0,
      );

      const normalizedUri = resized?.uri || resized?.path || '';
      if (!normalizedUri) { Alert.alert('Error', 'No se pudo convertir la imagen.'); return; }

      const base64 = await RNFS.readFile(normalizeFileUriForRead(normalizedUri), 'base64');
      updateSetting('headerImageUri', normalizedUri);
      updateSetting('headerImageBase64', base64 || '');
    } catch (error) {
      console.log('Image picker exception:', error);
      Alert.alert('Error', 'Ocurrió un error al seleccionar la imagen.');
    }
  };

  const incrementFont = useCallback((delta) => {
    updateSetting('fontSize', clamp((Number(settings.fontSize) || 14) + delta, 10, 24));
  }, [settings.fontSize, updateSetting]);

  const incrementPaper = useCallback((delta) => {
    updateSetting('paperWidthMm', clamp((Number(settings.paperWidthMm) || 58) + delta, 58, 80));
  }, [settings.paperWidthMm, updateSetting]);

  const renderFontOption = (option) => {
    const isActive = settings.fontFamily === option.value;
    return (
      <TouchableOpacity
        key={option.value}
        style={[styles.pill, isActive && styles.pillActive]}
        onPress={() => updateSetting('fontFamily', option.value)}
      >
        <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{option.label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={globalStyles.container}>
      <View style={globalStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={globalStyles.title}>Personalización de ticket</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Vista previa real con SaleReceipt ────────────────────────────── */}
        <Text style={styles.sectionHeader}>Vista previa</Text>
        <View style={styles.previewWrapper}>
          <View style={[styles.ticketPreview, { width: previewWidth }]}>
            <SaleReceipt
              sale={MOCK_SALE}
              bonuses={[]}
              ticketSettings={settings}
            />
          </View>
        </View>

        {/* ── Cabecera ─────────────────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>Cabecera</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Imagen en cabecera</Text>
          {settings.headerImageUri ? (
            <Image
              source={{ uri: normalizePreviewUri(settings.headerImageUri) }}
              style={styles.headerPreviewImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.headerPlaceholder}>
              <Icon name="image-outline" size={26} color="#A0A4A8" />
              <Text style={styles.placeholderText}>Sin imagen</Text>
            </View>
          )}
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.actionButton, styles.outlineButton, styles.halfButton]}
              onPress={handlePickImage}
            >
              <Text style={styles.outlineButtonText}>Seleccionar de galería</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.outlineButton, styles.halfButton]}
              onPress={() => {
                updateSetting('headerImageUri', '');
                updateSetting('headerImageBase64', '');
              }}
            >
              <Text style={styles.outlineButtonText}>Quitar imagen</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Tipografía ───────────────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>Tipografía</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Fuente</Text>
          <View style={styles.pillRow}>{FONT_OPTIONS.map(renderFontOption)}</View>

          <Text style={[styles.label, { marginTop: 16 }]}>Tamaño de letra</Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity style={styles.stepperButton} onPress={() => incrementFont(-1)}>
              <Text style={styles.stepperText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepperValue}>{settings.fontSize} pt</Text>
            <TouchableOpacity style={styles.stepperButton} onPress={() => incrementFont(1)}>
              <Text style={styles.stepperText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Tamaño de impresión ──────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>Tamaño de impresión</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Ancho del papel</Text>
          <View style={styles.pillRow}>
            {[58, 80].map((value) => {
              const active = settings.paperWidthMm === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => updateSetting('paperWidthMm', value)}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{value} mm</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.stepperRow}>
            <TouchableOpacity style={styles.stepperButton} onPress={() => incrementPaper(-1)}>
              <Text style={styles.stepperText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepperValue}>{settings.paperWidthMm} mm</Text>
            <TouchableOpacity style={styles.stepperButton} onPress={() => incrementPaper(1)}>
              <Text style={styles.stepperText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.helperText}>Rango permitido: 58 mm a 80 mm</Text>
        </View>

        {/* ── Acciones ─────────────────────────────────────────────────────── */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionButton, styles.outlineButton]} onPress={handleReset}>
            <Text style={styles.outlineButtonText}>Restablecer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, (saving || loading) && styles.btnDisabled]}
            onPress={handleSave}
            disabled={saving || loading}
          >
            <Text style={styles.primaryButtonText}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: { padding: 16 },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
  },

  // Vista previa
  previewWrapper: { alignItems: 'center' },
  ticketPreview: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  // Imagen cabecera
  headerPreviewImage: {
    width: '100%',
    height: 70,
    marginBottom: 8,
    borderRadius: 8,
  },
  headerPlaceholder: {
    width: '100%',
    height: 70,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: '#FAFAFA',
  },
  placeholderText: { fontSize: 12, color: '#A0A4A8', marginTop: 4 },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 8 },

  // Row / Pills
  row: { flexDirection: 'row', marginTop: 8, gap: 12 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#F0F3F7' },
  pillActive: { backgroundColor: '#1A73E8' },
  pillText: { fontSize: 13, color: '#4B4F56', fontWeight: '600' },
  pillTextActive: { color: '#FFFFFF' },

  // Stepper
  stepperRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 12 },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: { fontSize: 18, fontWeight: '700', color: '#2E2E2E' },
  stepperValue: { fontSize: 14, fontWeight: '600', color: '#333' },
  helperText: { marginTop: 8, fontSize: 12, color: '#8A8F96' },

  // Actions
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 24 },
  actionButton: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  outlineButton: { borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFFFFF' },
  outlineButtonText: { color: '#1F2937', fontWeight: '600' },
  halfButton: { flex: 1 },
  primaryButton: {
    flex: 1,
    backgroundColor: '#1A73E8',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
});

