import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    paddingTop: 40,
    flex: 1,
    backgroundColor: "#F7F8FA",
  },

  header: {
    paddingVertical: 14,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
  },

  receiptBox: {
    flex: 1,
    backgroundColor: "#fff",
    margin: 14,
    borderRadius: 14,
    padding: 16,
    elevation: 2,
  },

  bigCheck: {
    fontSize: 48,
    textAlign: "center",
    color: "#4CAF50",
    marginBottom: 4,
  },
  successText: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
    color: "#333",
  },

  section: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  label: {
    fontSize: 15,
    color: "#666",
  },
  value: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  discount: {
    fontSize: 15,
    fontWeight: "600",
    color: "#D32F2F",
  },

  separator: {
    height: 1,
    backgroundColor: "#DDD",
    marginVertical: 12,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
    color: "#333",
  },

  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 6,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  itemDetails: {
    fontSize: 14,
    color: "#666",
  },
  itemTotal: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 4,
  },

  totalLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
  },

  footerText: {
    textAlign: "center",
    marginTop: 8,
    fontSize: 14,
    color: "#777",
  },

  shareButton: {
    backgroundColor: "#007AFF",
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 30,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  shareText: {
    color: "#fff",
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "600",
  },

  newSaleButton: {
    backgroundColor: "#EDEDED",
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 30,
    paddingVertical: 14,
  },
  newSaleText: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
});
