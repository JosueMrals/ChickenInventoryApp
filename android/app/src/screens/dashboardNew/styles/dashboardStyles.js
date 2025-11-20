import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 50,
  },

  /* HEADER */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  logo: {
    fontSize: 26,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  customerButton: {
    padding: 6,
  },
  headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },

    headerRightText: {
      fontSize: 15,
      color: '#333',
    },

  /* EMPTY STATE */
  emptyContainer: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 30,
  },
  emptyImage: {
    width: 140,
    height: 140,
    marginBottom: 20,
    opacity: 0.9,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#222',
    marginBottom: 8,
  },
  emptySubtitle: {
    textAlign: 'center',
    fontSize: 15,
    color: '#666',
    marginBottom: 22,
  },
  primaryBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 10,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },

  /* BOTTOM BAR */
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#F8F8F8',
    paddingVertical: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: '#E5E5E5',
  },
  orderBubble: {
    backgroundColor: '#FFF',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  orderText: {
    color: '#222',
    fontWeight: '500',
  },
  totalText: {
    color: '#777',
    fontSize: 15,
  },

});
