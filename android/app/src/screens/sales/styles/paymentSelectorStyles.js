import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
    color: '#222',
  },

  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  paymentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },

  paymentLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    color: '#333',
  },

  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    padding: 10,
    borderRadius: 10,
    marginTop: 8,
    fontSize: 14,
  },

  label: {
    marginTop: 8,
    fontSize: 13,
    color: '#444',
    fontWeight: '600',
  },

  creditBox: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4FF',
    borderWidth: 1,
    borderColor: '#DDE0FF',
    marginTop: 8,
  },

  creditText: {
    color: '#333',
  },

  totalBox: {
    marginTop: 14,
    padding: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EEE',
  },

  totalText: {
    fontSize: 16,
    color: '#111',
    marginBottom: 4,
  },

  pendingText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#444',
  },
});
