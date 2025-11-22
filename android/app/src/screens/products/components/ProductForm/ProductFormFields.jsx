import React from "react";
import { View, Text, TextInput } from "react-native";
import styles from "../../styles/productFormStyles";

export default function ProductFormFields({
  isAdmin,
  name,
  setName,
  barcode,
  setBarcode,
  description,
  setDescription
}) {
  return (
    <>
      <Text style={styles.label}>Nombre</Text>
      <TextInput
        editable={isAdmin}
        style={styles.input}
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Código de barras</Text>
      <TextInput
        editable={isAdmin}
        style={styles.input}
        value={barcode}
        onChangeText={setBarcode}
      />

      <Text style={styles.label}>Descripción</Text>
      <TextInput
        editable={isAdmin}
        style={[styles.input, { height: 70, textAlignVertical: "top" }]}
        multiline
        value={description}
        onChangeText={setDescription}
      />
    </>
  );
}
