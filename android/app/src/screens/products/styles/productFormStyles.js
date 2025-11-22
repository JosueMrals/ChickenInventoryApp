import { StyleSheet } from "react-native";

export default StyleSheet.create({
  /* Fondo oscuro detrás del modal ----------------------------- */
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  /* Caja del modal -------------------------------------------- */
  modal: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    elevation: 10,
  },

  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#222",
    marginBottom: 12,
  },

  /* Labels ---------------------------------------------------- */
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444",
    marginTop: 12,
    marginBottom: 5,
  },

  /* Inputs ----------------------------------------------------- */
  input: {
    backgroundColor: "#F5F7FA",
    borderWidth: 1,
    borderColor: "#D4D7DD",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#222",
  },

  /* Selección de tipo de medida ------------------------------- */
  measureRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },

  measureBtn: {
    flex: 1,
    backgroundColor: "#F1F1F1",
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D4D7DD",
  },

  measureActive: {
    backgroundColor: "#007AFF20",
    borderColor: "#007AFF",
  },

  /* Botones del modal ----------------------------------------- */
  btnRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },

  cancelBtn: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#E4E7EB",
    borderRadius: 10,
    alignSelf: "flex-start",
  },

  cancelText: {
    fontSize: 15,
    color: "#333",
    fontWeight: "600",
  },

  saveBtn: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#007AFF",
    borderRadius: 10,
    alignSelf: "flex-start",
  },

  saveText: {
    fontSize: 15,
    color: "#FFF",
    fontWeight: "700",
  },

  /* Botón de ingreso de stock --------------------------------- */
  stockBtn: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#0A84FF",
    borderRadius: 10,
    alignSelf: "flex-start",
  },

  stockText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },

  /* Botón eliminar -------------------------------------------- */
  deleteBtn: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#FF3B30",
    borderRadius: 10,
    alignSelf: "flex-start",
  },

  deleteText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 15,
  },

  /* MODAL PARA INCREMENTAR STOCK ------------------------------- */
  stockModalBox: {
    width: "90%",
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 16,
    elevation: 12,
  },
});
