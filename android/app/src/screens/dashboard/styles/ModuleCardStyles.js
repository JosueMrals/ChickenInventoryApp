import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  moduleCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    margin: 6, // Reduced margin for 3 columns
    paddingVertical: 20,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  moduleIconContainer: {
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  moduleLabel: {
    color: '#1A1A1A',
    fontSize: 14, // Reduced font size for 3 columns
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
});
