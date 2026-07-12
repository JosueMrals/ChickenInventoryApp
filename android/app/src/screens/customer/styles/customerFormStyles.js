import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F1FA' },
  scrollBody: { flex: 1 },
  scroll: { padding: 13, paddingBottom: 16 },

  headerBack: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)',
    marginRight: 10,
  },

  loadingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  loadingText: { marginLeft: 6, color: '#7A7488', fontSize: 11, fontWeight: '600' },

  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#9A93AA', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5, marginTop: 2, marginLeft: 3 },

  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 11, marginBottom: 11,
    borderWidth: 1.5, borderColor: '#EDE9F7', elevation: 6,
  },

  row: { flexDirection: 'row' },
  fieldWrap: { marginBottom: 8 },
  label: { fontSize: 11, fontWeight: '700', color: '#635F69', marginBottom: 4, marginLeft: 3 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F1FA',
    borderRadius: 13, paddingHorizontal: 7, paddingVertical: 4, minHeight: 40,
    borderWidth: 1.5, borderColor: '#E3DEF5',
  },
  inputRowMultiline: { alignItems: 'flex-start', minHeight: 70, paddingVertical: 8 },
  inputRowError: { borderColor: '#DC2626', backgroundColor: '#FDF2F2' },
  inputDisabled: { backgroundColor: '#ECEAF0', borderColor: '#E3E0EA' },
  input: { flex: 1, fontSize: 14, color: '#332F3A', padding: 0, fontWeight: '600' },
  inputMultiline: { minHeight: 52, textAlignVertical: 'top', paddingTop: 2 },
  errorText: { fontSize: 10, fontWeight: '700', color: '#DC2626', marginTop: 3, marginLeft: 3 },

  iconClay: {
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E1EFFF', marginRight: 6,
  },
  iconClayTop: { marginTop: 2 },
  iconClayDisabled: { backgroundColor: '#E3E0EA' },

  typesRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7,
    borderRadius: 999, backgroundColor: '#F4F1FA', borderWidth: 1.5, borderColor: '#E3DEF5',
  },
  typeChipActive: { backgroundColor: '#007AFF', borderColor: '#007AFF', elevation: 4 },
  typeChipText: { fontSize: 12, fontWeight: '700', color: '#635F69' },
  typeChipTextActive: { color: '#fff' },

  lockBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3E2',
    borderRadius: 11, padding: 8, marginBottom: 9, borderWidth: 1.5, borderColor: '#FBE2B8',
  },
  lockText: { fontSize: 11, color: '#B4690A', fontWeight: '700', flex: 1 },

  hintText: { fontSize: 12, color: '#9A93AA', fontWeight: '600', fontStyle: 'italic' },
  photoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, borderRadius: 13, backgroundColor: '#F4F1FA',
    borderWidth: 1.5, borderColor: '#E3DEF5',
  },
  photoBtnText: { fontSize: 12, fontWeight: '700', color: '#007AFF' },

  // ── Barra fija inferior (botón) ──
  footer: {
    padding: 11,
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 1.5, borderColor: '#EDE9F7', elevation: 10,
  },
  btnSave: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#007AFF', borderRadius: 15, paddingVertical: 12, elevation: 6,
  },
  btnSaveText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // ── Ventana animada de confirmación al guardar ──
  successBackdrop: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(51,47,58,0.45)',
  },
  successCard: {
    backgroundColor: '#fff', borderRadius: 24, paddingVertical: 26, paddingHorizontal: 32,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#EDE9F7', elevation: 10,
  },
  successIconWrap: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#22C55E',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  successText: { fontSize: 15, fontWeight: '800', color: '#332F3A' },
});
