import React from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import styles from '../styles/cartStyles';

export default function CartItem({ item, onRemove, onUpdateQty }) {
  return (
    <View style={styles.cartItem}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cartItemName}>{item.product.name}</Text>
        <Text style={styles.cartItemMeta}>C${item.priceApplied.toFixed(2)} • Sub: C${item.subtotal.toFixed(2)}</Text>
      </View>

      <View style={styles.qtyControl}>
        <TouchableOpacity onPress={() => onUpdateQty(item.productId, Math.max(1, item.qty - 1))}>
          <Icon name="minus-circle" size={24} color="#007AFF" />
        </TouchableOpacity>

        <Text style={styles.qtyText}>{item.qty}</Text>

        <TouchableOpacity onPress={() => onUpdateQty(item.productId, item.qty + 1)}>
          <Icon name="plus-circle" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => onRemove(item.productId)} style={{ marginLeft: 8 }}>
        <Icon name="delete" size={22} color="#FF3B30" />
      </TouchableOpacity>
    </View>
  );
}
