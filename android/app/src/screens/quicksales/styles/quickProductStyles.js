import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#fff',
    margin: 6,
    padding: 14,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },

    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },

  price: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },

  qtyOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  qtyModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '85%',
  },

  qtyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111',
    marginBottom: 10,
    textAlign: 'center',
  },

  qtyInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 14,
    fontSize: 16,
    textAlign: 'center',
  },

  qtyButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  cancelBtn: {
    flex: 1,
    backgroundColor: '#ddd',
    padding: 12,
    borderRadius: 10,
    marginRight: 8,
  },

  cancelText: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#555',
  },

  addBtn: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 10,
    marginLeft: 8,
  },

  addText: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#fff',
  },
});
