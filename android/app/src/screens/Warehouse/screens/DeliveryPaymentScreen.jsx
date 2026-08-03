import React, { useState, useMemo, useContext } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { completePreSalePayment } from '../services/deliveryService';
import { resolveCustomerName } from '../../../utils/customerUtils';
import { useAdaptiveBottom } from '../../../hooks/useAdaptiveBottom';
import { useSubmitLock } from '../../../hooks/useSubmitLock';
import { PreSaleContext } from '../../presales/context/preSaleContext';

export default function DeliveryPaymentScreen({ navigation, route }) {
  const { delivery } = route.params;
  const total = delivery.total || 0;
  const isCredit = delivery.paymentMethod === 'credit' || String(delivery.status || '').startsWith('credit_');
  const { bottomPadding } = useAdaptiveBottom();

  const [amountPaid, setAmountPaid] = useState('');
  // Cerrojo por ref: dos toques rápidos alcanzaban a llamar dos veces a
  // completePreSalePayment antes de que `disabled` surtiera efecto.
  const { submitting: loading, runLocked } = useSubmitLock();

  // El mapa de clientes lo mantiene PreSaleProvider a nivel app. Antes cada pantalla
  // de Bodega abría su propio listener sobre la colección `customers` completa.
  const { customersById } = useContext(PreSaleContext);

  const customerName = resolveCustomerName(delivery, customersById, 'Cliente');

  const change = useMemo(() => {
    const paid = parseFloat(amountPaid || 0);
    return Math.max(paid - total, 0);
  }, [amountPaid, total]);

  const remaining = useMemo(() => {
    const paid = parseFloat(amountPaid || 0);
    const diff = Math.max(total - paid, 0);
    return isCredit ? diff : 0;
  }, [amountPaid, total, isCredit]);

  const totalItems = useMemo(() => {
    const items = delivery.items || [];
    const bonuses = delivery.bonuses || [];
    return [...items, ...bonuses].reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
  }, [delivery.items, delivery.bonuses]);

  const handleConfirmPayment = async () => {
    const paid = parseFloat(amountPaid || 0);

    if (!isCredit) {
      if (isNaN(paid) || paid <= 0) {
        return Alert.alert("Monto inválido", "Ingresa un monto válido.");
      }
      if (paid < total) {
        return Alert.alert("Pago incompleto", `El monto es menor que el total ($${total.toFixed(2)}).`);
      }
    } else if (!isNaN(paid) && paid < 0) {
      return Alert.alert("Monto inválido", "El monto no puede ser negativo.");
    }

    return runLocked(async () => {
      try {
          await completePreSalePayment(delivery.id, isNaN(paid) ? 0 : paid);

          // Pass data to Done screen for ticket generation
          const completedSale = {
              ...delivery,
              amountPaid: isNaN(paid) ? 0 : paid,
              change: change,
              fechaPago: isCredit && paid < total ? null : new Date(), // Local approx until refetch
          };

          navigation.replace('DeliveryDone', { sale: completedSale });
      } catch (error) {
          console.error(error);
          Alert.alert("Error", "No se pudo registrar el pago. Intenta nuevamente.");
          throw error;   // libera el cerrojo para reintentar
      }
    }, { keepLockedOnSuccess: true }).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Cobrar entrega</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={{flex: 1}}>
                <Text style={styles.customerName}>{customerName}</Text>
                <Text style={styles.metaText}>#{delivery.id?.substring(0, 6).toUpperCase()} · {totalItems} items</Text>
              </View>
              {isCredit && (
                <View style={styles.creditBadge}>
                  <Text style={styles.creditBadgeText}>Crédito</Text>
                </View>
              )}
            </View>
            <Text style={styles.address}>{delivery.address || 'Sin dirección'}</Text>
            {!!delivery.phone && <Text style={styles.phoneText}>Tel: {delivery.phone}</Text>}
            <View style={styles.divider} />
            <View style={styles.row}>
                <Text style={styles.label}>Total a Cobrar:</Text>
                <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
            </View>
            {isCredit && (
              <View style={styles.rowSubtle}>
                <Text style={styles.subLabel}>Pendiente:</Text>
                <Text style={styles.subValue}>${remaining.toFixed(2)}</Text>
              </View>
            )}
        </View>

        <Text style={styles.sectionTitle}>Detalle de productos</Text>
        <View style={styles.itemsCard}>
          {(delivery.items || []).map((item, index) => (
            <View key={`item-${index}`} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.productName || item.name}</Text>
              <Text style={styles.itemQty}>{item.quantity}x</Text>
              <Text style={styles.itemTotal}>${(item.total || (item.unitPrice * item.quantity)).toFixed(2)}</Text>
            </View>
          ))}
          {(delivery.bonuses || []).map((item, index) => (
            <View key={`bonus-${index}`} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.productName || item.name}</Text>
              <Text style={styles.itemQty}>{item.quantity}x</Text>
              <Text style={styles.itemBonus}>Regalo</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Pago</Text>
        <Text style={styles.paymentHint}>
          {isCredit ? 'Pago opcional. Puedes registrar un abono parcial.' : 'Pago requerido antes de entregar.'}
        </Text>

        <View style={styles.inputContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
                style={styles.input}
                placeholder="0.00"
                keyboardType="numeric"
                value={amountPaid}
                onChangeText={setAmountPaid}
                autoFocus
            />
        </View>

        <View style={styles.changeContainer}>
            <Text style={styles.changeLabel}>{isCredit ? 'Cambio / Abono:' : 'Cambio a devolver:'}</Text>
            <Text style={[styles.changeValue, { color: change > 0 ? '#E65100' : '#888' }]}>
                ${change.toFixed(2)}
            </Text>
        </View>

      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomPadding }]}>
         <TouchableOpacity
            style={[styles.payButton, loading && styles.disabledButton]}
            onPress={handleConfirmPayment}
            disabled={loading}
         >
            {loading ? (
                <ActivityIndicator color="#fff" />
            ) : (
                <>
                    <Icon name="cash-outline" size={24} color="#fff" style={{marginRight: 10}}/>
                    <Text style={styles.payButtonText}>Confirmar Pago y Entregar</Text>
                </>
            )}
         </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FE',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    elevation: 2,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    padding: 20,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    marginBottom: 14,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
  },
  metaText: {
    fontSize: 11,
    color: '#6B7280',
  },
  creditBadge: {
    backgroundColor: '#111827',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  creditBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  address: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  phoneText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowSubtle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  label: {
    fontSize: 13,
    color: '#555',
  },
  subLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  subValue: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2DCE89',
  },
  sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#333',
      marginBottom: 6,
      marginTop: 6,
  },
  paymentHint: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  itemsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F2F6',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F2F6',
  },
  itemName: {
    flex: 1,
    fontSize: 12,
    color: '#111827',
    marginRight: 8,
  },
  itemQty: {
    fontSize: 12,
    color: '#6B7280',
    width: 36,
    textAlign: 'right',
  },
  itemTotal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    width: 80,
    textAlign: 'right',
  },
  itemBonus: {
    fontSize: 11,
    color: '#0F766E',
    fontWeight: '600',
    width: 80,
    textAlign: 'right',
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  payButton: {
    backgroundColor: '#2DCE89',
    borderRadius: 12,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  disabledButton: {
      opacity: 0.7,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    height: 52,
  },
  currencySymbol: {
    fontSize: 18,
    color: '#333',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: '#333',
    padding: 0,
  },
  changeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  changeLabel: {
    fontSize: 13,
    color: '#E65100',
    fontWeight: '500',
  },
  changeValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
