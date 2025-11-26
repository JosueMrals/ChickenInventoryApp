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
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E4E7EC",
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
  },

  cardAmount: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0A7",
    marginTop: 4,
  },
});
