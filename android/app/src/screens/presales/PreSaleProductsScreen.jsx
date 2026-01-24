import React, { useContext, useState, useEffect, useMemo } from "react";
import { View, Text, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, StyleSheet } from "react-native";
import { PreSaleContext } from "./context/preSaleContext";
import Icon from "react-native-vector-icons/Ionicons";
import firestore from "@react-native-firebase/firestore";
import { calcPriceForProduct } from "../../screens/sales/hooks/useSalePricing"; // Import pricing logic
import styles from "../quicksalesNew/styles/quickProductsStyles";
import SearchBar from '../../components/SearchBar';

// Helper to safely format currency
const formatCurrency = (value) => `C$${(Number(value) || 0).toFixed(2)}`;

export default function PreSaleProductsScreen({ navigation }) {
  const { 
    cart, addItem, customer, setCustomer, resetPreSale,
    editingPreSale, editCart, addItemToEditCart 
  } = useContext(PreSaleContext);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const isEditing = !!editingPreSale;
  const cartToDisplay = isEditing ? editCart : cart;
  const addItemFn = isEditing ? addItemToEditCart : addItem;

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

    // Cleanup when the user navigates away, but only reset if not editing
    return () => {
      unsub();
      if (!isEditing) {
        resetPreSale();
      }
    };
  }, [isEditing]);

  const filteredProducts = useMemo(() => 
    products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [products, search]
  );
  
  const cartTotal = useMemo(() => 
    cartToDisplay.reduce((sum, item) => sum + (item.quantity * item.unitPrice - (item.discount || 0)), 0),
    [cartToDisplay]
  );

  const openQuantity = (product) => {
    navigation.navigate("ProductQuantity", {
      product,
      onConfirm: (qty) => addItemFn(product, qty),
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
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Icon name="chevron-back" size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>{isEditing ? "Agregar Productos" : "Preventa"}</Text>
            <TouchableOpacity style={styles.customerBtn} onPress={() => navigation.navigate("AssignCustomer")}>
              <Icon name="person-add-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {!isEditing && customer && (
            <View style={styles.customerAssignedBox}>
              <Text style={styles.customerAssigned}>
                Cliente: {customer.firstName} {customer.lastName}
              </Text>
              <TouchableOpacity onPress={() => setCustomer(null)}>
                <Icon name="close-circle" size={22} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          )}

          <SearchBar 
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar producto..."
          />

          <FlatList
            data={filteredProducts}
            renderItem={renderProductCard}
            numColumns={2}
            keyExtractor={(item) => item.id}
            contentContainerStyle={localStyles.listContent}
            keyboardShouldPersistTaps="handled"
          />

          {cartToDisplay.length > 0 && (
            <TouchableOpacity
              style={styles.cartButton}
              onPress={() => navigation.navigate("PreSaleCart")}
            >
              <Text style={styles.cartButtonText}>
                {cartToDisplay.length} ítems · Total {formatCurrency(cartTotal)}
              </Text>
              <Icon name="arrow-forward-circle" size={24} color="#fff" />
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
  listContent: { paddingBottom: 100 },
});
