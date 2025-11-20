// CustomerInfoCard.jsx
import React from 'react';
import { View, Text } from 'react-native';
import styles from '../styles/customerInfoCardStyles';

export default function CustomerInfoCard({ customer }) {
  if (!customer) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{customer.firstName} {customer.lastName}</Text>
      <Text style={styles.small}>Tipo: {customer.type} • Desc: {customer.discount}%</Text>
      <Text style={styles.small}>Límite: C${(customer.creditLimit || 0).toFixed(2)}</Text>
    </View>
  );
}
