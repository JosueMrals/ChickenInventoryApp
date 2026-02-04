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
    fontWeight: "600",
    color: "#007AFF",
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
});
