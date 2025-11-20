import React from 'react';
import { View, Text } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import styles from '../styles/dashboardStyles';

export default function StatCard({ icon, color, title, value }) {
  return (
    <View style={[styles.statCard, { backgroundColor: color }]}>
      <View>
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
      <Ionicons name={icon} size={30} color="#fff" />
    </View>
  );
}
