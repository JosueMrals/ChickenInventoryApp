import { StyleSheet } from "react-native";

export default StyleSheet.create({
  card: {
    flexDirection: "row",
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 10,
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
    fontSize: 16,
    fontWeight: "bold",
    color: "#2C3E50",
  },

  subtitle: {
    fontSize: 14,
    color: "#7F8C8D",
    marginTop: 4,
  },

  discountText: {
    fontSize: 13,
    color: '#E74C3C',
    fontStyle: 'italic',
    marginTop: 4,
  },

  totalText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2980B9",
    marginTop: 8,
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  
  quantityDisplay: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#34495E',
    minWidth: 30,
    textAlign: 'center',
  },

  btn: {
    padding: 8,
    borderRadius: 20,
    marginHorizontal: 2,
  },
});