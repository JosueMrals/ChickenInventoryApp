import React, { useContext, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, Alert, SafeAreaView, ActivityIndicator, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { PreSaleContext } from "./context/preSaleContext";
import CartItem from "../quicksalesNew/components/CartItem";
import DiscountModal from "../../components/common/DiscountModal";
import styles from "../quicksalesNew/styles/quickCartStyles";
import globalStyles from "../../styles/globalStyles";
import AddProductModal from "./components/AddProductModal";

const formatCurrency = (value) => `C$${(Number(value) || 0).toFixed(2)}`;

export default function PreSaleEditCartScreen({ navigation }) {
  const { 
    customer, setCustomer, 
    submitPreSale, resetPreSale, loading,
    editCart, updateEditCart, removeFromEditCart, addItemToEditCart
  } = useContext(PreSaleContext);
  
  const [discountModal, setDiscountModal] = useState({ visible: false, product: null });
  const [addProductModalVisible, setAddProductModalVisible] = useState(false);

  const soldItems = useMemo(() => editCart.filter(item => !item.isBonus), [editCart]);

  const subtotal = useMemo(() => 
    soldItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0), 
    [soldItems]
  );
  const totalDiscount = useMemo(() => 
    soldItems.reduce((sum, item) => sum + (Number(item.discount) || 0), 0), 
    [soldItems]
  );
  const total = subtotal - totalDiscount;

  const handleSubmit = async () => {
    if (editCart.length === 0) return Alert.alert("Carrito vacío", "Agrega productos antes de continuar.");
    if (!customer) {
      return Alert.alert("Cliente no asignado", "Por favor, asigna un cliente a esta pre-venta.", [
        { text: "Cancelar", style: "cancel" },
        { text: "Asignar", onPress: () => navigation.navigate('AssignCustomer') }
      ]);
    }
    
    try {
      await submitPreSale();
      Alert.alert("Pre-Venta Actualizada", "Los cambios han sido guardados.", [
        { text: "OK", onPress: () => {
            resetPreSale();
            navigation.navigate("PreSalesList");
        }}
      ]);
    } catch (error) {
      Alert.alert("Error", `No se pudo guardar la pre-venta. ${error.message}`);
    }
  };

  const openDiscount = (item) => {
    if (item.isBonus) return;
    setDiscountModal({ visible: true, product: item });
  };
  
  const applyDiscountToProduct = ({ discountType, discountValue }) => {
    const product = discountModal.product;
    if (!product) return;
    let finalDiscount = 0;
    const productTotal = product.quantity * product.unitPrice;

    if (discountType === 'percent') finalDiscount = (productTotal * discountValue) / 100;
    else if (discountType === 'amount') finalDiscount = discountValue;
    if (finalDiscount > productTotal) finalDiscount = productTotal;

    updateEditCart(product.id, { discount: finalDiscount, discountType, discountValue });
    setDiscountModal({ visible: false, product: null });
  };

  const handleToggleProduct = (product) => {
      const isInCart = editCart.some(item => item.id === product.id);
      if (isInCart) {
          removeFromEditCart(product.id);
      } else {
          addItemToEditCart(product, 1);
      }
  };
  
  return (
    <SafeAreaView style={globalStyles.container}>
        <View style={globalStyles.container}>
          <View style={globalStyles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Icon name="chevron-back" size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={globalStyles.title}>Editando Pre-Venta</Text>
            <View style={{ width: 40 }}/>
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
            data={editCart}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <CartItem
                item={item}
                onDiscount={() => openDiscount(item)}
                onRemove={() => removeFromEditCart(item.id)}
                onUpdate={(changes) => updateEditCart(item.id, changes)}
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
            
            <View style={localStyles.footerButtons}>
              <TouchableOpacity style={[styles.checkoutBtn, {flex: 1, marginRight: 5, backgroundColor: '#007AFF'}]} onPress={() => setAddProductModalVisible(true)}>
                  <Text style={styles.checkoutText}>Agregar Producto</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.checkoutBtn, {flex: 1, marginLeft: 5}, loading && styles.disabledButton]} onPress={handleSubmit} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkoutText}>Guardar Cambios</Text>}
              </TouchableOpacity>
            </View>
          </View>

          <DiscountModal
            visible={discountModal.visible}
            product={discountModal.product}
            onClose={() => setDiscountModal({ visible: false, product: null })}
            onApply={applyDiscountToProduct}
          />

          <AddProductModal 
            visible={addProductModalVisible}
            onClose={() => setAddProductModalVisible(false)}
            onAddProduct={handleToggleProduct}
            cart={editCart}
          />
        </View>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
    footerButtons: { flexDirection: 'row', marginTop: 10 }
});
