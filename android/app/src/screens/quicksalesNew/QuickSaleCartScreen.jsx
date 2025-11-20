import React, { useContext, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { QuickSaleContext } from './context/quickSaleContext';
import CartItem from './components/CartItem';
import styles from './styles/quickCartStyles';
import Icon from 'react-native-vector-icons/Ionicons';
import DiscountModal from './components/DiscountModal';

export default function QuickSaleCartScreen({ navigation }) {
  const { cart, updateCart, removeFromCart, clearCart, customer, setCustomer } = useContext(QuickSaleContext);
  const [discountModal, setDiscountModal] = useState({ visible: false, product: null });

  const subtotal = useMemo(() => {
    return cart.reduce((s, p) => s + (Number(p.price || 0) * Number(p.quantity || 0)), 0);
  }, [cart]);

  const totalDiscount = useMemo(() => {
    return cart.reduce((s, p) => {
      const q = Number(p.quantity || 0);
      const price = Number(p.price || 0);
      if (!p.discountType || p.discountType === 'none') return s;
      if (p.discountType === 'percent') return s + (price * q) * (Number(p.discountValue || 0) / 100);
      return s + Number(p.discountValue || 0);
    }, 0);
  }, [cart]);

  const total = Math.max(subtotal - totalDiscount, 0);

  const openEdit = (item) => {
    navigation.navigate('ProductEdit', {
      item,
      onUpdate: (newData) => updateCart(item.id, newData),
    });
  };

  const openDiscount = (item) => setDiscountModal({ visible: true, product: item });

  const applyDiscountToProduct = ({ discountType, discountValue }) => {
    const prod = discountModal.product;
    if (!prod) return;
    updateCart(prod.id, { discountType, discountValue });
    setDiscountModal({ visible: false, product: null });
  };

  const handleRemove = (id) => {
    Alert.alert('Eliminar', '¿Eliminar este producto del carrito?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => removeFromCart(id) },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={26} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Carrito</Text>
        <View style={{ width: 40 }} />
      </View>

      {customer && (
        <View style={styles.customerBox}>
          <Icon name="person" size={18} color="#007AFF" />
          <Text style={styles.customerText}>
            {customer.firstName} {customer.lastName}
          </Text>
        </View>
      )}

      <FlatList
        data={cart}
        keyExtractor={(it) => it.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <CartItem
            item={item}
            onEdit={() => openEdit(item)}
            onDiscount={() => openDiscount(item)}
            onRemove={() => handleRemove(item.id)}
          />
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No hay items en el carrito</Text>
          </View>
        )}
      />

      <View style={styles.summary}>
        <View style={styles.row}>
          <Text style={styles.label}>Subtotal</Text>
          <Text style={styles.value}>C${subtotal.toFixed(2)}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Descuentos</Text>
          <Text style={styles.value}>-C${totalDiscount.toFixed(2)}</Text>
        </View>

        <View style={styles.rowTotal}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>C${total.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={() => {
            if (cart.length === 0) return Alert.alert('Carrito vacío', 'Agrega productos antes de pagar.');
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

      {/* Discount Modal (component provided below) */}
      {discountModal.visible && (
        <DiscountModal
          visible={discountModal.visible}
          product={discountModal.product}
          onClose={() => setDiscountModal({ visible: false, product: null })}
          onApply={applyDiscountToProduct}
        />
      )}
    </View>
  );
}

