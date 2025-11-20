// SalesScreen.jsx
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Dimensions } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import ProductList from './components/ProductList';
import CartButton from './components/CartButton';
import CartDrawer from './components/CartDrawer';
import { useCart } from './hooks/useCart';
import { calcPriceForProduct } from './hooks/useSalePricing';
import CustomerInfoCard from './components/CustomerInfoCard';
import SearchBar from './components/SearchBar';
import styles from './styles/salesScreenStyles';

const screenWidth = Dimensions.get('window').width;

export default function SalesScreen({ route }) {
  const { user, role, customer: initialCustomer } = route.params || {};
  const [tab, setTab] = useState('register');
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cartOpen, setCartOpen] = useState(false);

  const { items, customer, setCustomer, addItem, updateQty, removeItem, clear, totals } = useCart(initialCustomer);

  // inicializar customer si viene en params
  useEffect(() => {
    if (initialCustomer) setCustomer(initialCustomer);
  }, [initialCustomer]);

  // cargar productos
  useEffect(() => {
    const unsub = firestore()
      .collection('products')
      .orderBy('name', 'asc')
      .onSnapshot((snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProducts(data);
        setFiltered(data);
        setLoading(false);
      }, (err) => {
        console.error('products snapshot error', err);
        setLoading(false);
      });
    return () => unsub && unsub();
  }, []);

  // filtrar
  useEffect(() => {
    const q = (search || '').trim().toLowerCase();
    if (!q) return setFiltered(products);
    setFiltered(products.filter((p) => (p.name || '').toLowerCase().includes(q)));
  }, [search, products]);

  // callbacks for product actions
  const onAddOne = (product) => {
    const pricing = calcPriceForProduct({ product, qty: 1, customer });
    addItem(product, 1, pricing);
  };

  const onAddWithQty = (product, qty) => {
    const pricing = calcPriceForProduct({ product, qty, customer });
    addItem(product, qty, pricing);
  };

  const onUpdateQty = (productId, qty) => {
    // find product to recalc pricing
    const item = items.find((it) => it.productId === productId);
    if (!item) return;
    const pricing = calcPriceForProduct({ product: item.product, qty, customer });
    updateQty(productId, qty, pricing);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ventas</Text>
      </View>

      {/* optional: show selected customer */}
      {customer && <CustomerInfoCard customer={customer} /> }

      {/* SearchBar */}
      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar producto..."
      />

      {/* Product list */}
      <ProductList products={filtered} onAddOne={onAddOne} onAddWithQty={onAddWithQty} loading={loading} />

      {/* Cart floating button */}
      <CartButton count={totals.count || 0} total={totals.subtotal || 0} onPress={() => setCartOpen(true)} />

      {/* Drawer */}
      <CartDrawer
        visible={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={{ totals, items }}
        setCartCustomer={setCustomer}
        updateQty={onUpdateQty}
        removeItem={removeItem}
        clearCart={clear}
        customer={customer}
        role={role}
        onSaleComplete={() => {
          // optional: refresh or show toast
        }}
      />
    </View>
  );
}
