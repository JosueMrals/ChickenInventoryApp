import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

export default function PreSoldSummaryPanel({ items = [], loading = false, maxItems = 6 }) {
  const visibleItems = items.slice(0, maxItems);
  const remaining = Math.max(items.length - visibleItems.length, 0);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Icon name="cart-outline" size={16} color="#007AFF" />
          <Text style={styles.title}>Prevendidos</Text>
        </View>
        {loading ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : (
          <Text style={styles.count}>{items.length}</Text>
        )}
      </View>

      {!loading && visibleItems.length === 0 && (
        <Text style={styles.empty}>Sin productos prevendidos.</Text>
      )}

      {visibleItems.map((item) => (
        <View key={item.productId} style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.qty}>x{item.qty}</Text>
        </View>
      ))}

      {remaining > 0 && (
        <Text style={styles.more}>+{remaining} más</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  count: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '700',
  },
  empty: {
    fontSize: 12,
    color: '#8E8E93',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  name: {
    flex: 1,
    fontSize: 12,
    color: '#2C2C2E',
    marginRight: 8,
  },
  qty: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2E7D32',
  },
  more: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 4,
  },
});

