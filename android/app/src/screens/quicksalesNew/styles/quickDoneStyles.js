import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6FA',
    padding: 20,
    justifyContent: 'center',
  },

  header: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111',
    textAlign: 'center',
    marginBottom: 26,
  },

  box: {
    backgroundColor: '#FFF',
    padding: 22,
    borderRadius: 20,
    marginBottom: 30,

    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.09,
    shadowRadius: 8,
  },

  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
    color: '#111',
    textAlign: 'center',
  },

  row: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },

  rowSmall: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },

  shareButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 20,
  },

  shareText: {
    color: '#FFF',
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 17,
  },

  newSaleButton: {
    backgroundColor: '#34C759',
    paddingVertical: 14,
    borderRadius: 16,
  },

  newSaleText: {
    color: '#FFF',
    fontWeight: '800',
    textAlign: 'center',
    fontSize: 17,
  },
});
