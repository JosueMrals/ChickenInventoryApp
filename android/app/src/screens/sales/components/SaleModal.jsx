import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Animated,
  Alert,
} from 'react-native';
import CustomerSearch from './CustomerSearch';
import PaymentSelector from './PaymentSelector';
import SaleReceipt from './SaleReceipt';
import { registerSale } from '../services/saleService';
import styles from '../styles/saleModalStyles';

export default function SaleModal({ visible, product, onClose, onComplete }) {
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(getInitialForm());
  const [isVisible, setIsVisible] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const anim = useRef(new Animated.Value(0)).current;

  function getInitialForm() {
    return {
      quantity: '',
      discountType: 'none',
      discountValue: '',
      paymentMethod: 'cash',
      transferNumber: '',
      paidAmount: '',
    };
  }

  const resetForm = () => {
    setForm(getInitialForm());
    setSelected(null);
  };

  // Animación de apertura/cierre
  useEffect(() => {
    if (visible) {
      setIsVisible(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setIsVisible(false);
        resetForm();
      });
    }
  }, [visible]);

  // Cálculos
  const { subtotal, discount, total } = useMemo(() => {
    const q = parseFloat(form.quantity || 0);
    const sub = (product?.price || 0) * q;
    let disc = 0;
    const val = parseFloat(form.discountValue || 0);
    if (form.discountType === 'percent') disc = sub * (val / 100);
    if (form.discountType === 'amount') disc = val;
    const totalCalc = Math.max(sub - disc, 0);
    return { subtotal: sub, discount: disc, total: totalCalc };
  }, [form, product]);

  // ✅ Ahora solo previsualiza la venta (no la guarda aún)
  const handleConfirm = async () => {
    if (!selected) return Alert.alert('Selecciona un cliente');
    if (!form.quantity) return Alert.alert('Ingresa la cantidad');

    const paid = parseFloat(form.paidAmount || 0);
    const pending = total - paid;

    // Preparar datos de previsualización
    const preSale = {
      customer: selected,
      product,
      total,
      paid,
      pending,
      paymentMethod: form.paymentMethod,
      quantity: parseInt(form.quantity),
      discountType: form.discountType,
      discountValue: form.discountValue,
    };

    setReceiptData(preSale);
    setIsVisible(false);
    setShowReceipt(true);
  };

  // 🟡 Reabrir para editar
  const handleEdit = (data) => {
    setShowReceipt(false);
    setTimeout(() => {
      setSelected(data.customer);
      setForm({
        quantity: data.quantity?.toString() || '',
        discountType: data.discountType || 'none',
        discountValue: data.discountValue?.toString() || '',
        paymentMethod: data.paymentMethod || 'cash',
        paidAmount: data.paid?.toString() || '',
      });
      setIsVisible(true);
    }, 300);
  };

  // 🟢 Guardar venta definitivamente
  const handleFinalize = async (data) => {
    try {
      const saleId = await registerSale(
        data.product,
        data.customer,
        data.quantity,
        {
          paymentMethod: data.paymentMethod,
          paidAmount: data.paid.toString(),
          discountType: data.discountType,
          discountValue: data.discountValue,
        }
      );

      Alert.alert('✅ Venta guardada correctamente');
      setShowReceipt(false);
      resetForm();
      onClose?.();
      onComplete?.();
    } catch (e) {
      console.error('🔥 Error guardando venta:', e);
      Alert.alert('Error', e.message);
    }
  };

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  if (!isVisible && !showReceipt) return null;

  return (
    <>
      {isVisible && product && (
        <View style={styles.overlay}>
          <Animated.View style={[styles.modal, { opacity, transform: [{ scale }] }]}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.title}>Registrar venta</Text>
              <Text style={styles.subtitle}>
                {product.name} — ${product.price?.toFixed(2)}
              </Text>

              <CustomerSearch selected={selected} setSelected={setSelected} />

              <TextInput
                placeholder="Cantidad"
                keyboardType="numeric"
                value={form.quantity}
                onChangeText={(t) => setForm({ ...form, quantity: t })}
                style={styles.input}
              />

              <PaymentSelector
                form={form}
                setForm={setForm}
                subtotal={subtotal}
                discount={discount}
                total={total}
              />

              <View style={styles.buttonRow}>
                <TouchableOpacity onPress={handleConfirm} style={[styles.btn, styles.btnPrimary]}>
                  <Text style={styles.btnText}>Confirmar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    resetForm();
                    onClose();
                  }}
                  style={[styles.btn, styles.btnCancel]}
                >
                  <Text style={styles.btnText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      )}

      {/* 🧾 Voucher / previsualización */}
      <SaleReceipt
        visible={showReceipt}
        saleData={receiptData}
        onEdit={handleEdit}
        onClose={() => handleFinalize(receiptData)}
      />
    </>
  );
}
