// sales/components/SalesHistory.jsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import SaleReceipt from './SaleReceipt';

export default function SalesHistory({ role }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState('today');
  const [selectedSale, setSelectedSale] = useState(null);

  useEffect(() => {
    const unsubscribe = firestore()
      .collection('sales')
      .orderBy('createdAt', 'desc')
      .onSnapshot((snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setSales(data);
        setLoading(false);
      });

    return () => unsubscribe();
  }, []);

  const filteredSales = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return sales.filter((s) => {
      const saleDate = new Date(s.createdAt?.seconds * 1000);
      switch (filterPeriod) {
        case 'today':
          return saleDate >= startOfDay;
        case 'week':
          return saleDate >= startOfWeek;
        case 'month':
          return saleDate >= startOfMonth;
        default:
          return true;
      }
    });
  }, [sales, filterPeriod]);

  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F6FA' }}>
      {/* Header */}

      {/* Filtros */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginVertical: 10 }}>
        {[
          { key: 'today', label: 'Hoy' },
          { key: 'week', label: 'Semana' },
          { key: 'month', label: 'Mes' },
          { key: 'all', label: 'Todo' },
        ].map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilterPeriod(f.key)}
            style={{
              backgroundColor: filterPeriod === f.key ? '#007AFF' : '#E0E0E0',
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 8,
            }}
          >
            <Text
              style={{
                color: filterPeriod === f.key ? '#fff' : '#333',
                fontWeight: '600',
              }}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista de ventas */}
      <FlatList
        data={filteredSales}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 10 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setSelectedSale(item)}
            style={{
              backgroundColor: '#fff',
              borderRadius: 10,
              padding: 14,
              marginBottom: 8,
              elevation: 2,
            }}
          >
            <Text style={{ fontWeight: '700', color: '#007AFF' }}>
              #{item.receiptNumber || '—'}
            </Text>
            <Text>{item.clientName}</Text>
            <Text style={{ color: '#555' }}>
              {item.productName} × {item.quantity}
            </Text>
            <Text style={{ fontWeight: '700', color: '#333' }}>
              Total: ${item.total?.toFixed(2)}
            </Text>
            {item.pending > 0 && (
              <Text style={{ color: '#FF3B30' }}>Pendiente: ${item.pending}</Text>
            )}
          </TouchableOpacity>
        )}
      />

      {/* Voucher de solo lectura */}
      <SaleReceipt
        visible={!!selectedSale}
        saleData={selectedSale}
        onClose={() => setSelectedSale(null)}
        readOnly // 👈 Nueva prop para ocultar botón Editar
      />
    </View>
  );
}
