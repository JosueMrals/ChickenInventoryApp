// Detalle del cliente: contacto, indicadores de crédito y todas sus compras
// (ventas rápidas + preventas concretadas) en tiempo real.
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import globalStyles from '../../styles/globalStyles';
import styles from './styles/customerDetailStyles';
import { useCustomers } from './hooks/useCustomers';
import { useCustomerActivity } from './hooks/useCustomerActivity';
import CustomerCreditIndicators from './components/CustomerCreditIndicators';
import FilterTabs from './components/FilterTab';
import { startOfToday, startOfWeek, startOfMonth } from '../../utils/dateHelpers';

const STATUS_LABELS = {
  paid: 'Pagada',
  delivered: 'Entregada',
  dispatched: 'En reparto',
  returned: 'Devuelta',
  partially_returned: 'Dev. parcial',
  credit_pending: 'Crédito en bodega',
  credit_preparing: 'Crédito en bodega',
  credit_ready_for_delivery: 'Crédito listo',
  credit_dispatched: 'Crédito por cobrar',
};

const formatDate = (date) =>
  date && date.getTime() > 0
    ? date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Sin fecha';

const PurchaseCard = ({ item }) => {
  const isPresale = item.__source === 'presale';
  const isCredit = item.paymentMethod === 'credit' || String(item.status || '').startsWith('credit_');
  const number = isPresale
    ? `Pre-venta #${item.preSaleNumber || item.id.substring(0, 6).toUpperCase()}`
    : `Venta #${item.receiptNumber || item.id.substring(0, 6).toUpperCase()}`;
  const itemsCount = (item.items || []).reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
  const statusLabel = isPresale ? STATUS_LABELS[item.status] : null;

  return (
    <View style={styles.purchaseCard}>
      <View style={styles.purchaseRow}>
        <View style={styles.purchaseInfo}>
          <Text style={styles.purchaseTitle}>{number}</Text>
          <Text style={styles.purchaseMeta}>{formatDate(item.__date)} · {itemsCount} producto(s)</Text>
        </View>
        <Text style={styles.purchaseTotal}>C${(Number(item.total) || 0).toFixed(2)}</Text>
      </View>
      {(statusLabel || isCredit) && (
        <View style={styles.purchaseBadges}>
          {statusLabel && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{statusLabel}</Text>
            </View>
          )}
          {isCredit && (
            <View style={[styles.badge, styles.badgeCredit]}>
              <Text style={[styles.badgeText, styles.badgeCreditText]}>Crédito</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default function CustomerDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const customerId = route?.params?.customerId ?? route?.params?.customer?.id;
  const role = route?.params?.role ?? 'user';
  const [filter, setFilter] = useState('all');

  const { customers, loading: cLoading } = useCustomers();
  const customer = (customers || []).find((c) => c.id === customerId) || route?.params?.customer || null;
  const { purchases, credits, loading: aLoading } = useCustomerActivity(customerId);

  const filteredPurchases = useMemo(() => {
    if (filter === 'all') return purchases;
    const from =
      filter === 'today' ? startOfToday()
      : filter === 'week' ? startOfWeek()
      : startOfMonth();
    return purchases.filter((p) => p.__date >= from);
  }, [purchases, filter]);

  if (!customer || cLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando cliente...</Text>
      </View>
    );
  }

  const fullName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Cliente';
  const initials = `${(customer.firstName || '?')[0]}${(customer.lastName || '?')[0]}`.toUpperCase();
  const discount = Number(customer.discount) || 0;

  return (
    <View style={styles.container}>
      <View style={globalStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="arrow-left" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={globalStyles.title}>Detalle del Cliente</Text>
        <View style={{ width: 26 }} />
      </View>

      <FlatList
        data={filteredPurchases}
        keyExtractor={(item) => `${item.__source}-${item.id}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <PurchaseCard item={item} />}
        ListHeaderComponent={
          <>
            {/* Encabezado con datos del cliente */}
            <View style={styles.headerCard}>
              <View style={styles.headerTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{fullName}</Text>
                  <Text style={styles.typeText}>
                    {customer.type || 'Común'}{discount > 0 ? ` · ${discount}% desc.` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => navigation.navigate('CustomerForm', { customer, role })}
                >
                  <Icon name="pencil" size={18} color="#007AFF" />
                </TouchableOpacity>
              </View>
              <View style={styles.contactBlock}>
                <View style={styles.contactRow}>
                  <Icon name="phone-outline" size={14} color="#8E8E93" />
                  <Text style={styles.contactText}>{customer.phone || 'Sin teléfono'}</Text>
                </View>
                <View style={styles.contactRow}>
                  <Icon name="card-account-details-outline" size={14} color="#8E8E93" />
                  <Text style={styles.contactText}>{customer.cedula || 'Sin cédula'}</Text>
                </View>
                <View style={styles.contactRow}>
                  <Icon name="map-marker-outline" size={14} color="#8E8E93" />
                  <Text style={styles.contactText}>{customer.address || 'Sin dirección'}</Text>
                </View>
              </View>
            </View>

            {/* Indicadores de crédito y comportamiento de pago */}
            <CustomerCreditIndicators customer={customer} credits={credits} />

            {/* Historial de compras */}
            <View style={styles.purchasesHeader}>
              <Text style={styles.sectionTitle}>Compras</Text>
              <Text style={styles.purchasesCount}>{filteredPurchases.length} registro(s)</Text>
            </View>
            <FilterTabs value={filter} onChange={setFilter} />
            {aLoading && <ActivityIndicator style={{ marginVertical: 10 }} color="#007AFF" />}
          </>
        }
        ListEmptyComponent={
          !aLoading && (
            <View style={styles.emptyState}>
              <Icon name="cart-outline" size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>Este cliente aún no tiene compras registradas.</Text>
            </View>
          )
        }
      />
    </View>
  );
}
