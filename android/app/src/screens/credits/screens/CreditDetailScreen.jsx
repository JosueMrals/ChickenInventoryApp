import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { firestore } from '../../../services/firebaseConfig';
import styles from '../styles/creditsStyles';

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value) => {
  const date = toDate(value);
  return date ? date.toLocaleString() : 'Sin fecha';
};

const getCustomerName = (credit) => {
  const customerName = typeof credit?.customerName === 'string' ? credit.customerName.trim() : '';
  if (customerName) return customerName;

  const clientName = typeof credit?.clientName === 'string' ? credit.clientName.trim() : '';
  if (clientName) return clientName;

  return 'Cliente';
};

export default function CreditDetailScreen({ navigation, route }) {
  const { credit: initialCredit, user, role } = route.params || {};
  const [credit, setCredit] = useState(initialCredit || null);
  const [loading, setLoading] = useState(!initialCredit);

  useEffect(() => {
    if (!initialCredit?.id) {
      setLoading(false);
      return undefined;
    }

    const unsub = firestore()
      .collection('credits')
      .doc(initialCredit.id)
      .onSnapshot((doc) => {
        if (!doc.exists) {
          setCredit(null);
          setLoading(false);
          return;
        }
        setCredit({ id: doc.id, ...(doc.data() || {}) });
        setLoading(false);
      }, () => {
        setLoading(false);
      });

    return unsub;
  }, [initialCredit?.id]);

  const payments = useMemo(() => {
    const list = Array.isArray(credit?.payments) ? credit.payments : [];
    return [...list].sort((a, b) => {
      const aDate = toDate(a?.date)?.getTime() || 0;
      const bDate = toDate(b?.date)?.getTime() || 0;
      return bDate - aDate;
    });
  }, [credit?.payments]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!credit) {
    return (
      <View style={styles.container}>
        <View style={styles.historyHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.historyBack}>
            <Icon name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.historyHeaderTitle}>Detalle de Crédito</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No se encontró el crédito.</Text>
        </View>
      </View>
    );
  }

  const total = Number(credit.total) || 0;
  const paid = Number(credit.paid) || 0;
  const pending = Number(credit.pending) || 0;
  const customerName = getCustomerName(credit);

  return (
    <View style={styles.container}>
      <View style={styles.historyHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.historyBack}>
          <Icon name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.historyHeaderTitle}>Detalle de Crédito</Text>
      </View>

      <FlatList
        data={payments}
        keyExtractor={(_, index) => `${credit.id}-${index}`}
        contentContainerStyle={styles.detailContent}
        ListHeaderComponent={
          <View style={styles.detailCard}>
            <Text style={styles.detailCustomer}>{customerName}</Text>
            <Text style={styles.detailMeta}>ID: {credit.id}</Text>
            <Text style={styles.detailMeta}>Estado: {credit.status === 'paid' ? 'Pagado' : 'Pendiente'}</Text>
            <Text style={styles.detailMeta}>Creado: {formatDate(credit.createdAt)}</Text>
            <Text style={styles.detailMeta}>Pre-venta: {credit.preSaleId || 'No vinculada'}</Text>
            <Text style={styles.detailMeta}>Usuario pantalla: {user?.email || user?.user || 'No disponible'}</Text>
            <Text style={styles.detailMeta}>Rol: {role || 'No disponible'}</Text>

            <View style={styles.historyTotalsRow}>
              <Text style={styles.historyAmount}>Total: C${total.toFixed(2)}</Text>
              <Text style={styles.historyAmount}>Pagado: C${paid.toFixed(2)}</Text>
              <Text style={styles.historyAmount}>Pendiente: C${pending.toFixed(2)}</Text>
            </View>

            <Text style={styles.sectionTitle}>Historial de abonos</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.paymentItemCard}>
            <Text style={styles.paymentItemTitle}>C${Number(item?.amount || 0).toFixed(2)}</Text>
            <Text style={styles.paymentItemMeta}>Fecha: {formatDate(item?.date)}</Text>
            <Text style={styles.paymentItemMeta}>Registrado por: {item?.by || 'N/A'}</Text>
            <Text style={styles.paymentItemMeta}>
              Saldo: C${Number(item?.previousPending || 0).toFixed(2)} -> C${Number(item?.newPending || 0).toFixed(2)}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Este crédito aún no tiene abonos.</Text>
          </View>
        }
      />
    </View>
  );
}

