import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useCustomers } from './hooks/useCustomers';
import { useSalesHistory } from './hooks/useSalesHistory';
import FilterTabs from './components/FilterTabs';
import styles from './styles/styles';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function CustomerDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const customerId = route?.params?.customerId ?? route?.params?.customer?.id;
  const role = route?.params?.role ?? 'user';

  const { customers, loading: cLoading } = useCustomers();
  const customer = (customers || []).find((c) => c.id === customerId) || route?.params?.customer || null;

  const { sales, filtered, loading: sLoading, filter, setFilter } = useSalesHistory(customerId);

  useEffect(() => {
    if (!customer) {
      // si no hay cliente, volver
      Alert.alert('Cliente no encontrado', 'El cliente solicitado no existe', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  }, [customer]);

  if (!customer || cLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  const discountedPriceFor = (price) => {
    // Si tipo Común -> precio base; si tiene discount -> aplicar
    const discount = customer.discount ?? 0;
    return price * (1 - discount / 100);
  };

  return (
    <View style={styles.container}>
      <View style={styles.detailHeader}>
        <View>
          <Text style={styles.nameLarge}>{customer.firstName} {customer.lastName}</Text>
          <Text style={styles.smallText}>{customer.type ?? 'Común'} {customer.discount ? `• ${customer.discount}%` : ''}</Text>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.smallText}>Límite: C${(customer.creditLimit ?? 0).toFixed(2)}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('CustomerEdit', { customer, role })} style={{ marginTop: 8 }}>
            <Icon name="pencil" size={22} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contacto</Text>
        <Text style={styles.text}>Tel: {customer.phone}</Text>
        <Text style={styles.text}>Cédula: {customer.cedula || '-'}</Text>
        <Text style={styles.text}>Dirección: {customer.address || '-'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Historial de ventas</Text>
        <FilterTabs value={filter} onChange={setFilter} />
        {sLoading ? (
          <ActivityIndicator />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => (
              <View style={styles.saleRow}>
                <View>
                  <Text style={styles.smallText}>#{item.saleNumber || item.id}</Text>
                  <Text style={styles.text}>{new Date(item.date).toLocaleString()}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.smallText}>Items: {item.items?.length ?? 0}</Text>
                  <Text style={styles.text}>Total: C${(item.total ?? 0).toFixed(2)}</Text>
                </View>
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </View>
    </View>
  );
}
