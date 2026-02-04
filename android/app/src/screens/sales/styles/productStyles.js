import { StyleSheet } from 'react-native';
export default StyleSheet.create({
  card: {
    flex: 1,
    margin: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
    elevation: 2,
    minHeight: 100,
    justifyContent: 'space-between',
  },
  name: { fontSize: 15, fontWeight: '700' },
  price: { color: '#007AFF', marginTop: 6 },
  actions: { position: 'absolute', right: 8, bottom: 8 },
  iconBtn: { backgroundColor: '#007AFF', padding: 6, borderRadius: 20 },
  wholesale: { fontSize: 12, color: '#666', marginTop: 6 },

  qtyOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  qtyModal: { width: 260, backgroundColor: '#fff', padding: 16, borderRadius: 12 },
  qtyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  qtyInput: { borderWidth: 1, borderColor: '#eee', padding: 8, borderRadius: 8, marginBottom: 12 },
  qtyRow: { flexDirection: 'row', justifyContent: 'space-between' },
  qtyAdd: { backgroundColor: '#007AFF', padding: 10, borderRadius: 8 },
  qtyCancel: { backgroundColor: '#FF3B30', padding: 10, borderRadius: 8 },
});
