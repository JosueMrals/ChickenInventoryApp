import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import styles from '../styles/cartStyles';

export default function CartButton({ count, total, onPress }) {
  return (
    <TouchableOpacity style={styles.cartBtn} onPress={onPress}>
      <Icon name="cart" size={24} color="#fff" />
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{count}</Text>
      </View>
      <View style={styles.cartTotal}>
        <Text style={styles.cartTotalText}>C${total.toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );
}
