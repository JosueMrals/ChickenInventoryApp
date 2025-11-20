import { StyleSheet, Dimensions } from 'react-native';
const { width } = Dimensions.get('window');

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 18,
    paddingHorizontal: 16,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 8, color: '#666' },

  header: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    color: '#111',
    paddingTop: 30
  },

  search: {
    backgroundColor: '#F2F4F8',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: '#111' },
  nameLarge: { fontSize: 20, fontWeight: '800', color: '#111' },
  text: { color: '#444', marginTop: 4 },
  smallText: { color: '#777', fontSize: 12 },

  tagColumn: { alignItems: 'flex-end' },
  typeBadge: {
    backgroundColor: '#F2F6FF',
    color: '#0B60FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontWeight: '700',
    overflow: 'hidden',
    alignSelf: 'flex-end',
  },

  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center' },

  fab: {
    position: 'absolute',
    bottom: 28,
    right: 18,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },

  input: {
    borderWidth: 1,
    borderColor: '#ECECEC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  inputDisabled: {
    backgroundColor: '#F5F5F7',
  },

  label: { fontSize: 13, color: '#555', marginBottom: 6, marginTop: 6 },

  typeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E6E6E6',
  },
  typeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  typeText: { color: '#333' },
  typeTextActive: { color: '#fff' },

  rowButtons: { flexDirection: 'row', marginTop: 12 },
  btnPrimary: { flex: 1, backgroundColor: '#007AFF', padding: 12, borderRadius: 8, alignItems: 'center', marginRight: 8 },
  btnCancel: { flex: 1, backgroundColor: '#FF3B30', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },

  section: { marginTop: 14, paddingVertical: 8 },
  sectionTitle: { fontWeight: '700', color: '#111', marginBottom: 6 },

  tabs: { flexDirection: 'row', marginVertical: 8, gap: 8 },
  tabButton: { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ECECEC', marginRight: 8 },
  tabActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  tabText: { color: '#444' },
  tabTextActive: { color: '#fff' },

  saleRow: {
    backgroundColor: '#FAFBFF',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
