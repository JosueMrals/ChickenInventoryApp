import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import styles from '../styles/creditsStyles';

const FILTERS = ['all', 'pending', 'paid'];

export default function CreditsFilters({ filter, onChange }) {
  return (
    <View style={styles.filters}>
      {FILTERS.map((f) => (
        <TouchableOpacity
          key={f}
          onPress={() => onChange(f)}
          style={[
            styles.filterBtn,
            { backgroundColor: filter === f ? '#007AFF' : '#E0E0E0' },
          ]}
        >
          <Text style={{ color: filter === f ? '#fff' : '#333', fontWeight: '600' }}>
            {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendientes' : 'Pagados'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

