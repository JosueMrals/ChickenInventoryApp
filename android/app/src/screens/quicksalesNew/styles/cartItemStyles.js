import { StyleSheet } from "react-native";

export default StyleSheet.create({
  card: {
    flexDirection: "row",
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 10,
    elevation: 2,
  },

  left: {
    flex: 1,
  },

  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111",
  },

  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 4,
  },

  totalText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#007AFF",
    marginTop: 6,
  },

  actions: {
    justifyContent: "space-between",
    alignItems: "center",
  },

  btn: {
    padding: 5,
  },
});

