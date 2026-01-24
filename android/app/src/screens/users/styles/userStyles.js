import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  header: {
    paddingTop: 50,
    padding: 16,
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    paddingTop: 10,
  },
  headerIcon: {
    color: '#fff',
    fontSize: 18,
    paddingTop: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    backgroundColor: '#007AFF',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 10,
  },
  buttonPrimary: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 5,
  },
  buttonCancel: {
    flex: 1,
    backgroundColor: '#FF3B30',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  listItemContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 10,
    marginVertical: 6,
    borderRadius: 14,
    padding: 16,
    elevation: 2,
  },
  listItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  listItemEmail: {
    fontSize: 16,
    fontWeight: '600',
  },
  listItemText: {
    color: '#777',
    fontSize: 14,
  },
  listItemVerified: {
    fontSize: 13,
    fontWeight: '600',
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontWeight: '700',
  },
});
