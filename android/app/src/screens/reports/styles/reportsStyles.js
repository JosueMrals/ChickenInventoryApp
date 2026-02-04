import { StyleSheet } from "react-native";

export default StyleSheet.create({

  container: {
    paddingTop: 40,
    marginBottom: 10,
    flex: 1,
    backgroundColor: "#F6F7FB",
  },

  header: {
    padding: 20,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#ECECEC",
    elevation: 1
  },

  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1A1A1A",
  },

  subtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 4
  },

  tabsContainer: {
    flexGrow: 0,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#EAEAEA",
  },

  tabButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },

  tabButtonActive: {
    borderBottomWidth: 3,
    borderBottomColor: "#007AFF",
  },

  tabLabel: {
    fontSize: 15,
    color: "#555",
  },

  tabLabelActive: {
    fontSize: 15,
    color: "#007AFF",
    fontWeight: "700",
  },

  exportButton: {
    position: "absolute",
    bottom: 30,
    right: 20,
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    elevation: 4
  },

  exportButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600"
  }

});
