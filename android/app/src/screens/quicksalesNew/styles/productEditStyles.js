import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  // ------- HEADER -------
  headerRow: {
    paddingTop: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
  },

  optionalButton: {
    fontSize: 14,
    color: "#FF3B30",
    fontWeight: "600",
  },

  // ------- MAIN LABEL -------
  mainLabel: {
    marginTop: 40,
    textAlign: "center",
    fontSize: 16,
    color: "#444",
    marginBottom: 12,
  },

  // ------- EDIT BOX (same style as quantity box) -------
  editBox: {
    borderWidth: 2,
    borderColor: "#007AFF",
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: "center",
    width: 210,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  editText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111",
  },

  editDelete: {
    width: 32,
    height: 32,
    borderRadius: 18,
    backgroundColor: "#F3F3F3",
    justifyContent: "center",
    alignItems: "center",
  },

  // ------- INFO ROWS -------
  infoContainer: {
    marginTop: 20,
    marginBottom: 6,
    paddingHorizontal: 20,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },

  infoLabel: {
    fontSize: 14,
    color: "#666",
  },

  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111",
  },

  // ------- REMOVE BUTTON -------
  removeText: {
    textAlign: "center",
    marginTop: 10,
    color: "#FF3B30",
    fontSize: 14,
    fontWeight: "600",
  },

  // ------- NUMERIC KEYBOARD SPACER -------
  keyboardSpacer: {
    flex: 1,
  },

  // ------- FLOATING ACTION BUTTON -------
  fab: {
    position: "absolute",
    right: 20,
    bottom: 30,
    backgroundColor: "#007AFF",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,

    shadowColor: "#007AFF",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },

  fabIcon: {
    fontSize: 34,
    color: "#fff",
  },

  // ------- SUBTEXT (description, unit price, etc.) -------
  subLabel: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 13,
    color: "#666",
  },
});
