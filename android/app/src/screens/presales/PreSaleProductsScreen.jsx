import React, { useContext, useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, StyleSheet } from "react-native";
import { PreSaleContext } from "./context/preSaleContext";
import Icon from "react-native-vector-icons/Ionicons";
import firestore from "@react-native-firebase/firestore";
import { calcPriceForProduct } from "../../screens/sales/hooks/useSalePricing"; // Import pricing logic
import styles from "../quicksalesNew/styles/quickProductsStyles";
import SearchBar from '../../components/SearchBar';
import { useFocusEffect } from "@react-navigation/native";

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

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
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
      return () => unsub();
    }, [])
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!isEditing && e.data.action.type === 'GO_BACK') {
        resetPreSale();
      }
    });
    return unsubscribe;
  }, [navigation, isEditing, resetPreSale]);


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
    const { priceToUse } = calcPriceForProduct({ product: item, qty: 1, customer });
    const bonuses = Array.isArray(item.bonuses) ? item.bonuses : (item.bonus ? [item.bonus] : []);
    const hasBonus = bonuses.some(b => b && b.enabled);
    return (
      <TouchableOpacity style={styles.card} onPress={() => openQuantity(item)}>
        <Text style={styles.cardName}>{item.name}</Text>
        <Text style={styles.cardPrice}>{formatCurrency(priceToUse)}</Text>
        {(item.wholesalePrices?.length > 0 || hasBonus) && (
          <View style={localStyles.tagContainer}>
            {item.wholesalePrices?.length > 0 && <Text style={localStyles.tag}>Mayoreo</Text>}
            {hasBonus && <Text style={[localStyles.tag, localStyles.bonusTag]}>Bonificacion</Text>}
          </View>
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
  listContent: { paddingBottom: 100 },
  tagContainer: {
    flexDirection: 'row',
    marginTop: 4,
  },
  tag: {
    fontSize: 10,
    color: '#666',
    backgroundColor: '#EAECEE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 4,
    overflow: 'hidden',
  },
  bonusTag: {
    backgroundColor: '#D4EFDF',
    color: '#1E8449',
  },
});
