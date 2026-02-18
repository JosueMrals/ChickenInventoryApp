import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import { completePreSalePayment } from '../services/deliveryService';
import { resolveCustomerName } from '../../../utils/customerUtils';

export default function DeliveryPaymentScreen({ navigation, route }) {
  const { delivery } = route.params;
  const total = delivery.total || 0;

  const [amountPaid, setAmountPaid] = useState('');
  const [loading, setLoading] = useState(false);
  const [customersById, setCustomersById] = useState({});

  useEffect(() => {
    const unsub = firestore()
      .collection('customers')
      .onSnapshot((snapshot) => {
        const map = snapshot.docs.reduce((acc, doc) => {
          acc[doc.id] = { id: doc.id, ...doc.data() };
          return acc;
        }, {});
        setCustomersById(map);
      });

    return () => unsub();
  }, []);

  const customerName = resolveCustomerName(delivery, customersById, 'Cliente');

  const change = useMemo(() => {
    const paid = parseFloat(amountPaid || 0);
    return Math.max(paid - total, 0);
  }, [amountPaid, total]);

  const handleConfirmPayment = async () => {
    const paid = parseFloat(amountPaid || 0);

    if (isNaN(paid) || paid <= 0) {
      return Alert.alert("Monto inválido", "Ingresa un monto válido.");
    }

    if (paid < total) {
      return Alert.alert("Pago incompleto", `El monto es menor que el total ($${total.toFixed(2)}).`);
    }

    setLoading(true);
    try {
        await completePreSalePayment(delivery.id);

        // Pass data to Done screen for ticket generation
        const completedSale = {
            ...delivery,
            amountPaid: paid,
            change: change,
            fechaPago: new Date(), // Local approx until refetch
        };

        navigation.replace('DeliveryDone', { sale: completedSale });
    } catch (error) {
        setLoading(false);
        console.error(error);
        Alert.alert("Error", "No se pudo registrar el pago. Intenta nuevamente.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}> cobrar Entrega</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.summaryCard}>
            <Text style={styles.customerName}>{customerName}</Text>
            <Text style={styles.address}>{delivery.address || 'Sin dirección'}</Text>
            <View style={styles.divider} />
            <View style={styles.row}>
                <Text style={styles.label}>Total a Cobrar:</Text>
                <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
            </View>
        </View>

        <Text style={styles.sectionTitle}>Método de Pago: Efectivo</Text>

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
            <Text style={styles.changeLabel}>Cambio a devolver:</Text>
            <Text style={[styles.changeValue, { color: change > 0 ? '#E65100' : '#888' }]}>
                ${change.toFixed(2)}
            </Text>
        </View>

      </ScrollView>

      <View style={styles.footer}>
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
    padding: 20,
    elevation: 3,
    marginBottom: 30,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  address: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginBottom: 15,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    color: '#555',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2DCE89',
  },
  sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#333',
      marginBottom: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 20,
    height: 60,
  },
  currencySymbol: {
    fontSize: 24,
    color: '#333',
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 24,
    color: '#333',
    padding: 0,
  },
  changeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  changeLabel: {
    fontSize: 16,
    color: '#E65100',
    fontWeight: '500',
  },
  changeValue: {
    fontSize: 20,
    fontWeight: 'bold',
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
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  disabledButton: {
      opacity: 0.7,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
