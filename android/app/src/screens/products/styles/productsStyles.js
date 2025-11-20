import { StyleSheet } from 'react-native';

export default StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F6FA' },
    header: {
    backgroundColor: '#007AFF',
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    },
    title: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 25 },
    headerBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
    marginTop: 25
    },
    headerBtnText: { color: '#fff', fontWeight: '700', },

    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    card: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginVertical: 6,
    elevation: 2,
    alignItems: 'center',
    },
    name: { fontSize: 16, fontWeight: '700', color: '#222' },
    info: { color: '#007AFF', marginTop: 4 },
    subInfo: { color: '#666', marginTop: 4 },

    editBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
    },
    editBtnText: { color: '#fff', fontWeight: '700' },

    modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    },
    modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 8,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10 },

    input: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
    },

    btn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
    btnPrimary: { backgroundColor: '#007AFF', marginRight: 6 },
    btnCancel: { backgroundColor: '#FF3B30', marginLeft: 6 },
    btnText: { color: '#fff', fontWeight: '700' },

    // 🔍 Buscador
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fff',
      borderRadius: 10,
      marginHorizontal: 12,
      marginVertical: 10,
      paddingHorizontal: 6,
      borderWidth: 1,
      borderColor: '#eee',
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      paddingVertical: 8,
      color: '#222',
    },

});
