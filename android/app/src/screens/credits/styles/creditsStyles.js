import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  headerSubText: {
    color: '#E0E7FF',
    fontSize: 13,
    marginTop: 4,
  },
  historyButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  historyButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  filters: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 10,
  },
  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  card: {
    backgroundColor: '#fff',
    margin: 10,
    borderRadius: 10,
    padding: 16,
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  btn: {
    padding: 8,
    borderRadius: 8,
    marginLeft: 6,
  },
  btnPrimary: {
    backgroundColor: '#007AFF',
  },
  btnSecondary: {
    backgroundColor: '#4C7DFF',
  },
  btnDanger: {
    backgroundColor: '#FF3B30',
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  rowButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 6,
  },
  paymentItem: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    marginTop: 6,
    paddingTop: 6,
  },
  historyHeader: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyBack: {
    marginRight: 10,
  },
  historyHeaderTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  historyFiltersPanel: {
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    color: '#111827',
    marginBottom: 10,
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#007AFF',
  },
  filterChipActiveDark: {
    backgroundColor: '#111827',
  },
  filterChipText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 12,
    marginTop: 12,
    padding: 12,
    elevation: 1,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyInfo: {
    flex: 1,
    paddingRight: 12,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  historyMeta: {
    fontSize: 11,
    color: '#6B7280',
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  statusPill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusPaid: {
    backgroundColor: '#D1FAE5',
  },
  statusPending: {
    backgroundColor: '#FEE2E2',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
  },
  historyTotalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  historyAmount: {
    fontSize: 12,
    color: '#374151',
  },
  historyNote: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 6,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 12,
    color: '#6B7280',
  },
  screenContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  listContent: {
    paddingBottom: 24,
  },
  cardCompact: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    elevation: 1,
  },
  cardHeaderCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  cardMeta: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  amountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  amountItem: {
    alignItems: 'flex-start',
    flex: 1,
  },
  amountLabel: {
    fontSize: 10,
    color: '#6B7280',
  },
  amountValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  paymentHint: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 6,
  },
  btnPrimaryCompact: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  btnSecondaryCompact: {
    backgroundColor: '#4C7DFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  btnDangerCompact: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  detailContent: {
    padding: 12,
    paddingBottom: 24,
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 1,
  },
  detailCustomer: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  detailMeta: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 4,
  },
  paymentItemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paymentItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  paymentItemMeta: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 2,
  },
});
