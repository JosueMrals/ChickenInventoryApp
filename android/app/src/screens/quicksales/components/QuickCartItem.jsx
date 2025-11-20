import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import styles from '../styles/quickCartStyles';

export default function QuickCartItem({ item, updateQty, removeItem }) {
  return (
    <View style={styles.cartItem}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cartName}>{item.product.name}</Text>
        <Text style={styles.cartSub}>
          C${item.price.toFixed(2)} · Sub: C${item.subtotal.toFixed(2)}
        </Text>
      </View>

      <View style={styles.qtyControl}>
        <TouchableOpacity onPress={() => updateQty(item.productId, Math.max(1, item.qty - 1))}>
          <Icon name="minus-circle" size={24} color="#007AFF" />
        </TouchableOpacity>

        <Text style={styles.qtyText}>{item.qty}</Text>

        <TouchableOpacity onPress={() => updateQty(item.productId, item.qty + 1)}>
          <Icon name="plus-circle" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => removeItem(item.productId)}>
        <Icon name="delete" size={22} color="#FF3B30" />
      </TouchableOpacity>
    </View>
  );
}
