import React from 'react';
import { View, TextInput } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import styles from '../styles/productsStyles';

export default function ProductSearchBar({ search, setSearch }) {
  return (
    <View style={styles.searchContainer}>
      <Ionicons name="search-outline" size={20} color="#666" style={{ marginHorizontal: 8 }} />
      <TextInput
        placeholder="Buscar producto..."
        placeholderTextColor="#999"
        value={search}
        onChangeText={setSearch}
        style={styles.searchInput}
      />
      {search?.length > 0 && (
        <Ionicons
          name="close-circle"
          size={18}
          color="#999"
          style={{ marginHorizontal: 6 }}
          onPress={() => setSearch('')}
        />
      )}
    </View>
  );
}
