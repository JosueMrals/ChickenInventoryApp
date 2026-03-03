import { StyleSheet } from "react-native";

export default StyleSheet.create({
  card: {
    flexDirection: "row",
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EAECEE',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  // --- Estilos para Bonificaciones ---
  bonusCard: {
    backgroundColor: '#E6F7FF', // Un color de fondo suave para destacar
    borderColor: '#91D5FF',
  },
  bonusTag: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  bonusTagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  // --- Fin Estilos Bonificaciones ---

  left: {
    flex: 1,
    justifyContent: 'center',
  },

  title: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#2C3E50",
    flexShrink: 1,
    marginRight: 8,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },

  subtitle: {
    fontSize: 12,
    color: "#7F8C8D",
    marginTop: 0,
  },

  discountText: {
    fontSize: 12,
    color: '#E74C3C',
    fontStyle: 'italic',
    marginTop: 4,
  },

  totalText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#2980B9",
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  
  quantityDisplay: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#34495E',
    minWidth: 34,
    textAlign: 'center',
    paddingVertical: 4,
  },

  quantityInput: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#34495E',
    minWidth: 34,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderColor: '#007AFF',
    paddingVertical: 4,
    marginHorizontal: 4,
  },

  btn: {
    padding: 6,
    borderRadius: 18,
    marginHorizontal: 2,
  },
});
