import { StyleSheet } from "react-native";

export default StyleSheet.create({
  card: {
    backgroundColor: "#FFF",
    padding: 18,
    borderRadius: 14,
    elevation: 3,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: "#222",
  },
  description: {
    marginTop: 2,
    fontSize: 14,
    color: "#666"
  },
  code: {
    fontSize: 13,
    color: "#555",
    marginTop: 4,
  },
  priceBuy: {
    marginTop: 8,
    fontSize: 15,
    color: "#FF9500",
    fontWeight: "600"
  },
  priceSale: {
    marginTop: 3,
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "700"
  },
  stock: {
    marginTop: 6,
    fontSize: 14,
    color: "#222"
  },
  stockBtn: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "#0A84FF",
    borderRadius: 8
  },
  stockText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14
  }
});
