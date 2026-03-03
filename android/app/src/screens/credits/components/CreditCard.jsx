import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import styles from '../styles/creditsStyles';

export default function CreditCard({ item, role, onAbonar, onDelete, onEditPreSale }) {
  const name = item.customerName || item.clientName || 'Cliente';
  const total = Number(item.total) || 0;
  const paid = Number(item.paid) || 0;
  const pending = Number(item.pending) || 0;
  const canEditPreSale = !!item.preSaleId;
  const isPaid = item.status === 'paid';
  const lastPayment = Array.isArray(item.payments) && item.payments.length > 0
    ? item.payments[item.payments.length - 1]
    : null;

  const formatPaymentDate = (dateValue) => {
    if (!dateValue) return 'Fecha no disponible';
    if (dateValue.seconds) return new Date(dateValue.seconds * 1000).toLocaleDateString();
    if (typeof dateValue.toDate === 'function') return dateValue.toDate().toLocaleDateString();
    const parsed = new Date(dateValue);
    return Number.isNaN(parsed.getTime()) ? 'Fecha no disponible' : parsed.toLocaleDateString();
  };

  return (
    <View style={styles.cardCompact}>
      <View style={styles.cardHeaderCompact}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{name}</Text>
          <Text style={styles.cardMeta}>ID: {item.id?.substring(0, 6).toUpperCase()}</Text>
        </View>
        <View style={[styles.statusPill, isPaid ? styles.statusPaid : styles.statusPending]}>
          <Text style={styles.statusPillText}>{isPaid ? 'Pagado' : 'Pendiente'}</Text>
        </View>
      </View>

      <View style={styles.amountsRow}>
        <View style={styles.amountItem}>
          <Text style={styles.amountLabel}>Total</Text>
          <Text style={styles.amountValue}>C${total.toFixed(2)}</Text>
        </View>
        <View style={styles.amountItem}>
          <Text style={styles.amountLabel}>Pagado</Text>
          <Text style={styles.amountValue}>C${paid.toFixed(2)}</Text>
        </View>
        <View style={styles.amountItem}>
          <Text style={styles.amountLabel}>Pendiente</Text>
          <Text style={styles.amountValue}>C${pending.toFixed(2)}</Text>
        </View>
      </View>

      {lastPayment && (
        <Text style={styles.paymentHint}>
          Último abono: {formatPaymentDate(lastPayment.date)} · C${Number(lastPayment.amount || 0).toFixed(2)}
        </Text>
      )}

      <View style={styles.actionsRow}>
        {canEditPreSale && (
          <TouchableOpacity
            onPress={() => onEditPreSale && onEditPreSale(item)}
            style={[styles.btn, styles.btnSecondaryCompact]}
          >
            <Text style={styles.btnText}>Editar</Text>
          </TouchableOpacity>
        )}
        {item.status === 'pending' && (
          <TouchableOpacity
            onPress={() => onAbonar(item)}
            style={[styles.btn, styles.btnPrimaryCompact]}
          >
            <Text style={styles.btnText}>Abonar</Text>
          </TouchableOpacity>
        )}
        {role === 'admin' && (
          <TouchableOpacity
            onPress={() => onDelete(item.id)}
            style={[styles.btn, styles.btnDangerCompact]}
          >
            <Text style={styles.btnText}>Eliminar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
