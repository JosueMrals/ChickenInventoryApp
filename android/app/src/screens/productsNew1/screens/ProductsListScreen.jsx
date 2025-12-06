import React from 'react';
import { View, FlatList, Button } from 'react-native';
import { useProducts } from '../hooks/useProducts';
import SearchBar from '../components/SearchBar';
import ProductCard from '../components/ProductCard';

export default function ProductsListScreen({ navigation }) {
  const { products, loading, setQuery, clearQuery, refresh } = useProducts();

  return (
    <View style={{ flex: 1 }}>
      <SearchBar onChangeText={setQuery} onClear={clearQuery} placeholder="Buscar por nombre o código" />

      <FlatList
        data={products}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            onEdit={() => navigation.navigate('EditProduct', { productId: item.id })}
            onAddStock={() => navigation.navigate('AddStock', { productId: item.id })}
          />
        )}
      />
    </View>
  );
}
