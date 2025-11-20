import { StyleSheet, Dimensions } from 'react-native';

const HEIGHT = Dimensions.get('window').height;

export default StyleSheet.create({
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },

  drawer: {
    backgroundColor: '#fff',
    height: HEIGHT * 0.78,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },

  drawerHeader: {
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#eee',
  },

  drawerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#222',
  },

  cartItem: {
    flexDirection: 'row',
    padding: 14,
    borderBottomWidth: 1,
    borderColor: '#F1F1F1',
    alignItems: 'center',
  },

  cartName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },

  cartSub: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },

  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 14,
  },

  qtyText: {
    fontSize: 15,
    fontWeight: '700',
    marginHorizontal: 8,
    color: '#222',
  },

  totalsBox: {
    padding: 10,
    backgroundColor: '#F6F7FB',
    borderRadius: 12,
    marginBottom: 12,
  },

  totalRow: {
    fontSize: 15,
    fontWeight: '600',
    color: '#444',
    marginBottom: 6,
  },

  totalMain: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
    color: '#111',
  },

  confirmBtn: {
    backgroundColor: '#34C759',
    padding: 14,
    borderRadius: 12,
    marginTop: 14,
  },

  confirmText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },

  cartButton: {
    position: 'absolute',
    bottom: 25,
    right: 20,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',

    elevation: 6,
  },

  cartText: {
    color: '#fff',
    fontWeight: '700',
    marginLeft: 8,
    fontSize: 14,
  },
});
