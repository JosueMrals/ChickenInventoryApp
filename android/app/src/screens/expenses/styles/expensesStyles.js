import { StyleSheet } from 'react-native';

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

  // Mismo tamaño/espaciado que globalStyles.header (usado por la mayoría de
  // pantallas del repo, p. ej. HandoverHistoryScreen/StaffAccountScreen) —
  // antes le faltaba paddingTop, borderRadius y elevation, dejando el header
  // pegado al borde superior en vez de con el mismo "look" del resto de la app.
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 40,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginBottom: 10,
    elevation: 8,
  },
  headerBack: { width: 36 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center' },

  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 30,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: '#0A2540', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  primaryBtnDisabled: { backgroundColor: COLORS.faint },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  ghostBtn: { alignItems: 'center', paddingVertical: 12 },
  ghostBtnText: { fontSize: 14, fontWeight: '600' },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.muted, marginTop: 24, marginHorizontal: 16, marginBottom: 8, textTransform: 'uppercase' },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#0A2540', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  cardAmount: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
  cardSub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },

  badge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  emptyBox: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyText: { color: COLORS.muted, fontSize: 14, textAlign: 'center', marginTop: 8 },

  formGroup: { marginHorizontal: 16, marginTop: 16 },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.ink, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.ink,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.body },
  chipTextActive: { color: '#fff' },

  impactBox: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#EAF3FF',
  },
  impactText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  photoDropzone: {
    height: 160,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  photoPreview: { height: 200, borderRadius: 12 },
  photoActionsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  photoActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 10,
  },
  photoActionText: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },

  detailLabel: { fontSize: 12, color: COLORS.muted, marginTop: 10 },
  detailValue: { fontSize: 15, color: COLORS.ink, fontWeight: '600', marginTop: 2 },

  lockedNotice: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF4E5',
  },
  lockedNoticeText: { fontSize: 13, color: COLORS.amber, fontWeight: '600' },

  // Modal de pago de reembolso (FASE E6.2) — mismo patrón que ReviewTurnoModal.
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.ink },
  modalSubtitle: { fontSize: 13, fontWeight: '500', color: COLORS.muted, marginTop: 4, marginBottom: 16 },
  modalLabel: { fontSize: 12, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', marginTop: 12, marginBottom: 6 },
  modalInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: COLORS.ink, backgroundColor: COLORS.surface,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  secondaryButton: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 30, paddingVertical: 12,
  },
  secondaryButtonText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },

  // === ExpensesScreen — mismo patrón que ReceptionListScreen ================
  // (menú de 3 puntos, banda de resumen, buscador delgado, chips, fila
  // compacta con barra lateral, FAB) — ver receptionStyles.js.
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerMenuBtn: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerMenuBtnActive: { backgroundColor: 'rgba(255,255,255,0.35)' },
  topActionsBackdrop: { ...StyleSheet.absoluteFillObject, zIndex: 20 },
  topActionsMenu: {
    position: 'absolute', top: 64, right: 16, zIndex: 30, width: 210,
    backgroundColor: COLORS.surface, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 8, overflow: 'hidden',
  },
  topActionsMenuOption: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.divider,
  },
  topActionsMenuOptionText: { fontSize: 14, fontWeight: '700', color: COLORS.ink },

  summaryBandSm: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: COLORS.surface, borderRadius: 12, paddingVertical: 10,
    shadowColor: '#0A2540', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  summaryCellSm: { flex: 1, alignItems: 'center' },
  summaryValueSm: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
  summaryLabelSm: { fontSize: 10, color: COLORS.muted, fontWeight: '600', marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.3 },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 26, backgroundColor: COLORS.border },

  searchRowSm: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 10,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, paddingHorizontal: 12, height: 38,
  },
  searchInputSm: { flex: 1, fontSize: 14, color: COLORS.ink, paddingVertical: 0 },

  // Wrapper con altura fija: sin esto el ScrollView horizontal se estira
  // verticalmente y deja los chips flotando (mismo problema ya resuelto en Reception).
  chipsRowWrap: { height: 46 },
  chipsRowSm: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  chipSm: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: '#EAEAEA' },
  chipSmActive: { backgroundColor: COLORS.primary },
  chipSmText: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  chipSmTextActive: { color: '#fff' },
  chipsSeparator: { width: StyleSheet.hairlineWidth, height: 18, backgroundColor: COLORS.border, marginHorizontal: 4 },

  rangeRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 8 },
  rangeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
  },
  rangeLabel: { fontSize: 10, fontWeight: '600', color: COLORS.muted },
  rangeValue: { fontSize: 13, fontWeight: '700', color: COLORS.ink },

  // Fila de gasto compacta (una sola línea + meta abajo, barra lateral por estado).
  expenseRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 10,
    paddingVertical: 10, paddingRight: 12,
    marginHorizontal: 16, marginBottom: 6, overflow: 'hidden',
  },
  expenseStripe: { width: 4, alignSelf: 'stretch', marginRight: 10, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  expenseRowTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.ink, marginRight: 8 },
  expenseRowAmount: { fontSize: 14, fontWeight: '800', color: COLORS.ink },
  expenseRowMeta: { fontSize: 11.5, color: COLORS.muted, marginTop: 2 },

  // FAB "Registrar gasto" (mismo patrón que Reception/customer/presales).
  fab: {
    position: 'absolute', right: 20, bottom: 24,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', elevation: 8,
  },
});
