import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  statCard: {
    flex: 1,
    minHeight: 58,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  statTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  statValue: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  statTitle: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
});
