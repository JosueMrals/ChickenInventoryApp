import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    paddingTop: 30,
    flex: 1,
    backgroundColor: "#F8F9FE",
    padding: 16,
  },

  header: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
    color: "#111",
  },

  selectedBox: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
  },

  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },

  noPrinter: {
    fontSize: 14,
    color: "#666",
  },

  selectedName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1565C0",
  },

  selectedAddress: {
    fontSize: 12,
    color: "#777",
  },

  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  subTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },

  deviceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    gap: 10,
    elevation: 2,
  },

  deviceName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },

  testBtn: {
    marginTop: 20,
    backgroundColor: "#007AFF",
    padding: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  testText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },

  settingsBtn: {
    backgroundColor: "#34C759",
    padding: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },

  settingsText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },

  selectedContainer: {
    backgroundColor: "#E3F2FD",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#90CAF9",
  },

  selectedLabel: {
    fontSize: 12,
    color: "#555",
    marginBottom: 2,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalBox: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 16,
    width: "80%",
    alignItems: "center",
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
    color: "#333",
  },

  testButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    width: "100%",
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },

  closeBtn: {
    paddingVertical: 12,
    width: "100%",
    alignItems: "center",
  },

  closeText: {
    fontSize: 16,
    color: "#FF3B30",
    fontWeight: "600",
  },

  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 20,
    fontSize: 16,
  },

  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 10,
  },

  cancelBtn: {
    flex: 1,
    padding: 12,
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 8,
  },

  cancelText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
  },

  saveBtn: {
    flex: 1,
    padding: 12,
    alignItems: "center",
    backgroundColor: "#007AFF",
    borderRadius: 8,
  },

  saveText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  iconBtn: {
    padding: 8,
  },

  rowActions: {
      flexDirection: "row",
      alignItems: "center",
  }
});
