import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 380,
    padding: 20,
    alignItems: 'center',
    elevation: 6,
  },
  checkContainer: {
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    color: '#34A853',
  },
  detailsBox: {
    width: '100%',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
    paddingVertical: 10,
    marginBottom: 15,
  },
  label: {
    fontWeight: '600',
    color: '#555',
  },
  value: {
    color: '#222',
    marginBottom: 4,
  },
  buttons: {
    width: '100%',
    alignItems: 'center',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    marginVertical: 4,
    width: '100%',
  },
  btnWhatsApp: {
    backgroundColor: '#25D366',
  },
  btnClose: {
    backgroundColor: '#007AFF',
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    marginLeft: 6,
  },
  noPhone: {
    color: '#888',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  btnEdit: {
    backgroundColor: '#F4B400',
  },
  receiptNumber: {
    fontWeight: '700',
    fontSize: 16,
    color: '#007AFF',
    marginBottom: 8,
  },


});
