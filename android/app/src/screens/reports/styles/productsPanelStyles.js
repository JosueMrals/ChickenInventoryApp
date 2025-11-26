import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    padding: 16,
  },

  loadingContainer: {
    padding: 20,
    alignItems: "center",
  },

  emptyContainer: {
    padding: 20,
    alignItems: "center",
  },

  emptyText: {
    fontSize: 16,
    color: "#777",
    fontWeight: "500",
  },

  card: {
    flexDirection: "row",
    padding: 14,
    marginBottom: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    alignItems: "center",
  },

  productImage: {
    width: 58,
    height: 58,
    borderRadius: 8,
  },

  placeholderImage: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },

  placeholderText: {
    fontSize: 12,
    color: "#555",
  },

  infoBox: {
    marginLeft: 12,
    flex: 1,
  },

  productTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
    marginBottom: 4,
  },

  productStats: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },

  bold: {
    fontWeight: "800",
    color: "#111",
  },
});
