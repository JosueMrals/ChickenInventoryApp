import React, { useState } from 'react';
import { View, Modal, Text, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native';
import CartItem from './CartItem';
import CartTotals from './CartTotals';
import styles from '../styles/cartStyles';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { registerSale } from '../services/saleService';
import PaymentSelector from './PaymentSelector';


export default function CartDrawer({
  visible,
  onClose,
  cart,
  setCartCustomer,
  updateQty,
  removeItem,
  clearCart,
  customer,
  role,
  onSaleComplete,
}) {
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [transferNumber, setTransferNumber] = useState('');
  const [saleDiscount, setSaleDiscount] = useState('');


  const subtotal = cart.totals.subtotal || 0;
  const customerDiscount = (customer && customer.discount) ? Number(customer.discount) : 0;
  const discountAmount = +(subtotal * (customerDiscount / 100)).toFixed(2);
  const total = +(subtotal - discountAmount).toFixed(2);
  const paid = parseFloat(paidAmount || 0);
  const pending = +(total - paid).toFixed(2);

  const validateCreditAndRegister = async () => {
    if (!customer) {
      Alert.alert('Selecciona un cliente', 'Debes seleccionar un cliente para cobrar a crédito.');
      return;
    }

    // verificar límite de crédito
    const creditLimit = Number(customer.creditLimit || 0);
    const currentCredit = Number(customer.currentCredit || 0); // si tienes este campo
    const remaining = Math.max(creditLimit - currentCredit, 0);

    // si pending > remaining => bloquear si no permitido (assume not allowed)
    if (pending > remaining) {
      Alert.alert('Crédito insuficiente', `El cliente tiene límite disponible C${remaining.toFixed(2)}. Ajusta el pago.`);
      return;
    }

    // preparar payload
    const payload = {
      customerId: customer.id,
      items: cart.totals.items.map((it) => ({
        productId: it.productId,
        name: it.product.name,
        quantity: it.qty,
        unitPrice: it.priceApplied,
        subtotal: it.subtotal,
      })),
      subtotal,
      discountApplied: discountAmount,
      total,
      paymentType: paymentMethod,
      paidAmount: paid,
      pendingAmount: pending,
      discountPercent: saleDiscount,
      discountAmount,
      finalTotal,
      date: new Date(),
    };

    try {
      await registerSale(payload);
      Alert.alert('✅ Venta registrada');
      clearCart();
      onSaleComplete && onSaleComplete();
      onClose();
    } catch (e) {
      console.error('Error registrando venta:', e);
      Alert.alert('Error', e.message || 'No se pudo registrar la venta');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.drawerOverlay}>
        <View style={styles.drawer}>
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>Carrito ({cart.totals.count || 0} items)</Text>
            <TouchableOpacity onPress={onClose}><Icon name="close" size={22} /></TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }}>
            {cart.totals.items.length === 0 ? (
              <View style={{ padding: 20 }}>
                <Text style={{ color: '#777' }}>El carrito está vacío.</Text>
              </View>
            ) : (
              cart.totals.items.map((it) => (
                <CartItem key={it.productId} item={it} onRemove={removeItem} onUpdateQty={(id, qty) => {
                  // recalc pricing externally if needed
                  updateQty(id, qty);
                }} />
              ))
            )}
          </ScrollView>

          <View style={{ padding: 12 }}>
            <CartTotals subtotal={subtotal} customerDiscount={customerDiscount} />

            <PaymentSelector
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              paidAmount={paidAmount}
              setPaidAmount={setPaidAmount}
              transferNumber={transferNumber}
              setTransferNumber={setTransferNumber}
              saleDiscount={saleDiscount}
              setSaleDiscount={setSaleDiscount}
              total={total}
              customer={customer}
            />


            <View style={{ flexDirection: 'row', marginTop: 12 }}>
              <TouchableOpacity onPress={() => { clearCart(); onClose(); }} style={[styles.btn, styles.btnCancel]}>
                <Text style={styles.btnText}>Vaciar</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={validateCreditAndRegister} style={[styles.btn, styles.btnPrimary]}>
                <Text style={styles.btnText}>Confirmar C${total.toFixed(2)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
