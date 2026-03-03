import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },

  // -------- HEADER --------
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

  customerBtn: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 50,
    elevation: 4,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    position: 'absolute',
    right: 16,
    bottom: 10,
  },

  customerAssignedBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#EAF2FF",
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 6,
    padding: 10,
    borderRadius: 10,
  },

  customerAssigned: {
    color: "#007AFF",
    fontWeight: "700",
    fontSize: 15,
  },

  // -------- SEARCH BAR --------
  search: {
    backgroundColor: '#FFF',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    fontSize: 15,
    elevation: 2,
  },

  // -------- PRODUCT CARDS --------
  card: {
    backgroundColor: '#FFF',
    padding: 10,
    marginHorizontal: 6,
    marginVertical: 6,
    flex: 1,
    borderRadius: 12,
    elevation: 2,
    minHeight: 86,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },

  cardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },

  cardPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 0,
  },

  // -------- CART BUTTON --------
  cartButton: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#007AFF',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },

  cartButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

});
