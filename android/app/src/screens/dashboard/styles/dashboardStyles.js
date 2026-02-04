import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  // --- Stats Styles ---
  statsContainer: {
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
  },
  statRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  statCardWrapper: {
    paddingHorizontal: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginHorizontal: 25,
    marginBottom: 15,
    marginTop: 10,
  },
  // --- Modules Styles ---
  modulesContainer: {
    paddingHorizontal: 15,
  },
  moduleRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  moduleCardWrapper: {
    paddingHorizontal: 5,
  },
  // --- General Styles ---
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA'
  },
  loadingText: {
    marginTop: 20,
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '600'
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#C7C7CC',
    fontWeight: '500',
  },
});
