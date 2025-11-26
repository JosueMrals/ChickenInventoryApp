import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: { padding: 18 },
  row: { flexDirection: "row", marginBottom: 14 },
  card: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 14,
    marginRight: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E4E7EC",
  },
  cardWide: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E4E7EC",
  },
  label: { color: "#666", fontSize: 14 },
  value: { fontSize: 20, fontWeight: "700", marginTop: 4 },
  chartBox: {
    marginTop: 16,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E4E7EC",
  },
  chartTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  empty: { padding: 20, alignItems: "center" },
  emptyText: { color: "#666", fontSize: 15 },
  loading: { padding: 20 },
});
