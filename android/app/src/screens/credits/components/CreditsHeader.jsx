import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import styles from '../styles/creditsStyles';

export default function CreditsHeader({ totals, onOpenHistory }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerText}>Créditos</Text>
          <Text style={styles.headerSubText}>
            Pagados: C${totals.paid.toFixed(2)} | Pendientes: C${totals.pending.toFixed(2)}
          </Text>
        </View>
        {onOpenHistory && (
          <TouchableOpacity style={styles.historyButton} onPress={onOpenHistory}>
            <Text style={styles.historyButtonText}>Historial</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
