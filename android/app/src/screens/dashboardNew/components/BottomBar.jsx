import React from 'react';
import { View, Text } from 'react-native';
import styles from '../styles/dashboardStyles';

export default function BottomBar() {
  return (
    <View style={styles.bottomBar}>
      <View style={styles.orderBubble}>
        <Text style={styles.orderText}>Pedidos</Text>
      </View>

      <Text style={styles.totalText}>0 ítems = $0.00</Text>
    </View>
  );
}
