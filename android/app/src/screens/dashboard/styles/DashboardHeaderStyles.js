import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  header: {
    paddingHorizontal: 25,
    paddingTop: 40,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: '#1A1A1A',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
    fontWeight: '500',
  },
  logoutButton: {
    padding: 10,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
  },
});
