import { StyleSheet } from 'react-native';

// Paleta alineada con DESIGN.md (field-blue, success-green, danger-red, inks).
export const COLORS = {
  primary: '#007AFF',
  green: '#34C759',
  red: '#FF3B30',
  amber: '#F2994A',
  ink: '#1A1A1A',
  body: '#333333',
  muted: '#8E8E93',
  faint: '#C7C7CC',
  surface: '#FFFFFF',
  bg: '#F5F6FA',
  divider: '#EEEEEE',
  border: '#E0E0E0',
};

export default StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },

  // Header (usa paddingTop dinámico según safe area en el componente)
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    elevation: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff', flex: 1, paddingLeft: 10 },
  headerBtn: { padding: 4 },

  content: { padding: 16 },

  // Tarjetas
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 12, color: COLORS.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  value: { fontSize: 15, color: COLORS.ink, fontWeight: '700' },

  // Resumen (banda de stats)
  summaryBand: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 14, gap: 10 },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    elevation: 2,
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  summaryValue: { fontSize: 18, fontWeight: '800', color: COLORS.ink },
  summaryLabel: { fontSize: 11, color: COLORS.muted, fontWeight: '600', marginTop: 2 },

  // Búsqueda / filtros
  searchRow: { paddingHorizontal: 16, paddingTop: 12 },
  searchInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.ink,
  },
  chipsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 30,
    backgroundColor: '#EAEAEA',
  },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.muted },
  chipTextActive: { color: '#fff' },

  // === Vista compacta (lista, resumen, filtros) ============================
  // Banda de resumen: una sola tarjeta con celdas separadas por divisor vertical.
  summaryBandSm: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: 10,
    elevation: 1,
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  summaryCellSm: { flex: 1, alignItems: 'center' },
  summaryValueSm: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
  summaryLabelSm: { fontSize: 10, color: COLORS.muted, fontWeight: '600', marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.3 },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 26, backgroundColor: COLORS.border },

  // Buscador delgado con ícono embebido.
  searchRowSm: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 38,
  },
  searchInputSm: { flex: 1, fontSize: 14, color: COLORS.ink, paddingVertical: 0 },

  // Wrapper del ScrollView horizontal de filtros: sin altura fija el ScrollView
  // se expande verticalmente y empuja la lista hacia abajo, dejando los chips
  // flotando en el medio de la pantalla.
  chipsRowWrap: { height: 46 },

  // Fila única de chips (deslizable): mezcla tiempo + estado con un separador.
  chipsRowSm: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  chipSm: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#EAEAEA',
  },
  chipSmActive: { backgroundColor: COLORS.primary },
  chipSmText: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  chipSmTextActive: { color: '#fff' },
  chipsSeparator: {
    width: StyleSheet.hairlineWidth,
    height: 18,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },

  // Fila de recepción compacta (una sola línea + meta abajo, con barra lateral de estado).
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingVertical: 10,
    paddingRight: 12,
    marginHorizontal: 16,
    marginBottom: 6,
    overflow: 'hidden',
  },
  receiptStripe: {
    width: 4,
    alignSelf: 'stretch',
    marginRight: 10,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  receiptNumberSm: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.ink, marginRight: 8 },
  receiptTotal: { fontSize: 14, fontWeight: '800', color: COLORS.ink },
  receiptMetaSm: { fontSize: 11.5, color: COLORS.muted, marginTop: 2 },

  // === Fin vista compacta ===================================================

  // Item de lista de recepción
  receiptCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  receiptNumber: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
  receiptMeta: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeCompleted: { backgroundColor: '#E7F9EE' },
  badgeCompletedText: { color: COLORS.green },
  badgeVoided: { backgroundColor: '#FDECEA' },
  badgeVoidedText: { color: COLORS.red },

  // Líneas de producto
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.divider,
  },
  lineName: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.ink },
  lineQty: { fontSize: 15, fontWeight: '700', color: COLORS.primary, marginLeft: 8 },
  lineSub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },

  // Inputs de formulario
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.ink,
    marginBottom: 12,
  },
  inputSmall: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: COLORS.ink,
    minWidth: 70,
    textAlign: 'center',
  },

  // Botones
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  primaryBtnDisabled: { opacity: 0.5 },
  dangerBtn: {
    backgroundColor: COLORS.red,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  dangerBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  ghostBtn: { paddingVertical: 14, alignItems: 'center' },
  ghostBtnText: { color: COLORS.muted, fontSize: 15, fontWeight: '600' },
  addLineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 14,
  },
  addLineText: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },

  // Fila compacta tocable (abre una ventana flotante)
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  rowIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EAF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  thumb: {
    width: 42,
    height: 42,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: COLORS.divider,
  },

  // Obligatorio
  required: { color: COLORS.red, fontWeight: '800' },

  // Foto de factura
  photoDropzone: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 24,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 30,
  },
  invoiceImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: COLORS.divider,
  },
  invoiceImageLarge: {
    width: '100%',
    height: 320,
    borderRadius: 12,
    backgroundColor: COLORS.divider,
  },
  photoActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  photoActionText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },

  // Visor de foto a pantalla completa
  photoViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoViewerImage: {
    width: '100%',
    height: '80%',
  },
  photoViewerClose: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 8,
  },

  // Estados vacíos
  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30 },
  emptyText: { fontSize: 15, color: COLORS.muted, textAlign: 'center', marginTop: 12 },

  // Modal selector de productos
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.ink },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
  },
  productName: { fontSize: 15, fontWeight: '600', color: COLORS.ink },
  productStock: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
});
