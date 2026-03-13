import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  UIManager,
  View,
  Alert,
  Text,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getPreSaleById } from '../../../services/preSaleService';
import styles from '../styles/creditsStyles';
import { useCredits } from '../hooks/useCredits';
import CreditCard from '../components/CreditCard';
import CreditPaymentModal from '../components/CreditPaymentModal';
import CreditsFilters from '../components/CreditsFilters';
import CreditsHeader from '../components/CreditsHeader';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CreditsScreen({ route, user: userProp, role: roleProp }) {
  const navigation = useNavigation();
  const { user: routeUser, role: routeRole, initialFilter } = route.params || {};
  const user = routeUser || userProp || null;
  const role = routeRole || roleProp || null;
  const [search, setSearch] = useState('');
  const {
    loading,
    filter,
    setFilter,
    filteredCredits,
    totals,
    selectedCredit,
    paymentAmount,
    setPaymentAmount,
    modalVisible,
    openModal,
    closeModal,
    animValue,
    handleAbono,
    handleDelete,
    submittingPayment,
  } = useCredits(user, role, initialFilter || 'pending');

  const handleEditPreSale = async (credit) => {
    if (!credit?.preSaleId) {
      Alert.alert('Sin preventa', 'Este crédito no está vinculado a una pre-venta.');
      return;
    }

    try {
      const presale = await getPreSaleById(credit.preSaleId);
      if (!presale) {
        Alert.alert('No encontrada', 'No se encontró la pre-venta asociada.');
        return;
      }
      navigation.navigate('PreSaleDetail', { presale, role });
    } catch (error) {
      console.error('Error loading pre-sale:', error);
      Alert.alert('Error', 'No se pudo cargar la pre-venta.');
    }
  };

  const normalize = (value) => (value || '').toString().toLowerCase().trim();

  const visibleCredits = useMemo(() => {
    const query = normalize(search);
    if (!query) return filteredCredits;
    return filteredCredits.filter((credit) => {
      const haystack = [
        credit.id,
        credit.customerName,
        credit.clientName,
        credit.total,
        credit.paid,
        credit.pending,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [filteredCredits, search]);

  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );

  return (
    <View style={styles.container}>
      <CreditsHeader
        totals={totals}
        onOpenHistory={() => navigation.navigate('CreditsHistory', { user, role })}
      />

      <View style={styles.screenContent}>
        <Text style={styles.sectionTitle}>Créditos activos</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por cliente, id o monto"
          placeholderTextColor="#94A3B8"
          style={styles.searchInput}
        />
        <CreditsFilters filter={filter} onChange={setFilter} />

        <FlatList
          data={visibleCredits}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <CreditCard
              item={item}
              role={role}
              onAbonar={openModal}
              onDelete={handleDelete}
              onEditPreSale={handleEditPreSale}
              onViewDetail={(credit) => navigation.navigate('CreditDetail', { credit, user, role })}
            />
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No hay créditos con esos filtros.</Text>
            </View>
          }
        />
      </View>

      <CreditPaymentModal
        visible={modalVisible}
        selectedCredit={selectedCredit}
        animValue={animValue}
        paymentAmount={paymentAmount}
        onChangeAmount={setPaymentAmount}
        onConfirm={handleAbono}
        onCancel={closeModal}
        submitting={submittingPayment}
      />
    </View>
  );
}
