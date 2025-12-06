import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function ProductCard({ product, onEdit, onAddStock }) {
  return (
    <TouchableOpacity onPress={() => onEdit && onEdit(product)} style={styles.card}>
      <View>
        <Text style={styles.name}>{product?.name}</Text>
        <Text style={styles.small}>Código: {product?.barcode ?? '-'}</Text>
        <Text style={styles.small}>Stock: {product?.stock ?? 0}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => onAddStock && onAddStock(product)} style={styles.btn}>
          <Text>Añadir stock</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
	  padding: 12,
	  borderBottomWidth: 1,
	  borderColor: '#eee',
	  flexDirection: 'row',
	  justifyContent: 'space-between'
  },
  name: { fontWeight: '600' },
  small: { color: '#666', fontSize: 12 },
  actions: { justifyContent: 'center' },
  btn: { padding: 6 }
});
