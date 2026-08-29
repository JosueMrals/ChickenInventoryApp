import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Platform, UIManager,
  View, Alert, Text, TextInput, TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getPreSaleById } from '../../../services/preSaleService';
import styles from '../styles/creditsStyles';
import globalStyles from '../../../styles/globalStyles';
import { useCredits } from '../hooks/useCredits';
import CreditCard from '../components/CreditCard';
import CreditPaymentModal from '../components/CreditPaymentModal';
import CreditsFilters, { formatRange } from '../components/CreditsFilters';
import CreditsHeader from '../components/CreditsHeader';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const STATUS_LABEL = { pending: 'Pendientes', paid: 'Pagados' };

export default function CreditsScreen({ route, user: userProp, role: roleProp }) {
  const navigation = useNavigation();
  const { user: routeUser, role: routeRole, initialFilter } = route.params || {};
  const user = routeUser || userProp || null;
  const role = routeRole || roleProp || null;
  const [search, setSearch] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);

  const {
    loading, loadError, filter, setFilter, filteredCredits, totals, counts,
    dateFrom, dateTo, setDateRange, clearFilters, reload,
    selectedCredit, paymentAmount, setPaymentAmount,
    modalVisible, openModal, closeModal, animValue,
    handleAbono, handleDelete, submittingPayment,
  } = useCredits(user, role, initialFilter || 'pending');

  const openHistory = useCallback(
    () => navigation.navigate('CreditsHistory', { user, role }),
    [navigation, user, role],
  );

  const handleEditPreSale = useCallback(async (credit) => {
    if (!credit?.preSaleId) {
      Alert.alert('Sin preventa', 'Este crédito no está vinculado a una pre-venta.');
      return;
    }
    try {
      const presale = await getPreSaleById(credit.preSaleId);
      if (!presale) { Alert.alert('No encontrada', 'No se encontró la pre-venta asociada.'); return; }
      navigation.navigate('PreSaleDetail', { presale, role });
    } catch (error) {
      Alert.alert('Error', 'No se pudo cargar la pre-venta.');
    }
  }, [navigation, role]);

  const openDetail = useCallback(
    (credit) => navigation.navigate('CreditDetail', { credit, user, role }),
    [navigation, user, role],
  );

  const normalize = (v) => (v || '').toString().toLowerCase().trim();

  const visibleCredits = useMemo(() => {
    const query = normalize(search);
    if (!query) return filteredCredits;
    return filteredCredits.filter((credit) => {
      const haystack = [credit.id, credit.customerName, credit.clientName, credit.total, credit.paid, credit.pending]
        .filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [filteredCredits, search]);

  // Estado y fechas viven en el menú de 3 puntos: sin este resumen la lista
  // aparecería acotada sin decir por qué.
  const rangeLabel = formatRange(dateFrom, dateTo);
  const filtersActive = filter !== 'pending' || !!rangeLabel;

  // renderItem inline se recreaba en cada tecla del buscador y anulaba el
  // React.memo de CreditCard: con useCallback solo re-renderiza lo que cambió.
  const renderItem = useCallback(({ item }) => (
    <CreditCard
      item={item}
      role={role}
      onAbonar={openModal}
      onDelete={handleDelete}
      onEditPreSale={handleEditPreSale}
      onViewDetail={openDetail}
    />
  ), [role, openModal, handleDelete, handleEditPreSale, openDetail]);

  const header = (
    <CreditsHeader
      totals={totals}
      onBack={() => navigation.goBack()}
      onOpenMenu={() => setMenuVisible(true)}
      filtersActive={filtersActive}
    />
  );

  const menu = (
    <CreditsFilters
      visible={menuVisible}
      onClose={() => setMenuVisible(false)}
      filter={filter}
      onChangeFilter={setFilter}
      counts={counts}
      dateFrom={dateFrom}
      dateTo={dateTo}
      onChangeRange={setDateRange}
      onClear={clearFilters}
      onOpenHistory={openHistory}
    />
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F3F7' }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 10, color: '#6B7280', fontSize: 13 }}>Cargando créditos...</Text>
      </View>
    );
  }

  // Antes un query fallido dejaba la pantalla girando para siempre; ahora se
  // explica el motivo en vez de aparentar que no hay créditos.
  if (loadError) {
    const isBuildingIndex = String(loadError?.message || '').includes('index');
    return (
      <View style={globalStyles.container}>
        {header}
        {menu}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 }}>
          <Icon name="alert-circle-outline" size={56} color="#FF3B30" />
          <Text style={{ marginTop: 12, fontSize: 15, fontWeight: '700', color: '#1A1A1A', textAlign: 'center' }}>
            No se pudieron cargar los créditos
          </Text>
          <Text style={{ marginTop: 6, fontSize: 13, color: '#8E8E93', textAlign: 'center' }}>
            {isBuildingIndex
              ? 'La base de datos está terminando de preparar un índice. Vuelve a intentarlo en unos minutos.'
              : (loadError?.message || 'Revisa tu conexión e intenta de nuevo.')}
          </Text>
          <TouchableOpacity
            style={{ marginTop: 20, backgroundColor: '#007AFF', borderRadius: 30, paddingVertical: 12, paddingHorizontal: 26 }}
            onPress={reload}
            activeOpacity={0.85}
          >
            <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={globalStyles.container}>
      {header}

      <View style={styles.screenContent}>
        {/* Search bar */}
        <View style={styles.searchWrap}>
          <Icon name="magnify" size={18} color="#9CA3AF" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por cliente, id o monto..."
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <Icon name="close-circle" size={16} color="#9CA3AF" onPress={() => setSearch('')} />
          )}
        </View>

        {/* Resumen de filtros activos (solo cuando no es la vista por defecto) */}
        {filtersActive && (
          <View style={styles.activeChipsRow}>
            {filter !== 'pending' && (
              <TouchableOpacity style={styles.activeChip} onPress={() => setFilter('pending')}>
                <Text style={styles.activeChipText}>{STATUS_LABEL[filter] || filter}</Text>
                <Icon name="close-circle" size={14} color="#007AFF" />
              </TouchableOpacity>
            )}
            {!!rangeLabel && (
              <TouchableOpacity style={styles.activeChip} onPress={() => setDateRange(null, null)}>
                <Icon name="calendar" size={13} color="#007AFF" />
                <Text style={styles.activeChipText}>{rangeLabel}</Text>
                <Icon name="close-circle" size={14} color="#007AFF" />
              </TouchableOpacity>
            )}
            <Text style={styles.activeChipsCount}>{visibleCredits.length}</Text>
          </View>
        )}

        <FlatList
          data={visibleCredits}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="credit-card-off-outline" size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>No hay créditos con esos filtros.</Text>
            </View>
          }
        />
      </View>

      {menu}

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
