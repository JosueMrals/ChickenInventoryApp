import React, { useState, useMemo } from 'react';
import { View, FlatList, TouchableOpacity, Text, StyleSheet } from 'react-native';
import ProductSearch from '../components/ProductSearch';
import ProductItem from '../components/ProductItem';
import { useProducts } from '../hooks/useProducts';


export default function ProductsScreen({ navigation }) {
const { products, loading } = useProducts();
const [query, setQuery] = useState('');


const filtered = useMemo(() => {
if (!query) return products;
const q = query.toLowerCase();
return products.filter(p => (p.name || '').toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q));
}, [products, query]);


return (
<View style={{ flex: 1 }}>
<ProductSearch value={query} onChange={setQuery} />


<FlatList
data={filtered}
keyExtractor={(i) => i.id}
renderItem={({ item }) => (
<ProductItem
product={item}
onEdit={(p) => navigation.navigate('EditProduct', { productId: p.id })}
onAddStock={(p) => navigation.navigate('AddStock', { productId: p.id })}
/>
)}
ListEmptyComponent={() => <Text style={{ padding: 20 }}>{loading ? 'Cargando...' : 'No hay productos'}</Text>}
/>


<TouchableOpacity
style={styles.fab}
onPress={() => navigation.navigate('AddProductStep1')}
>
<Text style={{ color: '#fff', fontWeight: '700' }}>+</Text>
</TouchableOpacity>
</View>
);
}


const styles = StyleSheet.create({
fab: { position: 'absolute', right: 20, bottom: 30, width: 56, height: 56, borderRadius: 28, backgroundColor: '#2a9d8f', alignItems: 'center', justifyContent: 'center' },
});