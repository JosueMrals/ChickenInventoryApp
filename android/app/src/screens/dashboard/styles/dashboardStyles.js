import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    },
  headerTitle: {
      color: '#fff',
      fontSize: 22,
      fontWeight: '700',
      marginTop: 25,
    },
  headerSubtitle: { fontSize: 16, color: '#fff' },
  headerContent: {
    flex: 1,
  },
  logoutButton: {
    padding: 8,
  },

  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 10,
  },
  statCard: {
    flexBasis: '48%',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  statValue: { color: '#fff', fontSize: 22, fontWeight: '800' },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 25,
    marginLeft: 5,
    color: '#333',
  },
  modulesList: { paddingBottom: 30 },
  moduleCard: {
    flex: 1,
    borderRadius: 16,
    margin: 10,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  moduleLabel: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 8 },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#555' },
  footer: { alignItems: 'center', marginTop: 10 },
  footerText: { fontSize: 13, color: '#aaa', marginBottom: 20 },
});
