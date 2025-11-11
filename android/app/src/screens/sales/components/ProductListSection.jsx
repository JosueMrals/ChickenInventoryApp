import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import styles from '../styles/salesScreenStyles';

export default function ProductListSection({ products, onSell, loading }) {
  if (loading)
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );

  if (!products.length)
    return (
      <View style={styles.noProducts}>
        <Text style={{ color: '#888' }}>No se encontraron productos</Text>
      </View>
    );

  return (
    <FlatList
      data={products}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingVertical: 10 }}
      renderItem={({ item }) => (
        <View style={styles.productCard}>
          <View>
            <Text style={styles.productName}>{item.name}</Text>
            <Text style={styles.productInfo}>Stock: {item.stock}</Text>
            <Text style={styles.productPrice}>${item.price?.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            onPress={() => onSell(item)}
            disabled={item.stock <= 0}
            style={[
              styles.sellButton,
              { backgroundColor: item.stock <= 0 ? '#ccc' : '#007AFF' },
            ]}
          >
            <Text style={styles.sellText}>
              {item.stock <= 0 ? 'Agotado' : 'Vender'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}
