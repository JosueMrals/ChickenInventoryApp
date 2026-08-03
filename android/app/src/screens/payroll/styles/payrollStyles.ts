import { StyleSheet } from 'react-native';

// Tokens de ../DESIGN.md: Field Blue #007AFF es el único acento; verde y rojo son
// semánticos (a favor / en contra); una sola receta de sombra; radios 16 tarjeta,
// 8-12 contenedores anidados, 30 pill para botones primarios.
export const COLORS = {
  accent: '#007AFF',
  accentSoft: '#E8F1FF',
  success: '#34C759',
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

export const CARD_SHADOW = {
  shadowColor: '#0A2540',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 6,
  elevation: 2,
};

/** Montos en córdobas, con el formato que usa el resto de la app. */
export const formatMoney = (value: number | null | undefined): string => {
  const n = Number(value);
  return `C$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
};

export default StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.canvas },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, color: COLORS.muted, fontSize: 14, fontWeight: '500' },

  listContent: { padding: 16, paddingBottom: 32 },

  /* ── Resumen del periodo ── */
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...CARD_SHADOW,
  },
  summaryTitle: { fontSize: 13, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  summaryNet: { fontSize: 30, fontWeight: '800', color: COLORS.ink, marginTop: 6 },
  summaryBreakdown: { flexDirection: 'row', marginTop: 14, gap: 10 },
  summaryChip: { flex: 1, backgroundColor: COLORS.canvas, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 10 },
  summaryChipLabel: { fontSize: 10, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase' },
  summaryChipValue: { fontSize: 15, fontWeight: '800', color: COLORS.body, marginTop: 3 },

  // Aviso informativo (p. ej. "falta configurar un salario"): no es un error ni
  // un éxito, así que usa Field Blue — DESIGN.md no define un tono de
  // advertencia y su regla es tomar el acento antes de inventar un hue nuevo.
  noticeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.accentSoft, borderRadius: 12, padding: 12, marginBottom: 16,
  },
  noticeText: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.accent },

  /* ── Tarjeta de trabajador ── */
  staffCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    ...CARD_SHADOW,
  },
  staffTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.accentSoft, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: COLORS.accent },
  staffName: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  staffRole: { fontSize: 11, fontWeight: '600', color: COLORS.muted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
  staffNet: { fontSize: 17, fontWeight: '800', color: COLORS.ink },
  staffNetLabel: { fontSize: 10, fontWeight: '600', color: COLORS.muted, textAlign: 'right' },

  staffBreakdown: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.divider,
  },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  tagText: { fontSize: 11, fontWeight: '700' },

  noSalaryTag: { backgroundColor: COLORS.accentSoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  noSalaryText: { fontSize: 11, fontWeight: '700', color: COLORS.accent },

  /* ── Detalle de cuenta ── */
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    ...CARD_SHADOW,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sectionTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.ink },
  sectionTotal: { fontSize: 15, fontWeight: '800', color: COLORS.body },
  sectionEmpty: { fontSize: 12, fontWeight: '500', color: COLORS.muted, paddingVertical: 10 },

  lineRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.divider,
  },
  lineTitle: { fontSize: 13, fontWeight: '600', color: COLORS.body },
  lineMeta: { fontSize: 11, fontWeight: '500', color: COLORS.muted, marginTop: 2 },
  lineAmount: { fontSize: 14, fontWeight: '800', color: COLORS.body },
  lineAction: { padding: 6 },

  /* ── Salario ── */
  salaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  salaryInput: {
    flex: 1,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 16, fontWeight: '700', color: COLORS.ink, backgroundColor: COLORS.surface,
  },

  /* ── Botones ── */
  primaryButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.accent, borderRadius: 30, paddingVertical: 15,
  },
  primaryButtonText: { color: COLORS.surface, fontSize: 15, fontWeight: '700' },
  disabledButton: { opacity: 0.45 },

  secondaryButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: COLORS.accent, borderRadius: 30, paddingVertical: 11, paddingHorizontal: 16,
  },
  secondaryButtonText: { color: COLORS.accent, fontSize: 13, fontWeight: '700' },

  footer: {
    padding: 16, backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.divider,
  },
  footerNetRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 },
  footerNetLabel: { fontSize: 13, fontWeight: '600', color: COLORS.muted },
  footerNetValue: { fontSize: 24, fontWeight: '800', color: COLORS.ink },

  /* ── Modal ── */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.ink },
  modalSubtitle: { fontSize: 13, fontWeight: '500', color: COLORS.muted, marginTop: 4, marginBottom: 16 },
  modalLabel: { fontSize: 12, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', marginBottom: 6 },
  modalInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 15, color: COLORS.ink, backgroundColor: COLORS.surface, marginBottom: 14,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },

  /* ── Estado vacío ── */
  emptyState: { alignItems: 'center', marginTop: 60, gap: 10, paddingHorizontal: 30 },
  emptyText: { color: COLORS.muted, fontSize: 14, fontWeight: '500', textAlign: 'center' },
});
