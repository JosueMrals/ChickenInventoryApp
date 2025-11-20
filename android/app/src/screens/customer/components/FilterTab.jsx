import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import styles from '../styles/styles';

export default function FilterTabs({ value, onChange }) {
  const tabs = [
    { key: 'today', label: 'Hoy' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mes' },
    { key: 'all', label: 'Todo' },
  ];

  return (
    <View style={styles.tabs}>
      {tabs.map((t) => (
        <TouchableOpacity
          key={t.key}
          onPress={() => onChange(t.key)}
          style={[styles.tabButton, value === t.key && styles.tabActive]}
        >
          <Text style={[styles.tabText, value === t.key && styles.tabTextActive]}>{t.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
