import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export default StyleSheet.create({
  statCard: {
    width: (width - 50) / 3, // 2 columns
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 8,
    marginBottom: 12,
    flexDirection: 'row', // Horizontal
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    elevation: 0.5,
  },
  statIconContainer: {
    width: 25,
    height: 30,
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
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  statTitle: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
  },
});
