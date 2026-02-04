import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F8FB',
  },

  // ---------- HEADER ----------
  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    marginBottom: 10,
    },

    title: {
        fontSize: 22,
        fontWeight: '800',
        color: '#fff',
        paddingLeft: 10,
    },

  // ---------- SEARCH ----------
  search: {
    backgroundColor: '#FFF',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    fontSize: 15,
    elevation: 2,
  },

  // ---------- LIST ----------
  list: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 40,
  },

  card: {
    backgroundColor: '#FFF',
    padding: 14,
    marginHorizontal: 10,
    marginVertical: 8,
    flex: 1,
    borderRadius: 14,
    elevation: 3,
    minHeight: 90,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },

  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },

  phone: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
  },

  // ---------- EMPTY STATE ----------
  emptyBox: {
    paddingTop: 80,
    alignItems: 'center',
  },

  emptyText: {
    color: '#999',
    fontSize: 15,
  },
});
