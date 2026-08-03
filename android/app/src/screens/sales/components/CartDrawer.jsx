import React, { useState } from 'react';
import { View, Modal, Text, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native';
import CartItem from './CartItem';
import CartTotals from './CartTotals';
import styles from '../styles/cartStyles';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { registerQuickSaleFull } from '../../quicksalesNew/services/quickSaleService';
import PaymentSelector from './PaymentSelector';
import { getEffectiveCreditLimit } from '../../../utils/creditUtils';


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
  // Descuento manual de la venta (%): PaymentSelector lo cobra sobre `total`,
  // así que el cobro real es este finalTotal, no `total`.
  const saleDiscountPct = parseFloat(saleDiscount || 0);
  const saleDiscountAmount = +(total * (saleDiscountPct / 100)).toFixed(2);
  const finalTotal = +(total - saleDiscountAmount).toFixed(2);
  const paid = parseFloat(paidAmount || 0);
  const pending = +Math.max(finalTotal - paid, 0).toFixed(2);
  const change = +Math.max(paid - finalTotal, 0).toFixed(2);

  const validateCreditAndRegister = async () => {
    if (cart.totals.items.length === 0) {
      Alert.alert('Carrito vacío', 'Agrega al menos un producto para registrar la venta.');
      return;
    }

    // Solo lo que queda pendiente es crédito: exige cliente y valida su límite.
    if (pending > 0) {
      if (!customer) {
        Alert.alert('Selecciona un cliente', 'Debes seleccionar un cliente para cobrar a crédito.');
        return;
      }

      // Límite efectivo: límite base + sobregiro configurado en el cliente.
      const creditLimit = getEffectiveCreditLimit(customer).total;
      const currentCredit = Number(customer.currentCredit || 0);
      const remaining = Math.max(creditLimit - currentCredit, 0);

      if (pending > remaining) {
        Alert.alert('Crédito insuficiente', `El cliente tiene límite disponible C$${remaining.toFixed(2)}. Ajusta el pago.`);
        return;
      }
    }

    try {
      await registerQuickSaleFull({
        cart: cart.totals.items.map((it) => ({
          id: it.productId,
          product: it.product,
          quantity: it.qty,
          unitPrice: it.priceApplied,
          discount: 0,
          total: it.subtotal,
          isBonus: false,
        })),
        subtotal,
        total: finalTotal,
        paymentMethod,
        amountPaid: paid,
        change,
        transferNumber,
        customer,
      });
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
                <Text style={styles.btnText}>Confirmar C${finalTotal.toFixed(2)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
