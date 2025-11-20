import React, { useState } from 'react';
import {
  View,
  Modal,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import QuickCartItem from './QuickCartItem';
import QuickCartTotals from './QuickCartTotals';
import QuickPaymentSelector from './QuickPaymentSelector';
import { registerQuickSale } from '../../../services/quickSaleService';
import styles from '../styles/quickCartStyles';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function QuickCartDrawer({
  visible,
  onClose,
  items,
  updateQty,
  removeItem,
  clearCart,
  totals,
  customerName,
}) {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [transferNumber, setTransferNumber] = useState('');
  const [discountPercent, setDiscountPercent] = useState('0');

  const subtotal = totals.subtotal;

  const register = async () => {
    const name = customerName?.trim() || 'Cliente Genérico';

    if (items.length === 0) {
      Alert.alert("Carrito vacío", "Agrega productos antes de continuar.");
      return;
    }

    const paid = parseFloat(paidAmount || 0);
    const discount = parseFloat(discountPercent || 0);
    const discountAmount = +(subtotal * (discount / 100)).toFixed(2);
    const total = +(subtotal - discountAmount).toFixed(2);
    const pending = Math.max(total - paid, 0);

    if (paymentMethod !== 'credit' && isNaN(paid)) {
      Alert.alert("Error", "Monto pagado inválido.");
      return;
    }

    const payload = {
      customerId: null,
      customerName: name,
      items,
      subtotal,
      discountPercent: discount,
      discountAmount,
      total,
      paymentMethod,
      transferNumber,
      paidAmount: paid,
      pendingAmount: pending,
      date: new Date(),
      type: 'quick',
    };

    try {
      await registerQuickSale(payload);
      Alert.alert("Éxito", "Venta rápida registrada correctamente.");
      clearCart();
      onClose();
    } catch (err) {
      console.error(err);
      Alert.alert("Error", err.message);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.drawerOverlay}>
        <View style={styles.drawer}>
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>Carrito ({totals.count})</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }}>
            {items.map((it) => (
              <QuickCartItem
                key={it.productId}
                item={it}
                updateQty={updateQty}
                removeItem={removeItem}
              />
            ))}
          </ScrollView>

          <View style={{ padding: 12 }}>
            <QuickCartTotals
              subtotal={subtotal}
              discountPercent={discountPercent}
            />

            <QuickPaymentSelector
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              paidAmount={paidAmount}
              setPaidAmount={setPaidAmount}
              transferNumber={transferNumber}
              setTransferNumber={setTransferNumber}
              discountPercent={discountPercent}
              setDiscountPercent={setDiscountPercent}
              total={subtotal}
            />

            <TouchableOpacity style={styles.confirmBtn} onPress={register}>
              <Text style={styles.confirmText}>Confirmar Venta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
