import React from 'react';
import { FlatList, View, Text } from 'react-native';
import ProductCard from './ProductCard';
import styles from '../styles/productStyles';

export default function ProductList({ products, onAddOne, onAddWithQty, loading }) {
  if (loading) {
    return <View style={{ padding: 20 }}><Text style={{ color: '#777' }}>Cargando productos...</Text></View>;
  }

  return (
    <FlatList
      data={products}
      numColumns={2}
      contentContainerStyle={{ paddingBottom: 160 }}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => (
        <ProductCard product={item} onAddOne={onAddOne} onAddWithQty={onAddWithQty} />
      )}
    />
  );
}
