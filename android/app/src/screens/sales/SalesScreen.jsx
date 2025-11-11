import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, Animated, Dimensions } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import SaleModal from './components/SaleModal';
import SearchBar from './components/SearchBar';
import ProductListSection from './components/ProductListSection';
import SalesHistory from './components/SalesHistory';
import styles from './styles/salesScreenStyles';

const screenWidth = Dimensions.get('window').width;

export default function SalesScreen({ route }) {
  const { user, role } = route.params;
  const [tab, setTab] = useState('register');
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const tabAnim = useRef(new Animated.Value(0)).current;

  // 🔹 Cargar productos
  useEffect(() => {
    const unsub = firestore()
      .collection('products')
      .orderBy('name', 'asc')
      .onSnapshot((snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProducts(data);
        setFiltered(data);
        setLoading(false);
      });
    return () => unsub();
  }, []);

  // 🔎 Filtrar productos por búsqueda
  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) return setFiltered(products);
    const results = products.filter((p) =>
      p.name.toLowerCase().includes(q)
    );
    setFiltered(results);
  }, [search, products]);

  const switchTab = (tabName) => {
    setTab(tabName);
    Animated.timing(tabAnim, {
      toValue: tabName === 'register' ? 0 : screenWidth / 2,
      duration: 250,
      useNativeDriver: false,
    }).start();
  };

  const handleSaleOpen = (product) => {
    setSelectedProduct(product);
    setModalVisible(true);
  };

  return (
    <View style={styles.container}>
      {/* 🟦 Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ventas</Text>
      </View>

      {/* 🧭 Tabs */}
      <View style={styles.tabsContainer}>
        <Animated.View
          style={[
            styles.tabIndicator,
            { transform: [{ translateX: tabAnim }] },
          ]}
        />
        <Text
          onPress={() => switchTab('register')}
          style={[styles.tabText, tab === 'register' && styles.tabTextActive]}
        >
          Registrar
        </Text>
        <Text
          onPress={() => switchTab('history')}
          style={[styles.tabText, tab === 'history' && styles.tabTextActive]}
        >
          Historial
        </Text>
      </View>

      {/* 🔍 Buscador (solo en Registrar) */}
      {tab === 'register' && (
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar producto..."
        />
      )}

      {/* 🧾 Contenido dinámico */}
      {tab === 'register' ? (
        <ProductListSection
          products={filtered}
          onSell={handleSaleOpen}
          loading={loading}
        />
      ) : (
        <SalesHistory role={role} />
      )}

      {/* 💰 Modal de venta */}
      <SaleModal
        visible={modalVisible}
        product={selectedProduct}
        onClose={() => setModalVisible(false)}
        onComplete={() => setModalVisible(false)}
      />
    </View>
  );
}
