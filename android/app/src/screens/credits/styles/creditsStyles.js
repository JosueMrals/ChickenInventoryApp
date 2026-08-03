import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F3F7' },

  /* ── Summary cards ── */
  summaryRow: { flexDirection: 'row', paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  summaryCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12, padding: 10, alignItems: 'center',
  },
  summaryLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.4 },
  summaryValue: { fontSize: 16, fontWeight: '800', color: '#fff', marginTop: 2 },

  /* ── Screen content ── */
  screenContent: { flex: 1, paddingHorizontal: 14, paddingTop: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1F2937', marginBottom: 8 },

  /* ── Search ── */
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, paddingHorizontal: 12, height: 42,
    borderWidth: 1, borderColor: '#ECECEC', marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', marginLeft: 6 },

  /* ── Filters ── */
  filters: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#F0F0F5', borderWidth: 1, borderColor: '#E0E0E8',
  },
  filterBtnActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  filterBtnText: { fontSize: 12, fontWeight: '700', color: '#555' },
  filterBtnTextActive: { color: '#fff' },
  filterCount: {
    fontSize: 10, fontWeight: '800', color: '#007AFF',
    backgroundColor: '#EBF3FF', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1,
  },
  filterCountActive: { color: '#007AFF', backgroundColor: 'rgba(255,255,255,0.25)' },

  /* ── Credit card ── */
  creditCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#ECECEC',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#EBF3FF', alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  avatarText: { fontSize: 15, fontWeight: '800', color: '#007AFF' },
  cardTitleBlock: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  cardMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  statusPill: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 },
  statusPaid: { backgroundColor: '#D1FAE5' },
  statusPending: { backgroundColor: '#FEE2E2' },
  statusPillText: { fontSize: 10, fontWeight: '800', color: '#111827' },

  /* Progress bar */
  progressWrap: { height: 6, backgroundColor: '#F0F0F5', borderRadius: 4, marginBottom: 10, overflow: 'hidden' },
  progressBar: { height: 6, borderRadius: 4, backgroundColor: '#10B981' },

  /* Amounts */
  amountsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  amountChip: {
    flex: 1, backgroundColor: '#F8F9FA', borderRadius: 10,
    padding: 8, alignItems: 'center', borderWidth: 1, borderColor: '#F0F0F0',
  },
  amountLabel: { fontSize: 9, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.3 },
  amountValue: { fontSize: 13, fontWeight: '800', color: '#1F2937', marginTop: 2 },
  amountValueDanger: { color: '#EF4444' },
  amountValueSuccess: { color: '#10B981' },

  /* Last payment */
  lastPaymentRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA',
    borderRadius: 8, padding: 8, marginBottom: 10, gap: 6,
  },
  lastPaymentText: { fontSize: 11, color: '#6B7280' },

  /* Actions */
  actionsRow: { flexDirection: 'row', gap: 6, justifyContent: 'flex-end' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  actionBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  btnDetail: { backgroundColor: '#6366F1' },
  btnEdit: { backgroundColor: '#3B82F6' },
  btnPay: { backgroundColor: '#10B981' },
  btnDelete: { backgroundColor: '#EF4444' },

  /* ── Modal ── */
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff', borderRadius: 20,
    padding: 24, width: '100%',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1F2937', marginBottom: 4 },
  modalCustomer: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  pendingBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7',
    borderRadius: 10, padding: 10, marginBottom: 16, gap: 8,
  },
  pendingBadgeText: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  pendingAmount: { fontSize: 20, fontWeight: '800', color: '#D97706' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA',
    borderRadius: 12, paddingHorizontal: 12, height: 50,
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 20,
  },
  input: { flex: 1, fontSize: 18, fontWeight: '700', color: '#111827', marginLeft: 8 },

  /* Fecha de pago acordada dentro del modal */
  dueRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F3F4F6', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, marginTop: -8, marginBottom: 14,
  },
  dueRowLate: { backgroundColor: '#FEE2E2' },
  dueRowText: { fontSize: 11, fontWeight: '600', color: '#6B7280', flex: 1 },
  dueRowTextLate: { color: '#DC2626' },

  /* Vista previa del abono (aplicado / restante / cambio) */
  previewBox: {
    backgroundColor: '#F8F9FA', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 12, paddingVertical: 8, marginTop: -10, marginBottom: 16, gap: 4,
  },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  previewValue: { fontSize: 13, fontWeight: '800', color: '#1F2937' },
  previewValueSuccess: { color: '#10B981' },
  previewChangeLabel: { color: '#B45309' },
  previewChangeValue: { color: '#B45309' },

  modalButtons: { flexDirection: 'row', gap: 10 },
  btnConfirm: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 13, gap: 6,
  },
  btnCancel: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F0F0F5', borderRadius: 12, paddingVertical: 13,
    borderWidth: 1, borderColor: '#E0E0E8',
  },
  btnConfirmText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  btnCancelText: { fontSize: 14, fontWeight: '700', color: '#6B7280' },

  /* ── History (other screens) ── */
  listContent: { paddingBottom: 30 },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 13, color: '#9CA3AF' },

  historyHeader: {
    backgroundColor: '#007AFF', paddingHorizontal: 16,
    paddingVertical: 14, flexDirection: 'row', alignItems: 'center',
  },
        headerTitle: {
            flex: 1,
        },
  historyBack: { marginRight: 10 },
  historyHeaderTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  historyFiltersPanel: {
    padding: 16, backgroundColor: '#F8FAFC',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  filtersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#E5E7EB' },
  filterChipActive: { backgroundColor: '#007AFF' },
  filterChipActiveDark: { backgroundColor: '#111827' },
  filterChipText: { fontSize: 12, color: '#334155', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  historyCard: {
    backgroundColor: '#fff', borderRadius: 12,
    marginHorizontal: 12, marginTop: 12, padding: 12, elevation: 1,
  },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyInfo: { flex: 1, paddingRight: 12 },
  historyTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 2 },
  historyMeta: { fontSize: 11, color: '#6B7280' },
  historyRight: { alignItems: 'flex-end' },
  historyTotal: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 4 },
  historyTotalsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  historyAmount: { fontSize: 12, color: '#374151' },
  historyNote: { fontSize: 11, color: '#6B7280', marginTop: 6 },
  detailContent: { padding: 12, paddingBottom: 24 },
  detailCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, elevation: 1 },
  detailCustomer: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  detailMeta: { fontSize: 12, color: '#475569', marginBottom: 4 },
  paymentItemCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  paymentItemTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  paymentItemMeta: { fontSize: 12, color: '#475569', marginBottom: 2 },

  // Legacy aliases (keep for other screens that reference them)
  btn: { padding: 8, borderRadius: 8, marginLeft: 6 },
  btnPrimary: { backgroundColor: '#007AFF' },
  btnDanger: { backgroundColor: '#FF3B30' },
  btnText: { color: '#fff', fontWeight: '600' },
  rowButtons: { flexDirection: 'row', justifyContent: 'space-between' },
});
