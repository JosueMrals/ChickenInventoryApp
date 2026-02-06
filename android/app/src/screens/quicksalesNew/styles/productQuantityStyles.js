import { StyleSheet } from "react-native";

export default StyleSheet.create({


  complimentary: {
    fontSize: 14,
    color: "#FF3B30",
    fontWeight: "600",
  },

  // ------- QUANTITY -------
  quantityLabel: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 16,
    color: "#444",
    marginBottom: 10,
  },

  quantityBox: {
    borderWidth: 2,
    borderColor: "#007AFF",
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: "center",
    width: 220,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  quantityText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111",
  },

  quantityDelete: {
    width: 32,
    height: 32,
    borderRadius: 20,
    backgroundColor: "#F3F3F3",
    justifyContent: "center",
    alignItems: "center",
  },

  removeText: {
    textAlign: "center",
    marginTop: 8,
    color: "#FF3B30",
    fontSize: 14,
    fontWeight: "600",
  },
  removeProductButton: {
      marginTop: 10,
    },

    removeProductText: {
      color: "#FF3B30",
      fontSize: 16,
      marginTop: 4,
      fontWeight: "600",
    },

  // ------- FLOATING BUTTON -------
  fab: {
    position: "absolute",
    right: 20,
    bottom: 30,
    backgroundColor: "#007AFF",
    width: 58,
    height: 58,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",

    elevation: 6,
    shadowColor: "#007AFF",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
