// sales/components/SaleReceipt.jsx
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import styles from '../styles/saleReceiptStyles';
import { sendWhatsAppMessage } from '../services/whatsappService';

/**
 * Utilidades seguras para leer campos sin romper si vienen undefined
 */
const safeNum = (n) => {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
};
const fmtMoney = (n) => safeNum(n).toFixed(2);

const getReceiptNumber = (s) => s?.receiptNumber || '—';
const getClientName = (s) =>
  s?.clientName ||
  [s?.customer?.firstName, s?.customer?.lastName].filter(Boolean).join(' ') ||
  'Sin nombre';
const getClientPhone = (s) => s?.clientPhone || s?.customer?.phone || '';
const getProductName = (s) => s?.productName || s?.product?.name || '—';
const getQuantity = (s) => s?.quantity ?? s?.qty ?? s?.product?.quantity ?? 0;
const getPaymentMethod = (s) => s?.paymentMethod || '—';
const getTotal = (s) => safeNum(s?.total);
const getPaid = (s) => safeNum(s?.paid);
const getPending = (s) => {
  if (s?.pending != null) return safeNum(s.pending);
  return Math.max(getTotal(s) - getPaid(s), 0);
};

// Mensaje listo para WhatsApp
const buildWaMessage = (s) => {
  const number = getReceiptNumber(s);
  const name = getClientName(s);
  const product = getProductName(s);
  const total = fmtMoney(getTotal(s));
  const paid = fmtMoney(getPaid(s));
  const pending = fmtMoney(getPending(s));
  const method = getPaymentMethod(s);
  return (
    `🧾 *Comprobante de venta #${number}*\n\n` +
    `👤 Cliente: ${name}\n` +
    `📦 Producto: ${product}\n` +
    `💰 Total: $${total}\n` +
    `💳 Pago: ${method}\n` +
    `✅ Pagado: $${paid}\n` +
    (safeNum(pending) > 0 ? `💸 Pendiente: $${pending}\n` : '')
  ).trim();
};

export default function SaleReceipt({ visible, saleData, onClose, onEdit, readOnly = false }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 6,
        tension: 80,
      }).start();
    } else {
      anim.setValue(0);
    }
  }, [visible]);

  if (!visible || !saleData) return null;

  // Derivados seguros
  const receiptNumber = getReceiptNumber(saleData);
  const clientName = getClientName(saleData);
  const clientPhone = getClientPhone(saleData);
  const productName = getProductName(saleData);
  const quantity = getQuantity(saleData);
  const paymentMethod = getPaymentMethod(saleData);
  const total = getTotal(saleData);
  const paid = getPaid(saleData);
  const pending = getPending(saleData);

  const waMessage = buildWaMessage(saleData);

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.card, { transform: [{ scale: anim }] }]}>
        <View style={styles.checkContainer}>
          <Ionicons name="checkmark-circle" size={70} color="#34A853" />
        </View>

        <Text style={styles.title}>
          {readOnly ? 'Detalle de venta' : 'Previsualización de venta'}
        </Text>
        <Text style={styles.receiptNumber}>N° Comprobante: #{receiptNumber}</Text>

        <View style={styles.detailsBox}>
          <Text style={styles.label}>Cliente:</Text>
          <Text style={styles.value}>{clientName}</Text>

          <Text style={styles.label}>Producto:</Text>
          <Text style={styles.value}>{productName}</Text>

          <Text style={styles.label}>Cantidad:</Text>
          <Text style={styles.value}>{quantity}</Text>

          <Text style={styles.label}>Total:</Text>
          <Text style={styles.value}>${fmtMoney(total)}</Text>

          <Text style={styles.label}>Método de pago:</Text>
          <Text style={styles.value}>{paymentMethod}</Text>

          {safeNum(pending) > 0 && (
            <>
              <Text style={styles.label}>Pendiente:</Text>
              <Text style={[styles.value, { color: '#EA4335' }]}>${fmtMoney(pending)}</Text>
            </>
          )}
        </View>

        <View style={styles.buttons}>
          {!readOnly && (
            <TouchableOpacity
              style={[styles.btn, styles.btnEdit]}
              onPress={() => onEdit?.(saleData)}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
              <Text style={styles.btnText}>Editar información</Text>
            </TouchableOpacity>
          )}

          {clientPhone ? (
            <TouchableOpacity
              style={[styles.btn, styles.btnWhatsApp]}
              onPress={() => sendWhatsAppMessage(clientPhone, waMessage)}
            >
              <Ionicons name="logo-whatsapp" size={20} color="#fff" />
              <Text style={styles.btnText}>Enviar por WhatsApp</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.noPhone}>📵 El cliente no tiene teléfono registrado</Text>
          )}

          <TouchableOpacity
            style={[styles.btn, styles.btnClose]}
            onPress={() => onClose?.(saleData)}
          >
            <Text style={styles.btnText}>
              {readOnly ? 'Cerrar' : 'Cerrar y guardar venta'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}
