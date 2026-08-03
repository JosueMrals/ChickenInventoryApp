// screen/customer/CustomerListScreen.jsx
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, SafeAreaView,
    TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from "react-native-vector-icons/Ionicons";
import CustomerCard from './components/CustomerCard';
import CustomerFab from './components/CustomerFab';
import CustomerInfoSheet from './components/CustomerInfoSheet';
import { useCustomers } from './hooks/useCustomers';
import styles from './styles/styles';
import SearchBar from '../../components/SearchBar';
import globalStyles from '../../styles/globalStyles';
import { useAdaptiveBottom } from '../../hooks/useAdaptiveBottom';
import { normalizeText } from '../../utils/textUtils';

export default function CustomerListScreen({ role: roleProp }) {
  const navigation = useNavigation();
  const route = useRoute();
  const role = roleProp || route?.params?.role || 'vendedor';

  // El entregador consulta clientes en ruta: solo lectura, sin crear/editar/eliminar.
  const canManage = role === 'admin' || role === 'vendedor';

  const { customers, loading, create, update, remove } = useCustomers();
  const [search, setSearch] = useState('');
  const [infoCustomer, setInfoCustomer] = useState(null);
  const { bottomPadding } = useAdaptiveBottom();

  // Búsqueda sin tildes: "martinez" encuentra a "Martínez".
  //
  // El texto normalizado se calcula una vez por cambio de `customers`, NO por
  // tecla: normalizeText() sobre 5 campos concatenados por cliente en cada
  // pulsación era el trabajo más caro de esta pantalla.
  const searchIndex = useMemo(
    () =>
      (customers || []).map((c) => ({
        customer: c,
        haystack: normalizeText(
          `${c.firstName || ''} ${c.lastName || ''} ${c.cedula || ''} ${c.phone || ''} ${c.address || ''}`
        ),
      })),
    [customers]
  );

  const query = normalizeText(search);
  const filtered = useMemo(() => {
    if (!query) return customers || [];
    return searchIndex.filter((e) => e.haystack.includes(query)).map((e) => e.customer);
  }, [searchIndex, query, customers]);

  const goToSaleRegister = useCallback((customer) => {
    navigation.navigate('Sales', {
      customerId: customer.id,
      customer,
      role,
    });
  }, [navigation, role]);

  const goToCustomerForm = useCallback((customerToEdit) => {
    navigation.navigate('CustomerForm', { customer: customerToEdit, role });
  }, [navigation, role]);

  const goToCustomerDetail = useCallback((customer) => {
    navigation.navigate('CustomerDetail', { customerId: customer.id, role });
  }, [navigation, role]);

  const handleDelete = useCallback((customer) => {
    Alert.alert(
      'Eliminar cliente',
      `¿Estás seguro de eliminar a ${customer.firstName || ''} ${customer.lastName || ''}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await remove(customer.id);
            } catch (err) {
              console.error('Error eliminando cliente:', err);
              Alert.alert('Error', 'No se pudo eliminar el cliente.');
            }
          },
        },
      ]
    );
  }, [remove]);

  // Identidad estable: si se construyera en el renderItem, cada fila recibiría un
  // prop nuevo en cada render y React.memo(CustomerCard) no serviría de nada.
  const onDelete = role === 'admin' ? handleDelete : undefined;

  const renderItem = useCallback(({ item }) => (
    <CustomerCard
      customer={item}
      role={role}
      readOnly={!canManage}
      onViewInfo={setInfoCustomer}
      onEdit={goToCustomerForm}
      onViewHistory={goToCustomerDetail}
      onCreateSale={goToSaleRegister}
      onDelete={onDelete}
    />
  ), [role, canManage, goToCustomerForm, goToCustomerDetail, goToSaleRegister, onDelete]);


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
        placeholder={canManage ? 'Buscar cliente...' : 'Buscar por nombre, teléfono o dirección...'}
        onClear={() => setSearch('')}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        windowSize={10}
        removeClippedSubviews={true}
        ListEmptyComponent={(
          <View style={{ alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 }}>
            <Icon name="people-outline" size={64} color="#D1D5DB" />
            <Text style={{ color: '#8E8E93', fontSize: 14, marginTop: 12, textAlign: 'center' }}>
              {search ? 'Ningún cliente coincide con la búsqueda.' : 'Todavía no hay clientes registrados.'}
            </Text>
          </View>
        )}
      />

      <CustomerFab
        visible={canManage}
        onPress={() => goToCustomerForm(null)}
        bottom={bottomPadding + 12}
      />

      <CustomerInfoSheet
        visible={!!infoCustomer}
        customer={infoCustomer}
        onClose={() => setInfoCustomer(null)}
      />
    </SafeAreaView>
  );
}
