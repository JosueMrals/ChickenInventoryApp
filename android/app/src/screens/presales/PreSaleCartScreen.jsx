import React, { useContext, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, Alert, SafeAreaView, ActivityIndicator } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { PreSaleContext } from "./context/preSaleContext";
import { useRoute } from "../../context/RouteContext";
import CartItem from "../quicksalesNew/components/CartItem";
import DiscountModal from "../../components/common/DiscountModal";
import styles from "../quicksalesNew/styles/quickCartStyles";
import globalStyles from "../../styles/globalStyles";

const formatCurrency = (value) => `C$${(Number(value) || 0).toFixed(2)}`;

export default function PreSaleCartScreen({ navigation }) {
  const { 
    cart, updateCart, removeFromCart, customer, setCustomer, 
    submitPreSale, resetPreSale, loading
  } = useContext(PreSaleContext);

  const { selectedRoute } = useRoute();

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

  const handleSubmit = async () => {
    if (cart.length === 0) return Alert.alert("Carrito vacío", "Agrega productos antes de continuar.");

    // Validación de ruta seleccionada (opcional, pero recomendada)
    if (!selectedRoute) {
        return Alert.alert(
            "Ruta no seleccionada",
            "No se ha detectado una ruta activa. Por favor, selecciona una ruta desde el menú principal antes de guardar la venta.",
            [{ text: "OK" }]
        );
    }

    if (!customer) {
      return Alert.alert("Cliente no asignado", "Por favor, asigna un cliente a esta pre-venta.", [
        { text: "Cancelar", style: "cancel" },
        { text: "Asignar", onPress: () => navigation.navigate('AssignCustomer') }
      ]);
    }
    
    try {
      await submitPreSale();
      Alert.alert("Pre-Venta Guardada", `La pre-venta ha sido creada exitosamente para la ruta: ${selectedRoute.name}`, [
        { text: "OK", onPress: () => {
            resetPreSale();
            navigation.navigate("PreSalesList") 
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

    if (discountType === 'percent') {
      finalDiscount = (productTotal * discountValue) / 100;
    } else if (discountType === 'amount') {
      finalDiscount = discountValue;
    }

    if (finalDiscount > productTotal) {
      finalDiscount = productTotal;
    }

    updateCart(product.id, {
      discount: finalDiscount,
      discountType,
      discountValue,
    });
    
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

          {/* Información Contextual: Cliente y Ruta */}
          <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
            {/* Cliente */}
            {customer ? (
                <View style={[styles.customerBox, { marginBottom: 8 }]}>
                <Icon name="person" size={18} color="#007AFF" />
                <Text style={styles.customerText}>{customer.firstName} {customer.lastName}</Text>
                <TouchableOpacity onPress={() => setCustomer(null)} style={{ marginLeft: 8 }}>
                    <Icon name="close" size={20} color="#FF3B30" />
                </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity
                    style={[styles.customerBox, { borderStyle: 'dashed', backgroundColor: '#f9f9f9' }]}
                    onPress={() => navigation.navigate('AssignCustomer')}
                >
                    <Icon name="person-add-outline" size={18} color="#666" />
                    <Text style={[styles.customerText, { color: '#666' }]}>Asignar Cliente</Text>
                </TouchableOpacity>
            )}

            {/* Ruta (Visualización) */}
            {selectedRoute && (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E1F0FF', padding: 8, borderRadius: 8 }}>
                    <Icon name="location-sharp" size={16} color="#007AFF" style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 13, color: '#004488', fontWeight: '600' }}>
                        Ruta Actual: {selectedRoute.name}
                    </Text>
                </View>
            )}
          </View>


          <FlatList
            data={cart}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <CartItem
                item={item}
                onDiscount={() => openDiscount(item)}
                onRemove={() => removeFromCart(item.id)}
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
            
            <TouchableOpacity style={[styles.checkoutBtn, loading && styles.disabledButton]} onPress={handleSubmit} disabled={loading}>
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
