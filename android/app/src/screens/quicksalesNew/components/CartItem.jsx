import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import styles from "../styles/cartItemStyles";

export default function CartItem({ item, onEdit, onDiscount, onRemove }) {
  const { product, quantity, unitPrice, total } = item;

  return (
    <View style={styles.card}>
      {/* INFO DEL PRODUCTO */}
      <View style={styles.left}>
        <Text style={styles.title}>{product.name}</Text>

        <Text style={styles.subtitle}>
          {quantity} x C${unitPrice.toFixed(2)}
        </Text>

        <Text style={styles.totalText}>C${total.toFixed(2)}</Text>
      </View>

      {/* ACCIONES */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.btn} onPress={onEdit}>
          <Icon name="create-outline" size={24} color="#007AFF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn} onPress={onDiscount}>
          <Icon name="pricetag-outline" size={24} color="#34C759" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn} onPress={onRemove}>
          <Icon name="trash-outline" size={24} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
