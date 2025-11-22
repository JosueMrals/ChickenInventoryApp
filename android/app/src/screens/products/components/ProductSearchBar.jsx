import React, { useEffect, useState } from "react";
import { View, TextInput, TouchableOpacity, Text } from "react-native";
import styles from "../styles/searchBarStyles";

export default function ProductSearchBar({ search, setSearch }) {
  const [localValue, setLocalValue] = useState("");

  // Sincronizar cuando search viene vacío desde fuera
  useEffect(() => {
    if (!search) setLocalValue("");
  }, [search]);

  // Debounce — evita recalcular en cada tecla
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(typeof localValue === "string" ? localValue : "");
    }, 300);

    return () => clearTimeout(timeout);
  }, [localValue]);

  const handleClear = () => {
    setLocalValue("");
    setSearch("");
  };

  return (
    <View style={styles.container}>
      {/* Ícono */}
      <Text style={styles.icon}>🔍</Text>

      {/* Input */}
      <TextInput
        style={styles.input}
        placeholder="Buscar producto..."
        placeholderTextColor="#999"
        value={localValue}
        onChangeText={(text) => {
          setLocalValue(typeof text === "string" ? text : "");
        }}
      />

      {/* Botón limpiar */}
      {localValue?.length > 0 && (
        <TouchableOpacity onPress={handleClear}>
          <Text style={styles.clear}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
