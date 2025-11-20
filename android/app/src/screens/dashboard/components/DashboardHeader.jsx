// src/dashboard/components/DashboardHeader.jsx
import React from 'react';
import { View, Text } from 'react-native';
import styles from '../styles/dashboardStyles';

export default function DashboardHeader({ user, role }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Bienvenido</Text>
      <Text style={styles.headerSubtitle}>
        {user.email} ({role.toUpperCase()})
      </Text>
    </View>
  );
}
