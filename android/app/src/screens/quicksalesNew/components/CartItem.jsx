import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import styles from '../styles/cartItemStyles';

export default function CartItem({ item, onEdit, onDiscount, onRemove }) {
  const qty = Number(item.quantity || 0);
  const price = Number(item.price || 0);
  const lineTotal = qty * price;

  // discount display
  let discountText = 'No';
  if (item.discountType === 'percent') discountText = `${item.discountValue}%`;
  if (item.discountType === 'amount') discountText = `C$${Number(item.discountValue || 0).toFixed(2)}`;

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.left} onPress={onEdit}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.sku}>{item.sku ?? ''}</Text>
      </TouchableOpacity>

      <View style={styles.right}>
        <Text style={styles.unit}>C${price.toFixed(2)}</Text>
        <Text style={styles.total}>C${lineTotal.toFixed(2)}</Text>

        <View style={styles.actions}>
          <TouchableOpacity onPress={onEdit} style={styles.actionBtn}>
            <Icon name="create-outline" size={18} color="#007AFF" />
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onDiscount} style={styles.actionBtn}>
            <Icon name="pricetag-outline" size={18} color="#FF3B30" />
            <Text style={styles.actionText}>{discountText}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onRemove} style={styles.actionBtn}>
            <Icon name="trash-outline" size={18} color="#999" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
