import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    paddingTop: 40,
    flex: 1,
    backgroundColor: "#F5F7FA",  // gris claro profesional
  },

  /* HEADER --------------------------------------------------- */
  header: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#E4E4E4",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 3,
  },

  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
  },

  headerBtn: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    elevation: 2,
  },

  headerBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },

  /* LOADER --------------------------------------------------- */
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  /* LISTA ---------------------------------------------------- */
  listContent: {
    paddingBottom: 100,
    paddingHorizontal: 10,
  },

  emptyText: {
    textAlign: "center",
    marginTop: 50,
    fontSize: 16,
    color: "#888",
  },

  /* PRODUCT CARD --------------------------------------------- */
  card: {
    backgroundColor: "#fff",
    padding: 16,
    marginVertical: 6,
    borderRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#ececec",
  },

  name: {
    fontSize: 17,
    fontWeight: "600",
    color: "#222",
    marginBottom: 4,
  },

  barcode: {
    color: "#555",
    fontSize: 14,
  },

  price: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "700",
    color: "#0A84FF",
  },

  stock: {
    marginTop: 4,
    fontSize: 14,
    color: "#444",
  },

  actionBtn: {
    backgroundColor: "#0A84FF",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 10,
  },

  actionBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },

});
