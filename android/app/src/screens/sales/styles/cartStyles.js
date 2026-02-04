import { StyleSheet } from 'react-native';
export default StyleSheet.create({
  cartBtn: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 6,
  },
  badge: {
    backgroundColor: '#FF3B30',
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cartTotal: { marginLeft: 10, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  cartTotalText: { color: '#fff', fontWeight: '700' },

  drawerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  drawer: { height: '70%', backgroundColor: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderColor: '#eee' },
  drawerTitle: { fontWeight: '800' },
  cartItem: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderColor: '#f2f2f2', alignItems: 'center' },
  cartItemName: { fontWeight: '700' },
  cartItemMeta: { color: '#666', fontSize: 12 },

  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 },
  qtyText: { marginHorizontal: 8, fontWeight: '700' },

  totals: { paddingVertical: 8, borderTopWidth: 1, borderColor: '#eee' },
  totRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  totLabel: { color: '#555' },
  totValue: { color: '#111' },

  payBtn: { borderWidth: 1, borderColor: '#eee', padding: 8, borderRadius: 8, marginRight: 8 },
  payBtnActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  payText: { color: '#111' },

  input: { borderWidth: 1, borderColor: '#eee', padding: 8, borderRadius: 8, marginTop: 6 },

  btn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', marginRight: 8 },
  btnPrimary: { backgroundColor: '#007AFF' },
  btnCancel: { backgroundColor: '#FF3B30' },
  btnText: { color: '#fff', fontWeight: '700' },
});
