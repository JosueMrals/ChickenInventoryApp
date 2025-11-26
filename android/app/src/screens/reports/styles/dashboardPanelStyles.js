import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: { padding: 18 },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 12 },
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
  label: { color: "#666", fontSize: 14 },
  value: { fontSize: 20, fontWeight: "700", marginTop: 4 },
  loading: { padding: 20 },
});
