import React, { useContext, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, Alert, SafeAreaView, ActivityIndicator } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { PreSaleContext } from "./context/preSaleContext";
import CartItem from "../quicksalesNew/components/CartItem";
import DiscountModal from "../quicksalesNew/components/DiscountModal";
import styles from "../quicksalesNew/styles/quickCartStyles";
import globalStyles from "../../styles/globalStyles";

const formatCurrency = (value) => `C$${(Number(value) || 0).toFixed(2)}`;

export default function PreSaleCartScreen({ navigation }) {
  const { cart, updateCart, removeFromCart, customer, setCustomer, savePreSale, resetPreSale, loading } = useContext(PreSaleContext);
  const [discountModal, setDiscountModal] = useState({ visible: false, product: null });

  const soldItems = useMemo(() => cart.filter(item => !item.isBonus), [cart]);

  const subtotal = useMemo(() => 
    soldItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0), 
    [soldItems]
  );
  const totalDiscount = useMemo(() => 
    soldItems.reduce((sum, item) => sum + (Number(item.discount) || 0), 0), 
    [soldItems]
  );
  const total = subtotal - totalDiscount;

  const handleSavePreSale = async () => {
    if (cart.length === 0) return Alert.alert("Carrito vacío", "Agrega productos antes de continuar.");
    if (!customer) {
      return Alert.alert("Cliente no asignado", "Por favor, asigna un cliente a esta pre-venta.", [
        { text: "Cancelar", style: "cancel" },
        { text: "Asignar", onPress: () => navigation.navigate('AssignCustomer') }
      ]);
    }
    
    try {
      await savePreSale();
      resetPreSale();
      Alert.alert("Pre-Venta Guardada", "La pre-venta ha sido guardada exitosamente.", [
        { text: "OK", onPress: () => navigation.navigate("PreSalesList") }
      ]);
    } catch (error) {
      Alert.alert("Error", "No se pudo guardar la pre-venta. Inténtalo de nuevo.");
    }
  };

  const openDiscount = (item) => {
    if (item.isBonus) return;
    setDiscountModal({ visible: true, product: item });
  };
  
  const applyDiscountToProduct = ({ discountValue }) => {
    updateCart(discountModal.product.id, { discount: Number(discountValue || 0) });
    setDiscountModal({ visible: false, product: null });
  };
  
  return (
    <SafeAreaView style={globalStyles.container}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Icon name="chevron-back" size={26} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Carrito de Pre-Venta</Text>
            <View style={{ width: 40 }} />
          </View>

          {customer && (
            <View style={styles.customerBox}>
              <Icon name="person" size={18} color="#007AFF" />
              <Text style={styles.customerText}>{customer.firstName} {customer.lastName}</Text>
              <TouchableOpacity onPress={() => setCustomer(null)} style={{ marginLeft: 8 }}>
                <Icon name="close" size={20} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          )}

          <FlatList
            data={cart}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <CartItem
                item={item}
                onDiscount={() => openDiscount(item)}
                onRemove={() => removeFromCart(item.id)}
                // --- FIX: Ensure onUpdate is passed correctly ---
                onUpdate={(changes) => updateCart(item.id, changes)}
              />
            )}
            ListEmptyComponent={() => (
              <View style={styles.emptyBox}><Text style={styles.emptyText}>No hay productos</Text></View>
            )}
            contentContainerStyle={{ paddingBottom: 250 }}
          />

          <View style={styles.summary}>
            <View style={styles.row}><Text style={styles.label}>Subtotal</Text><Text style={styles.value}>{formatCurrency(subtotal)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Descuentos</Text><Text style={styles.value}>-{formatCurrency(totalDiscount)}</Text></View>
            <View style={styles.rowTotal}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>{formatCurrency(total)}</Text></View>
            
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { resetPreSale(); navigation.goBack(); }}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.checkoutBtn, loading && styles.disabledButton]} onPress={handleSavePreSale} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkoutText}>Guardar Pre-Venta</Text>}
            </TouchableOpacity>
          </View>

          <DiscountModal
            visible={discountModal.visible}
            product={discountModal.product}
            onClose={() => setDiscountModal({ visible: false, product: null })}
            onApply={applyDiscountToProduct}
          />
        </View>
    </SafeAreaView>
  );
}