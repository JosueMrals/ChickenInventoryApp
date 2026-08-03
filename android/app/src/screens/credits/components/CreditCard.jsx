import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import styles from '../styles/creditsStyles';
import CreditDueInfo from './CreditDueInfo';

function CreditCard({ item, role, onAbonar, onDelete, onEditPreSale, onViewDetail }) {
  const name = item.customerName || item.clientName || 'Cliente';
  const total = Number(item.total) || 0;
  const paid = Number(item.paid) || 0;
  const pending = Number(item.pending) || 0;
  const isPaid = item.status === 'paid';
  const canEditPreSale = !!item.preSaleId;
  const progress = total > 0 ? Math.min(paid / total, 1) : 0;

  const initials = name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');

  const lastPayment = Array.isArray(item.payments) && item.payments.length > 0
    ? item.payments[item.payments.length - 1] : null;

  const formatDate = (v) => {
    if (!v) return '';
    if (v.seconds) return new Date(v.seconds * 1000).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    if (typeof v.toDate === 'function') return v.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  return (
    <View style={styles.creditCard}>
      {/* Top row: avatar + name + status */}
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials || '?'}</Text>
        </View>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardTitle} numberOfLines={1}>{name}</Text>
          <Text style={styles.cardMeta}>#{item.id?.substring(0, 8).toUpperCase()}</Text>
        </View>
        <View style={[styles.statusPill, isPaid ? styles.statusPaid : styles.statusPending]}>
          <Text style={[styles.statusPillText, { color: isPaid ? '#065F46' : '#991B1B' }]}>
            {isPaid ? 'Pagado' : 'Pendiente'}
          </Text>
        </View>
      </View>

      {/* Fecha de pago acordada / atraso */}
      {!isPaid && <CreditDueInfo credit={item} compact />}

      {/* Progress bar */}
      <View style={styles.progressWrap}>
        <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
      </View>

      {/* Amount chips */}
      <View style={styles.amountsRow}>
        <View style={styles.amountChip}>
          <Text style={styles.amountLabel}>Total</Text>
          <Text style={styles.amountValue}>C${total.toFixed(2)}</Text>
        </View>
        <View style={styles.amountChip}>
          <Text style={styles.amountLabel}>Cobrado</Text>
          <Text style={[styles.amountValue, styles.amountValueSuccess]}>C${paid.toFixed(2)}</Text>
        </View>
        <View style={styles.amountChip}>
          <Text style={styles.amountLabel}>Saldo</Text>
          <Text style={[styles.amountValue, pending > 0 && styles.amountValueDanger]}>C${pending.toFixed(2)}</Text>
        </View>
      </View>

      {/* Last payment */}
      {lastPayment && (
        <View style={styles.lastPaymentRow}>
          <Text style={styles.lastPaymentText}>
            Último abono: {formatDate(lastPayment.date)}  ·  C${Number(lastPayment.amount || 0).toFixed(2)}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={[styles.actionBtn, styles.btnDetail]} onPress={() => onViewDetail?.(item)}>
          <Icon name="eye-outline" size={13} color="#fff" />
          <Text style={styles.actionBtnText}>Detalle</Text>
        </TouchableOpacity>

        {canEditPreSale && (
          <TouchableOpacity style={[styles.actionBtn, styles.btnEdit]} onPress={() => onEditPreSale?.(item)}>
            <Icon name="pencil-outline" size={13} color="#fff" />
            <Text style={styles.actionBtnText}>Editar</Text>
          </TouchableOpacity>
        )}

        {!isPaid && (
          <TouchableOpacity style={[styles.actionBtn, styles.btnPay]} onPress={() => onAbonar(item)}>
            <Icon name="cash-plus" size={13} color="#fff" />
            <Text style={styles.actionBtnText}>Abonar</Text>
          </TouchableOpacity>
        )}

        {role === 'admin' && (
          <TouchableOpacity style={[styles.actionBtn, styles.btnDelete]} onPress={() => onDelete(item.id)}>
            <Icon name="trash-can-outline" size={13} color="#fff" />
            <Text style={styles.actionBtnText}>Eliminar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// memo: componente de fila. Sin esto se re-renderiza en cada cambio de estado
// del padre (tecla del buscador, cambio de filtro) aunque su item no haya cambiado.
export default React.memo(CreditCard);
