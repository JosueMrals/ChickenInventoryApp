import React from 'react';
import { FlatList, View, Text } from 'react-native';
import QuickProductCard from './QuickProductCard';

export default function QuickProductList({ products, loading, onAddOne, onAddWithQty }) {
  if (loading) {
    return (
      <View style={{ padding: 20 }}>
        <Text style={{ color: '#777' }}>Cargando productos…</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={products}
      numColumns={2}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <QuickProductCard
          product={item}
          onAddOne={onAddOne}
          onAddWithQty={onAddWithQty}
        />
      )}
    />
  );
}
