import React, { useContext, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { QuickSaleContext } from "./context/quickSaleContext";

import CartItem from "./components/CartItem";
import DiscountModal from "../../components/common/DiscountModal";

import styles from "./styles/quickCartStyles";

export default function QuickSaleCartScreen({ navigation }) {

  const { resetQuickSale } = useContext(QuickSaleContext);
  const {
    cart,
    updateCart,
    removeItem,
    customer,
    setCustomer,
    removeFromCart
  } = useContext(QuickSaleContext);

  const [discountModal, setDiscountModal] = useState({
    visible: false,
    product: null,
  });

  // SUBTOTAL
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  }, [cart]);

  // DESCUENTO TOTAL
  const totalDiscount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.discount, 0);
  }, [cart]);

  // TOTAL FINAL
  const total = subtotal - totalDiscount;

  // EDITAR PRODUCTO
  const openEdit = (item) => {
    navigation.navigate("ProductEdit", {
      item,
      onUpdate: (changes) => updateCart(item.id, changes),
      onRemove: () => removeItem(item.id),
    });
  };

  // DESCUENTO INDIVIDUAL
  const openDiscount = (item) => {
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

    // Ensure discount doesn't exceed product total
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

  // ELIMINAR PRODUCTO
  const handleRemove = (item) => {
    Alert.alert("Eliminar", "¿Eliminar este producto del carrito?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () => removeFromCart(item.id),
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f2f2f2' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>

          {/* HEADER */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Icon name="chevron-back" size={26} color="#333" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Carrito</Text>

            <View style={{ width: 40 }} />
          </View>

          {/* CLIENTE */}
          {customer && (
            <View style={styles.customerBox}>
              <Icon name="person" size={18} color="#007AFF" />
              <Text style={styles.customerText}>
                {customer.firstName} {customer.lastName}
              </Text>
              <TouchableOpacity onPress={() => setCustomer(null)} style={{ marginLeft: 8 }}>
                <Icon name="close" size={20} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          )}

          {/* LISTA DEL CARRITO */}
          <FlatList
            data={cart}
            keyExtractor={(item, i) =>
              item?.id ? item.id : `fallback-${i}`
            }
            contentContainerStyle={[styles.list, { paddingBottom: 220 }]} // Extra space for footer
            renderItem={({ item }) => (
              <CartItem
                item={item}
                onEdit={() => openEdit(item)}
                onDiscount={() => openDiscount(item)}
                onRemove={() => handleRemove(item)}
                onUpdate={(changes) => updateCart(item.id, changes)}
              />
            )}
            ListEmptyComponent={() => (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No hay productos en el carrito</Text>
              </View>
            )}
          />

          {/* RESUMEN */}
          <View style={styles.summary}>
            <View style={styles.row}>
              <Text style={styles.label}>Subtotal</Text>
              <Text style={styles.value}>C${subtotal.toFixed(2)}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Descuentos</Text>
              <Text style={styles.value}>C${totalDiscount.toFixed(2)}</Text>
            </View>

            <View style={styles.rowTotal}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>C${total.toFixed(2)}</Text>
            </View>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                resetQuickSale();
                navigation.navigate("QuickSaleProducts");
              }}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>

            {/* BOTÓN CONTINUAR */}
            <TouchableOpacity
              style={styles.checkoutBtn}
              onPress={() => {
                if (cart.length === 0)
                  return Alert.alert("Carrito vacío", "Agrega productos antes de pagar.");

                navigation.navigate("QuickSalePayment", {
                  cart,
                  subtotal,
                  total,
                  customer,
                  setCustomer,
                });
              }}
            >
              <Text style={styles.checkoutText}>Continuar al Pago</Text>
            </TouchableOpacity>
          </View>

          {/* MODAL DESCUENTO */}
          <DiscountModal
            visible={discountModal.visible}
            product={discountModal.product}
            onClose={() =>
              setDiscountModal({ visible: false, product: null })
            }
            onApply={applyDiscountToProduct}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
