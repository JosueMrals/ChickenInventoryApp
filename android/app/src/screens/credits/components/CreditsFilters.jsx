import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import styles from '../styles/creditsStyles';

// Solo Pendientes y Pagados: la vista completa vive en el Historial de créditos.
const FILTERS = [
  { id: 'pending', label: 'Pendientes', icon: 'clock-outline' },
  { id: 'paid', label: 'Pagados', icon: 'check-circle-outline' },
];

export default function CreditsFilters({ filter, onChange, counts = {} }) {
  return (
    <View style={styles.filters}>
      {FILTERS.map((f) => {
        const active = filter === f.id;
        const count = counts[f.id];
        return (
          <TouchableOpacity
            key={f.id}
            onPress={() => onChange(f.id)}
            style={[styles.filterBtn, active && styles.filterBtnActive]}
          >
            <Icon name={f.icon} size={13} color={active ? '#fff' : '#6B7280'} />
            <Text style={[styles.filterBtnText, active && styles.filterBtnTextActive]}>{f.label}</Text>
            {count != null && (
              <View style={[styles.filterCount, active && styles.filterCountActive]}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: active ? '#007AFF' : '#007AFF' }}>{count}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
