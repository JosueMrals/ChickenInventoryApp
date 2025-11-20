import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import styles from '../styles/quickCartStyles';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function QuickCartButton({ count, total, onPress }) {
  return (
    <TouchableOpacity style={styles.cartButton} onPress={onPress}>
      <Icon name="cart" size={24} color="#fff" />
      <Text style={styles.cartText}>{count} · C${total.toFixed(2)}</Text>
    </TouchableOpacity>
  );
}
