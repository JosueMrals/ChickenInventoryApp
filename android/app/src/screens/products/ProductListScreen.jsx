import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import useProducts from './hooks/useProducts';
import ProductCard from './components/ProductCard';
import ProductForm from './components/ProductForm';
import ProductSearchBar from './components/ProductSearchBar'; // ✅ nuevo import
import styles from './styles/productsStyles';

export default function ProductListScreen({ route }) {
  const { role: propRole, user: propUser } = route?.params || {};
  const role = propRole || 'user';
  const user = propUser || null;
  const navigation = useNavigation();

  const { products, loading, refresh } = useProducts();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [search, setSearch] = useState('');

  const openNew = () => {
    setEditingProduct(null);
    setModalVisible(true);
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setModalVisible(true);
  };

  // 🧠 Filtrar productos según el buscador
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter(p =>
      p.name?.toLowerCase().includes(query)
    );
  }, [products, search]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Inventario Avanzado</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.openDrawer?.()}>
            <Text style={styles.headerBtnText}>☰</Text>
          </TouchableOpacity>
          {role === 'admin' && (
            <TouchableOpacity style={styles.headerBtn} onPress={openNew}>
              <Text style={styles.headerBtnText}>+ Nuevo</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 🔍 Buscador */}
      <ProductSearchBar search={search} setSearch={setSearch} />

      {/* Lista */}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <ProductCard product={item} role={role} onEdit={() => openEdit(item)} />
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      {/* Modal Crear/Editar */}
      <ProductForm
        visible={modalVisible}
        onClose={() => { setModalVisible(false); setEditingProduct(null); refresh(); }}
        product={editingProduct}
        role={role}
      />
    </View>
  );
}
