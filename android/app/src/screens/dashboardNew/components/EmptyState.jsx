import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import styles from '../styles/dashboardStyles';

export default function EmptyState({ onRegisterPress }) {
  return (
    <View style={styles.emptyContainer}>
      <Image
        //source={require('../../../assets/empty-bag.png')}
        style={styles.emptyImage}
      />

      <Text style={styles.emptyTitle}>No tienes ítems aún</Text>
      <Text style={styles.emptySubtitle}>
        Añade tus productos o servicios para venderlos
      </Text>

      <TouchableOpacity style={styles.primaryBtn} onPress={onRegisterPress}>
        <Text style={styles.primaryBtnText}>Registrar venta</Text>
      </TouchableOpacity>
    </View>
  );
}
