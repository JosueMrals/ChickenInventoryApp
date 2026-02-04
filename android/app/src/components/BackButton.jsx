import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

export default function BackButton({ tint = "#111" }) {
  const navigation = useNavigation();

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else console.log("No previous screen in stack");
  };

  return (
    <TouchableOpacity style={styles.button} onPress={goBack}>
      <Icon name="chevron-back" size={26} color={tint} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    elevation: 3,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    alignSelf: "flex-start",
    marginTop: 30,
  },
});
