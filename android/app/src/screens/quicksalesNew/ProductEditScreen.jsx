import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import NumericKeyboard from '../../components/common/NumericKeyboard';
import styles from './styles/productEditStyles';

export default function ProductEditScreen({ route, navigation }) {
  const { item, onUpdate } = route.params;
  const [qty, setQty] = useState(String(item.quantity || 1));
  const [price, setPrice] = useState(String(item.price || 0));

  const save = () => {
    const q = Number(qty) || 0;
    const p = Number(price) || 0;
    if (q <= 0) return Alert.alert('Cantidad inválida', 'Ingresa una cantidad válida.');
    onUpdate({ quantity: q, price: p });
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>◀</Text></TouchableOpacity>
        <Text style={styles.title}>{item.name}</Text>
      </View>

      <Text style={styles.label}>Cantidad</Text>
      <NumericKeyboard value={qty} onChange={setQty} />

      <Text style={styles.label}>Precio unitario (C$)</Text>
      <NumericKeyboard value={price} onChange={setPrice} />

      <TouchableOpacity style={styles.saveBtn} onPress={save}>
        <Text style={styles.saveText}>Guardar</Text>
      </TouchableOpacity>
    </View>
  );
}
