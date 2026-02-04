import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    paddingTop: 50,
    paddingBottom: 30,
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111",
  },

  label: {
    fontSize: 16,
    color: "#333",
    marginTop: 12,
    marginBottom: 6,
  },

  input: {
    backgroundColor: "#F2F2F2",
    padding: 12,
    borderRadius: 10,
    fontSize: 16,
  },

  saveBtn: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },

  saveText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
});
