import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E2E2E2",
  },

  icon: {
    fontSize: 18,
    marginRight: 8,
    color: "#555",
  },

  input: {
    flex: 1,
    fontSize: 16,
    color: "#222",
  },

  clear: {
    marginLeft: 6,
    fontSize: 20,
    color: "#666",
    paddingHorizontal: 4,
  }
});
