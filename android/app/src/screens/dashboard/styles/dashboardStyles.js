import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  // --- Large Title ---
  largeTitleBlock: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 20,
  },
  largeTitleGreeting: {
    fontSize: 30,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  largeTitleSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '600',
    marginTop: 4,
  },
  // --- Grouped sections ---
  sectionsContainer: {
    paddingHorizontal: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionWrapper: {
    marginBottom: 24,
  },
  // --- General Styles ---
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F4F8',
  },
  loadingText: {
    marginTop: 20,
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '600',
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
