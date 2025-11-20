import React from 'react';
import { View, Text } from 'react-native';
import styles from '../styles/dashboardStyles';

export default function QuickActions() {
  return (
    <View style={styles.actionsContainer}>
      <Text style={styles.sectionTitle}>Acciones rápidas</Text>
      {/* Aquí puedes agregar módulos más tarde */}
    </View>
  );
}
