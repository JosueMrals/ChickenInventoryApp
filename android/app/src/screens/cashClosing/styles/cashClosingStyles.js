import { StyleSheet } from 'react-native';

// Tokens de ../DESIGN.md: Field Blue #007AFF único acento; verde/rojo semánticos;
// una sola sombra; radios 16 tarjeta, 30 pill en botones primarios.
export const COLORS = {
  accent: '#007AFF',
  accentSoft: '#E8F1FF',
  success: '#34C759',
  successSoft: '#E4F9EC',
  danger: '#FF3B30',
  dangerSoft: '#FFEDEC',
  ink: '#1A1A1A',
  body: '#333333',
  muted: '#8E8E93',
  border: '#E0E0E0',
  divider: '#EEEEEE',
  canvas: '#F5F6FA',
  surface: '#FFFFFF',
};

export const formatMoney = (value) => {
  const n = Number(value);
  return `C$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
};

const CARD_SHADOW = {
  shadowColor: '#0A2540',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 6,
  elevation: 2,
};

export default StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.canvas },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, color: COLORS.muted, fontSize: 14, fontWeight: '500' },
  listContent: { padding: 16, paddingBottom: 32 },

  /* ── Mi turno ── */
  turnoCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 18, marginBottom: 16, ...CARD_SHADOW },
  turnoLabel: { fontSize: 12, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  turnoAmount: { fontSize: 32, fontWeight: '800', color: COLORS.ink, marginTop: 6 },
  turnoMeta: { fontSize: 12, fontWeight: '500', color: COLORS.muted, marginTop: 4 },

  /* ── Secciones ── */
  sectionTitle: { fontSize: 13, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10, marginTop: 6 },

  /* ── Revisión pendiente (admin) ── */
  pendingCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 14, marginBottom: 10, ...CARD_SHADOW },
  pendingTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pendingName: { fontSize: 14, fontWeight: '700', color: COLORS.ink, flex: 1 },
  pendingAmount: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
  pendingMeta: { fontSize: 11, fontWeight: '500', color: COLORS.muted, marginTop: 2 },
  pendingActions: { flexDirection: 'row', gap: 8, marginTop: 12 },

  /* ── Botones ── */
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.accent, borderRadius: 30, paddingVertical: 14 },
  primaryButtonText: { color: COLORS.surface, fontSize: 15, fontWeight: '700' },
  successButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.success, borderRadius: 30, paddingVertical: 11, flex: 1 },
  successButtonText: { color: COLORS.surface, fontSize: 13, fontWeight: '700' },
  dangerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: COLORS.danger, borderRadius: 30, paddingVertical: 11, flex: 1 },
  dangerButtonText: { color: COLORS.danger, fontSize: 13, fontWeight: '700' },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: COLORS.accent, borderRadius: 30, paddingVertical: 11, paddingHorizontal: 16 },
  secondaryButtonText: { color: COLORS.accent, fontSize: 13, fontWeight: '700' },
  disabledButton: { opacity: 0.45 },

  /* ── Estado vacío ── */
  emptyState: { alignItems: 'center', marginTop: 40, gap: 10, paddingHorizontal: 30 },
  emptyText: { color: COLORS.muted, fontSize: 14, fontWeight: '500', textAlign: 'center' },

  /* ── Modal ── */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.ink },
  modalSubtitle: { fontSize: 13, fontWeight: '500', color: COLORS.muted, marginTop: 4, marginBottom: 16 },
  modalLabel: { fontSize: 12, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', marginBottom: 6 },
  modalInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: COLORS.ink, backgroundColor: COLORS.surface, marginBottom: 14 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
