// screen/quicksales/QuickSaleScreen.jsx
import React, { useEffect, useState } from "react";
import { View, Text, TextInput } from "react-native";
import firestore from "@react-native-firebase/firestore";
import QuickProductList from "./components/QuickProductList";
import styles from "./styles/quickSaleStyles";
import { useNavigation } from "@react-navigation/native";
import { useQuickCartStore } from "./store/useQuickCartStore";

export default function QuickSaleScreen({ route }) {
  const navigation = useNavigation();
  const { role } = route.params || {};

  const { items, subtotal } = useQuickCartStore();
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!["admin", "user"].includes(role)) {
      navigation.goBack();
    }
  }, []);

  // cargar productos
  useEffect(() => {
    const unsub = firestore()
      .collection("products")
      .orderBy("name", "asc")
      .onSnapshot((snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProducts(data);
        setFiltered(data);
      });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) return setFiltered(products);
    setFiltered(products.filter((p) => p.name.toLowerCase().includes(q)));
  }, [search, products]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Venta Rápida</Text>

      <TextInput
        placeholder="Buscar producto..."
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
      />

      <QuickProductList products={filtered} />

      {/* Botón flotante mostrando cantidad y total */}
      <View style={styles.cartBar}>
        <Text style={styles.cartText}>
          {items.length} items = C${subtotal.toFixed(2)}
        </Text>

        <Text
          style={styles.cartBtn}
          onPress={() => navigation.navigate("QuickCartScreen")}
        >
          Ver Carrito →
        </Text>
      </View>
    </View>
  );
}
