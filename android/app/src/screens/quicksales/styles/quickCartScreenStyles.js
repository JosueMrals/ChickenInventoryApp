import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
    padding: 14,
  },

  header: {
    fontSize: 28,
    fontWeight: '800',
    color: '#222',
    marginBottom: 12,
  },

  cartItemContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    alignItems: 'center',
  },

  footer: {
    borderTopWidth: 1,
    borderColor: '#eef',
    paddingTop: 12,
  },

  totalText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111',
    marginBottom: 10,
  },

  payBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },

  payText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
});
