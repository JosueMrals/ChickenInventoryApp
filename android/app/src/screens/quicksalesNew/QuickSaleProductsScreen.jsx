import React, { useContext, useState, useEffect, useCallback  } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput } from "react-native";

import { QuickSaleContext } from "./context/quickSaleContext";
import Icon from "react-native-vector-icons/Ionicons";
import styles from "./styles/quickProductsStyles";
import firestore from "@react-native-firebase/firestore";

export default function QuickSaleProductsScreen({ navigation }) {
  const { cart, addItem, customer, setCustomer } = useContext(QuickSaleContext);

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");

  // ---------- LOAD PRODUCTS ----------
  useEffect(() => {
    const unsub = firestore()
      .collection("products")
      .orderBy("name", "asc")
      .onSnapshot((snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProducts(list);
      });

    return unsub;
  }, []);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const openQuantity = (product) => {
    navigation.navigate("ProductQuantity", {
      product,
      onConfirm: (qty) => {
        addItem(product, qty); // usa estructura correcta
      },
    });
    console.log(product);
  };


  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>Venta Rápida</Text>

        <TouchableOpacity
          style={styles.customerBtn}
          onPress={() => navigation.navigate("AssignCustomer")}
        >
          <Icon name="person-add-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* CLIENT SELECTED */}
      {customer && (
        <View style={styles.customerAssignedBox}>
          <Text style={styles.customerAssigned}>
            Cliente: {customer.firstName} {customer.lastName}
          </Text>

          <TouchableOpacity onPress={() => setCustomer(null)}>
            <Icon name="close-circle" size={22} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      )}

      {/* SEARCH */}
      <TextInput
        placeholder="Buscar producto..."
        style={styles.search}
        value={search}
        onChangeText={setSearch}
      />

      {/* PRODUCT LIST */}
      <FlatList
        data={filtered}
        numColumns={2}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => openQuantity(item)}
          >
            <Text style={styles.cardName}>{item.name}</Text>

            <Text style={styles.cardPrice}>
              C${item.salePrice ?? item.price}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* CART BUTTON */}
      {cart.length > 0 && (
        <TouchableOpacity
          style={styles.cartButton}
          onPress={() => navigation.navigate("QuickSaleCart")}
        >
          <Text style={styles.cartButtonText}>
            {cart.length} ítems · Total C$
            {cart.reduce((sum, item) => sum + item.total, 0).toFixed(2)}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
