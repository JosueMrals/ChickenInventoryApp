// Estilos de CustomerDetailScreen y CustomerCreditIndicators.
// Tokens de ../DESIGN.md: Field Blue #007AFF, verde/rojo solo semánticos,
// Card Lift como única sombra, radios 16 en tarjetas.
import { StyleSheet } from 'react-native';

const cardLift = {
  shadowColor: '#0A2540',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 6,
  elevation: 2,
};

export default StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F6FA' },
  loadingText: { marginTop: 8, color: '#8E8E93', fontSize: 13 },
  listContent: { padding: 14, paddingBottom: 30 },

  /* ── Encabezado del cliente ── */
  headerCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 12, ...cardLift },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#EAF0FF',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: '#007AFF' },
  name: { fontSize: 17, fontWeight: '800', color: '#1A1A1A' },
  typeText: { fontSize: 12, fontWeight: '600', color: '#8E8E93', marginTop: 2 },
  editBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F6FA',
    alignItems: 'center', justifyContent: 'center',
  },
  contactBlock: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 10, gap: 4 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contactText: { fontSize: 13, fontWeight: '500', color: '#4B5563', flex: 1 },

  /* ── Indicadores de crédito ── */
  indicatorsCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 12, ...cardLift },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#1A1A1A', marginBottom: 10 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statChip: { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center', backgroundColor: '#F5F6FA' },
  statLabel: { fontSize: 9, fontWeight: '700', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },
  statValue: { fontSize: 14, fontWeight: '800', color: '#1A1A1A', marginTop: 3, textAlign: 'center' },
  statValueDanger: { color: '#FF3B30' },
  statValueSuccess: { color: '#34C759' },
  usageBarWrap: { height: 6, borderRadius: 4, backgroundColor: '#F0F0F5', overflow: 'hidden', marginTop: 4, marginBottom: 4 },
  usageBar: { height: 6, borderRadius: 4, backgroundColor: '#007AFF' },
  usageBarDanger: { backgroundColor: '#FF3B30' },
  usageLabel: { fontSize: 11, fontWeight: '600', color: '#8E8E93', marginBottom: 8 },
  behaviorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  behaviorText: { fontSize: 12, fontWeight: '600', color: '#4B5563', flex: 1 },
  recommendBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginTop: 10,
  },
  recommendGood: { backgroundColor: '#34C75915', borderWidth: 1, borderColor: '#34C75940' },
  recommendBad: { backgroundColor: '#FF3B3010', borderWidth: 1, borderColor: '#FF3B3030' },
  recommendText: { flex: 1, fontSize: 12, fontWeight: '700' },
  recommendTextGood: { color: '#1E7E34' },
  recommendTextBad: { color: '#C0392B' },

  /* ── Historial de compras ── */
  purchasesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  purchasesCount: { fontSize: 12, fontWeight: '700', color: '#8E8E93' },
  purchaseCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, marginBottom: 8, ...cardLift },
  purchaseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  purchaseInfo: { flex: 1, paddingRight: 10 },
  purchaseTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  purchaseMeta: { fontSize: 11, fontWeight: '500', color: '#8E8E93', marginTop: 2 },
  purchaseTotal: { fontSize: 15, fontWeight: '800', color: '#1A1A1A' },
  purchaseBadges: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#EEEEEE' },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#6B7280' },
  badgeCredit: { backgroundColor: '#5856D6' },
  badgeCreditText: { color: '#FFFFFF' },
  emptyState: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyText: { fontSize: 13, color: '#9CA3AF' },
});
