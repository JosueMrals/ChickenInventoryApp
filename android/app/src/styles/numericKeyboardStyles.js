import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    marginTop: 6,
  },

  keyWrapper: {
    width: "32%",
    aspectRatio: 1.8,
    marginVertical: 4,
  },

  key: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },

  keyConfirm: {
    backgroundColor: "#007AFF",
  },

  keyText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111",
  },

  keyDeleteText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#DC2626",
  },
});
