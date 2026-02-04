// screen/customer/CustomerListScreen.jsx
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import CustomerCard from './components/CustomerCard';
import CustomerFab from './components/CustomerFab';
import CustomerFormModal from './CustomerFormModal';
import { useCustomers } from './hooks/useCustomers';
import styles from './styles/styles';

export default function CustomerListScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const role = route?.params?.role ?? 'user';

  const { customers, loading, create, update, remove } = useCustomers();
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  // Debug: imprimir customers cada vez que cambian
  useEffect(() => {
    console.log('[CustomerListScreen] customers length:', customers?.length ?? 0);
  }, [customers]);

  const filtered = (customers || []).filter((c) => {
    const text = `${c.firstName || ''} ${c.lastName || ''} ${c.cedula || ''}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

    const goToSaleRegister = (customer) => {
      navigation.navigate('Sales', {
        customerId: customer.id,
        customer,
        role,
      });
    };


  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando clientes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Clientes</Text>

      <TextInput style={styles.search} placeholder="Buscar cliente..." value={search} onChangeText={setSearch} />

      {(!customers || customers.length === 0) ? (
        <View style={{ padding: 20, alignItems: 'center' }}>
          <Text style={{ color: '#777' }}>
            No hay clientes cargados en esta vista.
          </Text>
          <Text style={{ color: '#aaa', marginTop: 8 }}>
            Si en la vista anterior sí los ves, revisa rutas de import en services/hooks (paths relativos).
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CustomerCard
              customer={item}
              role={role}
              onEdit={(c) => {
                setEditingCustomer(c);
                setModalVisible(true);
              }}
              onViewHistory={(c) =>
                navigation.navigate('CustomerDetail', { customerId: c.id, role })
              }
              onCreateSale={goToSaleRegister}
            />
          )}
          contentContainerStyle={{ paddingBottom: 120 }}
        />
      )}

      <CustomerFab
        visible={role === 'admin' || role === 'user'}
        onPress={() => {
          setEditingCustomer(null);
          setModalVisible(true);
        }}
      />

      <CustomerFormModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        customer={editingCustomer}
        role={role}
      />
    </View>
  );
}
