import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';

export default function SalesHistorySection({ sales, role, user }) {
  const [filterPeriod, setFilterPeriod] = React.useState('today');

  const filteredSales = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let userSales = role === 'admin' ? sales : sales.filter(s => s.soldById === user.uid);
    return userSales.filter(s => {
      if (!s.createdAt?.seconds) return false;
      const d = new Date(s.createdAt.seconds * 1000);
      switch (filterPeriod) {
        case 'today': return d >= startOfDay;
        case 'week': return d >= startOfWeek;
        case 'month': return d >= startOfMonth;
        default: return true;
      }
    });
  }, [sales, filterPeriod]);

  const total = filteredSales.reduce((a, s) => a + (s.total || 0), 0);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginVertical: 10 }}>
        {['today', 'week', 'month', 'all'].map((k) => (
          <TouchableOpacity
            key={k}
            onPress={() => setFilterPeriod(k)}
            style={{
              backgroundColor: filterPeriod === k ? '#007AFF' : '#E0E0E0',
              padding: 6,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: filterPeriod === k ? '#fff' : '#333', fontWeight: '600' }}>
              {k === 'today' ? 'Hoy' : k === 'week' ? 'Semana' : k === 'month' ? 'Mes' : 'Todo'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={{ textAlign: 'center', fontWeight: '700', color: '#007AFF' }}>
        Total: ${total.toFixed(2)}
      </Text>

      <FlatList
        data={filteredSales}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={{ backgroundColor: '#fff', margin: 8, borderRadius: 10, padding: 14 }}>
            <Text style={{ fontWeight: '700' }}>{item.productName}</Text>
            <Text>Cliente: {item.customerName}</Text>
            <Text>{item.quantity} × ${item.price}</Text>
            <Text style={{ color: '#007AFF', fontWeight: '700' }}>Total: ${item.total}</Text>
            {item.pending > 0 && <Text style={{ color: '#FF3B30' }}>Pendiente: ${item.pending}</Text>}
          </View>
        )}
      />
    </View>
  );
}
