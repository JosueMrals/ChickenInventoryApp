import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    marginTop: 10,
  },

  keyWrapper: {
    width: "32%",
    aspectRatio: 1,
    marginVertical: 8,
  },

  key: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },

  keyConfirm: {
    backgroundColor: "#007AFF",
  },

  keyText: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111",
  },
});
