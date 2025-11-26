// panelsStyles.js
import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: { flex: 1, padding: 14, backgroundColor: "#F6F7FB" },

  // Header small inside panels
  smallHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  panelTitle: { fontSize: 16, fontWeight: "700", color: "#111" },
  panelSubtitle: { fontSize: 12, color: "#666" },

  // KPI cards
  kpiRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  kpiCard: { flex: 1, backgroundColor: "#fff", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#E8EBF0", elevation: 2 },
  kpiLabel: { fontSize: 12, color: "#666" },
  kpiValue: { fontSize: 20, fontWeight: "800", marginTop: 6, color: "#111" },
  kpiDelta: { fontSize: 12, marginTop: 6 },

  // Chart box
  chartBox: { backgroundColor: "#fff", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#E8EBF0", marginBottom: 12 },
  smallChartTitle: { fontSize: 13, fontWeight: "700", marginBottom: 8 },

  // lists
  listItem: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F3F6" },
  listLabel: { fontSize: 14, color: "#222" },
  listValue: { fontSize: 14, fontWeight: "700", color: "#111" },

  // bars for ranking
  barRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  barLabel: { width: 100, fontSize: 13, color: "#333" },
  barContainer: { flex: 1, height: 10, backgroundColor: "#F0F2F5", borderRadius: 6, overflow: "hidden" },
  barFill: { height: 10, borderRadius: 6 },

  // low stock badge
  lowStock: { color: "#FF3B30", fontWeight: "700" },

  // small helpers
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
