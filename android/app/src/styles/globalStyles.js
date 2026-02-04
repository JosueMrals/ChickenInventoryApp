import { StyleSheet, Platform } from 'react-native';

export default StyleSheet.create({
  container: {
      flex: 1,
      backgroundColor: '#F5F6FA',
    },

    header: {
      paddingTop: 50,
      paddingHorizontal: 16,
      paddingBottom: 10,
      backgroundColor: '#007AFF',
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomLeftRadius: 14,
      borderBottomRightRadius: 14,
      marginBottom: 10,
    },

    title: {
      fontSize: 22,
      fontWeight: '800',
      color: '#fff',
      paddingLeft: 10,
    },
});
