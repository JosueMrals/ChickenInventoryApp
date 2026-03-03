import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

export default function DelivererAssignmentsPanel({ assignments = [], loading = false, maxItems = 5 }) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Icon name="bicycle-outline" size={16} color="#FF9500" />
          <Text style={styles.title}>En reparto</Text>
        </View>
        {loading ? (
          <ActivityIndicator size="small" color="#FF9500" />
        ) : (
          <Text style={styles.count}>{assignments.length}</Text>
        )}
      </View>

      {!loading && assignments.length === 0 && (
        <Text style={styles.empty}>Sin productos en reparto.</Text>
      )}

      {assignments.map((group) => {
        const visibleItems = group.items.slice(0, maxItems);
        const remaining = Math.max(group.items.length - visibleItems.length, 0);

        return (
          <View key={group.entregadorId} style={styles.group}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupTitle} numberOfLines={1}>{group.entregadorName}</Text>
              <Text style={styles.groupQty}>x{group.totalQty}</Text>
            </View>
            {visibleItems.map((item) => (
              <View key={`${group.entregadorId}-${item.productId}`} style={styles.row}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.qty}>x{item.qty}</Text>
              </View>
            ))}
            {remaining > 0 && (
              <Text style={styles.more}>+{remaining} más</Text>
            )}
          </View>
        );
      })}
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
    color: '#FF9500',
    fontWeight: '700',
  },
  empty: {
    fontSize: 12,
    color: '#8E8E93',
  },
  group: {
    marginBottom: 10,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  groupTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#2C2C2E',
    marginRight: 8,
  },
  groupQty: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF9500',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
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
    color: '#FF9500',
  },
  more: {
    fontSize: 12,
    color: '#FF9500',
    marginTop: 2,
  },
});

