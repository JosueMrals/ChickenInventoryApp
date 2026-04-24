import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F3F7' },
  scroll: { padding: 16, paddingBottom: 40 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  loadingText: { marginLeft: 8, color: '#666', fontSize: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4, marginLeft: 4 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#ECECEC' },
  row: { flexDirection: 'row' },
  fieldWrap: { marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '600', color: '#666', marginBottom: 4, marginLeft: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F8FA', borderRadius: 10, paddingHorizontal: 10, height: 44, borderWidth: 1, borderColor: '#ECECEC' },
  inputDisabled: { backgroundColor: '#F0F0F2', borderColor: '#E0E0E0' },
  input: { flex: 1, fontSize: 14, color: '#222', padding: 0 },
  typesRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: '#F5F6FA', borderWidth: 1, borderColor: '#E8E8E8' },
  typeChipActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  typeChipText: { fontSize: 13, fontWeight: '600', color: '#555' },
  typeChipTextActive: { color: '#fff' },
  lockBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF8EE', borderRadius: 8, padding: 8, marginBottom: 12 },
  lockText: { fontSize: 11, color: '#BB7A00', fontWeight: '600' },
  btnSave: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#007AFF', borderRadius: 12, paddingVertical: 14, marginTop: 8 },
  btnSaveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnCancel: { alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 14, marginTop: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E0E0' },
  btnCancelText: { color: '#666', fontSize: 15, fontWeight: '600' },
});

