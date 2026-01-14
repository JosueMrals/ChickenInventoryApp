import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import styles from "../styles/cartItemStyles";

const formatCurrency = (value) => `C$${(Number(value) || 0).toFixed(2)}`;

export default function CartItem({ item, onUpdate, onDiscount, onRemove }) {
  const product = item.product || { name: 'Producto no disponible' };
  const quantity = Number(item.quantity) || 0;

  // --- FIX: Use the onUpdate prop instead of context ---
  const handleUpdateQuantity = (newQuantity) => {
    if (item.isBonus) return;
    
    if (newQuantity <= 0) {
      onRemove();
      return;
    }
    
    // Call the function passed via props from the parent screen
    if (onUpdate) {
      onUpdate({ quantity: newQuantity });
    }
  };
  
  const NormalItem = () => (
    <View style={styles.card}>
      <View style={styles.left}>
        <Text style={styles.title}>{product.name}</Text>
        <Text style={styles.subtitle}>{quantity} x {formatCurrency(item.unitPrice)}</Text>
        {item.discount > 0 && <Text style={styles.discountText}>Descuento: -{formatCurrency(item.discount)}</Text>}
        <Text style={styles.totalText}>{formatCurrency(item.total)}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.btn} onPress={() => handleUpdateQuantity(quantity - 1)}>
          <Icon name="remove-circle-outline" size={26} color="#FF9500" />
        </TouchableOpacity>
        <Text style={styles.quantityDisplay}>{quantity}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => handleUpdateQuantity(quantity + 1)}>
          <Icon name="add-circle-outline" size={26} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={onDiscount}>
          <Icon name="pricetag-outline" size={22} color="#34C759" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={onRemove}>
          <Icon name="trash-outline" size={22} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const BonusItem = () => (
    <View style={[styles.card, styles.bonusCard]}>
      <View style={styles.left}>
        <View style={styles.bonusTag}>
          <Text style={styles.bonusTagText}>BONIFICACIÓN</Text>
        </View>
        <Text style={styles.title}>{product.name}</Text>
        <Text style={styles.subtitle}>{quantity} x GRATIS</Text>
      </View>
      <View style={styles.actions}>
         <Icon name="gift" size={24} color="#007AFF" />
         <Text style={[styles.quantityDisplay, {marginLeft: 8}]}>{quantity}</Text>
      </View>
    </View>
  );

  return item.isBonus ? <BonusItem /> : <NormalItem />;
}