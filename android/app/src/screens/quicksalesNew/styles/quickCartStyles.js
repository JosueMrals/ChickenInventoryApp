import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F8FB',
  },

  // ---------- HEADER ----------
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 8,
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    marginBottom: 10,
  },

  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    paddingRight: 240,
  },

  // ---------- CUSTOMER BOX ----------
  customerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },

  customerText: {
    marginLeft: 8,
    color: '#007AFF',
    fontWeight: '700',
    fontSize: 15,
  },

  // ---------- PRODUCT LIST ----------
  list: {
    paddingHorizontal: 12,
    paddingBottom: 180,
  },

  emptyBox: {
    alignItems: 'center',
    paddingTop: 80,
  },

  emptyText: {
    color: '#999',
    fontSize: 15,
  },

  // ---------- SUMMARY BOX ----------
  summary: {
    paddingBottom: 30,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    padding: 18,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    elevation: 15,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },

  label: {
    color: '#666',
    fontSize: 15,
  },

  value: {
    color: '#111',
    fontWeight: '700',
    fontSize: 15,
  },

  rowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ECECEC',
  },

  totalLabel: {
    fontSize: 17,
    fontWeight: '800',
    color: '#333',
  },

  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#007AFF',
  },

  checkoutBtn: {
    backgroundColor: '#007AFF',
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#007AFF',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    marginBottom:10
  },

  checkoutText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
