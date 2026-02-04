import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export const warehouseStyles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: '#f5f5f7' },
  contentContainer: { flex: 1, paddingHorizontal: 8 },

  // Tabs Styles
  tabContainer: { flexDirection: 'row', backgroundColor: 'white', margin: 10, borderRadius: 12, padding: 4 },
  tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8 },
  activeTabButton: { backgroundColor: '#F0F0FF' },
  tabText: { marginLeft: 8, fontWeight: '600', color: '#888', fontSize: 14 },
  activeTabText: { color: '#5856D6' },

  emptyText: { textAlign: 'center', marginTop: 10, fontSize: 16, color: '#888' },

  // List Item Styles
  itemContainer: { backgroundColor: 'white', padding: 15, marginVertical: 6, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  itemTitle: { fontSize: 16, fontWeight: 'bold', marginLeft: 8, color: '#333' },

  customerContainer: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  customerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  customerText: { fontSize: 16, fontWeight: '600', color: '#333' },
  customerSubText: { fontSize: 14, color: '#888' },

  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemText: { fontSize: 14, color: '#666' },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: 'white', fontWeight: '700', fontSize: 12, textTransform: 'capitalize' },
  dateText: { fontSize: 12, color: '#999' },

  // Dashboard Panel Styles
  dashboardContainer: { flex: 1, padding: 10 },
  dashboardSection: { marginBottom: 20 },
  sectionHeader: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.5 },

  statsContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  statCard: { flex: 1, padding: 15, borderRadius: 16, alignItems: 'center', marginHorizontal: 5, borderWidth: 1, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, backgroundColor: 'white' },
  statNumber: { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 5 },
  statLabel: { fontSize: 12, color: '#666', marginTop: 2 },

  statusRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'white', padding: 10, borderRadius: 16, elevation: 1 },
  statusItem: { flex: 1, alignItems: 'center', borderLeftWidth: 3, paddingLeft: 5 },
  statusCount: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  statusLabel: { fontSize: 10, color: '#888' },

  dashboardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: 12, borderRadius: 12, marginVertical: 4, elevation: 1 },
  rowInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  bulletPoint: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#5856D6', marginRight: 10 },
  rowName: { fontSize: 14, fontWeight: '600', color: '#333' },
  rowValueContainer: { alignItems: 'flex-end' },
  rowValue: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  rowUnit: { fontSize: 10, color: '#999' },

  // Handover Button
  handoverButton: {
    backgroundColor: '#34C759',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    marginTop: 20,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5
  },
  handoverButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8
  }
});
