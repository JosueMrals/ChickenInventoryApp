import { StyleSheet, Platform } from 'react-native';

export default StyleSheet.create({
  container: {
      flex: 1,
      backgroundColor: '#F4F1FA',
    },

    header: {
      paddingTop: 50,
      paddingHorizontal: 16,
      paddingBottom: 14,
      backgroundColor: '#007AFF',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
      marginBottom: 10,
      elevation: 8,
    },

    title: {
      fontSize: 22,
      fontWeight: '800',
      color: '#fff',
      flex: 1,
      paddingLeft: 10,
    },
});
