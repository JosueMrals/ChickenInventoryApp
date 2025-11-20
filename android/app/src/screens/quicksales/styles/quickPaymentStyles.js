import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F9FC",
    padding: 14,
  },

  header: {
    fontSize: 28,
    fontWeight: "800",
    color: "#222",
    marginBottom: 16,
  },

  label: {
    fontSize: 15,
    fontWeight: "700",
    color: "#444",
    marginBottom: 6,
  },

  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    fontSize: 16,
    color: "#222",
  },

  paymentMethods: {
    flexDirection: "row",
    marginBottom: 14,
  },

  methodBtn: {
    flex: 1,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    marginRight: 8,
    alignItems: "center",
    backgroundColor: "#F1F1F1",
  },

  methodActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },

  methodText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
  },

  totalSummary: {
    fontSize: 18,
    fontWeight: "600",
    color: "#222",
    marginBottom: 14,
    marginTop: 10,
    lineHeight: 28,
  },

  payBtn: {
    backgroundColor: "#34C759",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },

  payText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
});
