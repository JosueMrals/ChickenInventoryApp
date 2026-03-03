// screen/customer/CustomerListScreen.jsx
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, SafeAreaView, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from "react-native-vector-icons/Ionicons";
import CustomerCard from './components/CustomerCard';
import CustomerFab from './components/CustomerFab';
import { useCustomers } from './hooks/useCustomers';
import styles from './styles/styles';
import SearchBar from '../../components/SearchBar';
import globalStyles from '../../styles/globalStyles';

export default function CustomerListScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const role = route?.params?.role ?? 'vendedor';

  const { customers, loading, create, update, remove } = useCustomers();
  const [search, setSearch] = useState('');
  // const [modalVisible, setModalVisible] = useState(false);
  // const [editingCustomer, setEditingCustomer] = useState(null);

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

    const goToCustomerForm = (customerToEdit) => {
      navigation.navigate('CustomerForm', { customer: customerToEdit, role });
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
    <SafeAreaView style={globalStyles.container}>

      <View style={globalStyles.header}>
	  	<TouchableOpacity onPress={() => navigation.goBack()}>
		  <Icon name="chevron-back" size={26} color="#fff" />
		</TouchableOpacity>
        <Text style={globalStyles.title}>Clientes</Text>
      </View>

      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar cliente..."
        onClear={() => setSearch('')}
      />

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
              onEdit={(c) => goToCustomerForm(c)}
              onViewHistory={(c) =>
                navigation.navigate('CustomerDetail', { customerId: c.id, role })
              }
              onCreateSale={goToSaleRegister}
            />
          )}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          windowSize={10}
          removeClippedSubviews={true}
        />
      )}

      <CustomerFab
        visible={role === 'admin' || role === 'vendedor'}
        onPress={() => goToCustomerForm(null)}
      />
    </SafeAreaView>
  );
}
