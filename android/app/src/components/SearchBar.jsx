import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";

export default function SearchBar({
  value,
  placeholder,
  onChangeText,
  onClear, // Prop opcional para limpiar el campo
  style // Prop opcional para sobreescribir estilos del contenedor externo
}) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputContainer}>
        <Icon name="search" size={20} color="#999" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder || "Buscar..."}
          placeholderTextColor="#999"
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {value ? (
          <TouchableOpacity onPress={() => {
              if (onClear) onClear();
              else onChangeText(''); // Fallback por defecto
          }}>
            <Icon name="close-circle" size={20} color="#999" style={styles.clearIcon} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 10,
    marginTop: 10, // Un poco de margen superior por defecto
  },
  inputContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    height: 48,
    // Sombras y elevación para un look consistente
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }
  },
  icon: {
    marginRight: 8
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333'
  },
  clearIcon: {
      marginLeft: 8
  }
});
