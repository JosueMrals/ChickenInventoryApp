import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FB",
    paddingTop: 10,
  },

  // 🔹 HEADER
  header: {
    paddingTop: 40,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginLeft: -28, // centra el texto ya que hay un botón a la derecha
  },
  customerButton: {
    paddingHorizontal: 6,
  },

  // 🔹 TOTAL A PAGAR
  amountBox: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 25,
    marginBottom: 10,
  },
  amountCurrency: {
    fontSize: 26,
    fontWeight: "600",
    color: "#333",
  },
  amountValue: {
    fontSize: 52,
    fontWeight: "800",
    color: "#333",
    marginTop: -8,
  },

  // 🔹 PROPINA
  tipButton: {
    alignSelf: "center",
    marginVertical: 6,
  },
  tipText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
  },

  // 🔹 GUARDAR PEDIDO / CRÉDITO
  actionRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 10,
    gap: 10,
  },
  disabledAction: {
    backgroundColor: "#EEE",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
  },
  disabledActionText: {
    color: "#777",
    fontWeight: "600",
  },

  // 🔹 GRID DE MÉTODOS DE PAGO
  methodsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 12,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  methodBox: {
    width: "30%",
    margin: "1.5%",
    backgroundColor: "#FFF",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DDD",
  },
  methodBoxActive: {
    borderColor: "#007AFF",
    backgroundColor: "#E9F2FF",
  },
  methodText: {
    marginTop: 6,
    fontSize: 13,
    color: "#444",
    textAlign: "center",
  },
  methodTextActive: {
    color: "#007AFF",
    fontWeight: "700",
  },

  // 🔹 INPUT DE MONTO
  payInputBox: {
    paddingHorizontal: 18,
    marginTop: 10,
  },
  payInputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  payInput: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DDD",
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
  },

  // 🔹 CAMBIO
  changeBox: {
    paddingHorizontal: 18,
    marginTop: 14,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  changeLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "#007AFF",
  },
  changeValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#007AFF",
  },

  // 🔹 BOTÓN FINALIZAR PAGO
  payButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 16,
    borderRadius: 30,
    marginHorizontal: 18,
    marginBottom: 20,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  payButtonText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 18,
  },

});
