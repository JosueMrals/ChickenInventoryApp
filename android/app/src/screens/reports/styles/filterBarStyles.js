import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E4E7EB",
  },

  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  pill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#F1F3F6",
  },

  pillActive: {
    backgroundColor: "#007AFF20",
    borderWidth: 1,
    borderColor: "#007AFF",
  },

  pillLabel: {
    fontSize: 13,
    color: "#333",
    fontWeight: "500",
  },

  pillLabelActive: {
    color: "#007AFF",
    fontWeight: "700",
  },

  rangeRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  rangeText: {
    fontSize: 13,
    color: "#444",
    fontWeight: "600",
  },

  clearText: {
    fontSize: 13,
    color: "#FF3B30",
    fontWeight: "700",
  },
});
