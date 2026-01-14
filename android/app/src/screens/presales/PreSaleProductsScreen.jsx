import React, { useContext, useState, useEffect, useMemo } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, SafeAreaView, ActivityIndicator, StyleSheet } from "react-native";
import { PreSaleContext } from "./context/preSaleContext";
import Icon from "react-native-vector-icons/Ionicons";
import firestore from "@react-native-firebase/firestore";
import { calcPriceForProduct } from "../../screens/sales/hooks/useSalePricing"; // Import pricing logic
import styles from "../quicksalesNew/styles/quickProductsStyles";

// Helper to safely format currency
const formatCurrency = (value) => `C$${(Number(value) || 0).toFixed(2)}`;

export default function PreSaleProductsScreen({ navigation }) {
  const { cart, addItem, customer, setCustomer } = useContext(PreSaleContext);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsub = firestore()
      .collection("products")
      .orderBy("name", "asc")
      .onSnapshot((snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProducts(list);
        setLoading(false);
      }, (error) => {
        console.error("Error fetching products:", error);
        setLoading(false);
      });

    return unsub;
  }, []);

  const filteredProducts = useMemo(() => 
    products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [products, search]
  );
  
  const cartTotal = useMemo(() => 
    cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice - (item.discount || 0)), 0),
    [cart]
  );

  const openQuantity = (product) => {
    navigation.navigate("ProductQuantity", {
      product,
      onConfirm: (qty) => addItem(product, qty),
    });
  };

  const renderProductCard = ({ item }) => {
    // CORRECTLY get the price from the returned object
    const { priceToUse } = calcPriceForProduct({ product: item, qty: 1, customer });

    return (
      <TouchableOpacity style={styles.card} onPress={() => openQuantity(item)}>
        <Text style={styles.cardName}>{item.name}</Text>
        <Text style={styles.cardPrice}>{formatCurrency(priceToUse)}</Text>
        {(item.wholesalePrices?.length > 0 || item.wholesaleThreshold) && (
          <Text style={localStyles.wholesaleIndicator}>Mayoreo disp.</Text>
        )}
      </TouchableOpacity>
    );
  };
  
  if (loading) {
    return (
      <SafeAreaView style={localStyles.centered}>
        <ActivityIndicator size="large" />
        <Text>Cargando productos...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={localStyles.flexOne}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.navigate("DashboardScreen")}>
              <Icon name="chevron-back" size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>Preventa</Text>
            <TouchableOpacity style={styles.customerBtn} onPress={() => navigation.navigate("AssignCustomer")}>
              <Icon name="person-add-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

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

          <View style={localStyles.searchContainer}>
            <View style={localStyles.searchWrapper}>
              <Icon name="search" size={20} color="#999" style={localStyles.searchIcon} />
              <TextInput
                placeholder="Buscar producto..."
                style={localStyles.searchInput}
                value={search}
                onChangeText={setSearch}
              />
            </View>
          </View>

          <FlatList
            data={filteredProducts}
            renderItem={renderProductCard}
            numColumns={2}
            keyExtractor={(item) => item.id}
            contentContainerStyle={localStyles.listContent}
            keyboardShouldPersistTaps="handled"
          />

          {cart.length > 0 && (
            <TouchableOpacity
              style={styles.cartButton}
              onPress={() => navigation.navigate("PreSaleCart")}
            >
              <Text style={styles.cartButtonText}>
                {cart.length} ítems · Total {formatCurrency(cartTotal)}
              </Text>
            </TouchableOpacity>
          )}
        </View>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  flexOne: { flex: 1, backgroundColor: '#f2f2f2' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  wholesaleIndicator: { fontSize: 10, color: '#666', marginTop: 2 },
  searchContainer: { paddingHorizontal: 16, marginBottom: 10 },
  searchWrapper: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, alignItems: 'center', height: 48, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16 },
  listContent: { paddingBottom: 100 },
});
