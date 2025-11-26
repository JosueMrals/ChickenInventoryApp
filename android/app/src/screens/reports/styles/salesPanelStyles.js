import { StyleSheet } from "react-native";

export default StyleSheet.create({

  container: {
    padding: 18,
  },

  loadingContainer: {
    padding: 20,
  },

  skeletonCard: {
    height: 60,
    backgroundColor: "#E7EBF0",
    borderRadius: 12,
    marginBottom: 12,
  },

  skeletonChart: {
    height: 220,
    backgroundColor: "#E7EBF0",
    borderRadius: 12,
    marginTop: 10,
  },

  emptyContainer: {
    padding: 30,
    alignItems: "center",
  },

  emptyText: {
    fontSize: 16,
    color: "#777",
    fontWeight: "500",
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E2E5EA",
    marginRight: 10,
  },

  cardLabel: {
    color: "#555",
    fontSize: 14,
    fontWeight: "500",
  },

  cardValue: {
    color: "#111",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 4,
  },

  chartBox: {
    marginTop: 16,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    borderColor: "#E2E5EA",
    borderWidth: 1,
  },

  chartTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    color: "#222",
  },

});
