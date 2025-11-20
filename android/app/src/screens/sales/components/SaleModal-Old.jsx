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
import CreditLimitModal from './CreditLimitModal';
import CustomerInfoCard from './CustomerInfoCard';

export default function SaleModal({ visible, product, initialCustomer, onClose, onComplete }) {
  const [selected, setSelected] = useState(initialCustomer ?? null);
  const [form, setForm] = useState(getInitialForm());
  const [isVisible, setIsVisible] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const anim = useRef(new Animated.Value(0)).current;

  const [creditCheckVisible, setCreditCheckVisible] = useState(false);
  const [creditExceeded, setCreditExceeded] = useState(false);
  const [creditRemaining, setCreditRemaining] = useState(0);
  let pendingAmountCache = 0;

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

  // ⚙️ Animación modal
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

  // 🧮 Calcular precios (considerando mayoreo)
  const { basePrice, subtotal, discount, total } = useMemo(() => {
    const q = parseFloat(form.quantity || 0);
    if (!product) return { basePrice: 0, subtotal: 0, discount: 0, total: 0 };

    // Detectar si aplica precio de mayoreo
    const threshold = product.wholesaleThreshold || 0;
    const wholesalePrice = product.wholesalePrice || 0;
    const regularPrice = product.salePrice || product.price || 0;

    let priceToUse = threshold > 0 && q >= threshold
       ? wholesalePrice
       : regularPrice;

     if (selected?.discount > 0) {
       priceToUse = priceToUse * (1 - selected.discount / 100);
     }

    const sub = priceToUse * q;
    let disc = 0;
    const val = parseFloat(form.discountValue || 0);
    if (form.discountType === 'percent') disc = sub * (val / 100);
    if (form.discountType === 'amount') disc = val;
    const totalCalc = Math.max(sub - disc, 0);

    return { basePrice: priceToUse, subtotal: sub, discount: disc, total: totalCalc };
  }, [form, product]);

  // 🔹 Confirmar (abrir previsualización)
  const handleConfirm = async () => {
    if (!selected) return Alert.alert('Selecciona un cliente');
    if (!form.quantity) return Alert.alert('Ingresa la cantidad');

    const paid = parseFloat(form.paidAmount || 0);
    const pending = total - paid;

    // Si no hay pendiente, continuar normalmente
    if (pending <= 0) {
      return proceedToReceipt();
    }

    // Validar límite de crédito del cliente
    const creditLimit = selected?.creditLimit ?? 0;
    const currentCredit = selected?.currentCredit ?? 0;
    const remaining = Math.max(creditLimit - currentCredit, 0);

    pendingAmountCache = pending;

    if (pending > remaining && !selected?.allowOverLimit) {
      setCreditExceeded(true);
      setCreditCheckVisible(true);
    } else {
      setCreditExceeded(false);
      setCreditRemaining(remaining);
      setCreditCheckVisible(true);
    }
  };

    const proceedToReceipt = () => {
      const paid = parseFloat(form.paidAmount || 0);
      const pending = total - paid;

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
        priceApplied: basePrice,
        usedWholesale:
          product?.wholesaleThreshold &&
          form.quantity >= product.wholesaleThreshold,
      };

      setReceiptData(preSale);
      setIsVisible(false);
      setShowReceipt(true);
      setCreditCheckVisible(false);
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

  // 🟢 Guardar venta
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
          priceApplied: data.priceApplied,
        }
      );

      Alert.alert('✅ Venta guardada correctamente');
      setShowReceipt(false);
      resetForm();
      onClose?.();
      onComplete?.();
    } catch (e) {
      console.error('🔥 Error guardando venta1:', e);
      Alert.alert('Error', e.message);
    }
  };


  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  if (!isVisible && !showReceipt) return null;

  return (
    <>
      {/* 🔹 MODAL PRINCIPAL */}
      {isVisible && product && (
        <View style={styles.overlay}>
          <Animated.View style={[styles.modal, { opacity, transform: [{ scale }] }]}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.title}>Registrar venta</Text>

              <Text style={styles.subtitle}>
                {product.name}{' '}
                {product.wholesaleThreshold &&
                  parseFloat(form.quantity || 0) >= product.wholesaleThreshold ? (
                  <Text style={{ color: '#34A853', fontWeight: '700' }}>
                    — Precio mayoreo ${product.wholesalePrice?.toFixed(2)}
                  </Text>
                ) : (
                  <Text style={{ color: '#007AFF' }}>
                    — Precio regular ${product.salePrice?.toFixed(2) || product.price?.toFixed(2)}
                  </Text>
                )}
              </Text>

              {!initialCustomer && (
                <CustomerSearch selected={selected} setSelected={setSelected} />
              )}

              {initialCustomer && (
                <CustomerInfoCard customer={selected} />
              )}

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

      {/* 🧾 Voucher / Previsualización */}
      <SaleReceipt
        visible={showReceipt}
        saleData={receiptData}
        onEdit={handleEdit}
        onClose={() => handleFinalize(receiptData)}
      />

      <CreditLimitModal
            visible={creditCheckVisible}
            exceeded={creditExceeded}
            remaining={creditRemaining}
            onClose={() => setCreditCheckVisible(false)}
            onProceed={proceedToReceipt}
          />
    </>
  );
}
