import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';

import { getExpense, cancelExpense, canCancelExpense, canReviewExpense, reviewExpense } from '../services/expenseService';
import { getReimbursement, payReimbursement } from '../services/reimbursementService';
import { CATEGORY_LABELS, PAYMENT_METHOD_LABELS, STATUS_LABELS, REIMBURSEMENT_STATUS_LABELS, getPaymentMethodImpactMessage } from '../utils/expenseLabels';
import { formatCurrency } from '../../../utils/formatMoney';
import { useSubmitLock } from '../../../hooks/useSubmitLock';
import PayReimbursementModal from '../components/PayReimbursementModal';
import styles, { COLORS } from '../styles/expensesStyles';

const PAYMENT_METHOD_PAY_LABELS = { CASH: 'Efectivo', TRANSFER: 'Transferencia' };

const STATUS_COLORS = {
  PENDING: COLORS.amber,
  APPROVED: COLORS.green,
  REJECTED: COLORS.red,
  CANCELLED: COLORS.muted,
};

export default function ExpenseDetailScreen({ navigation, route }) {
  const { expenseId, role } = route.params ?? {};
  const [expense, setExpense] = useState(null);
  const [reimbursement, setReimbursement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payModalVisible, setPayModalVisible] = useState(false);
  const { submitting, runLocked } = useSubmitLock();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getExpense(expenseId);
      setExpense(data);
      setReimbursement(data?.paymentMethod === 'PERSONAL' ? await getReimbursement(expenseId) : null);
    } catch (e) {
      console.error('[ExpenseDetail] error cargando gasto:', e);
    } finally {
      setLoading(false);
    }
  }, [expenseId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!expense) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No se encontró el gasto.</Text>
      </View>
    );
  }

  const uid = auth().currentUser?.uid;
  const showCancel = canCancelExpense(expense, uid);
  const isAdmin = role === 'admin';
  const showApprove = isAdmin && canReviewExpense(expense, 'APPROVED');
  const showReject = isAdmin && canReviewExpense(expense, 'REJECTED');
  const showPay = isAdmin && reimbursement?.status === 'PENDING';

  const handleCancel = () => {
    Alert.alert('Cancelar gasto', '¿Seguro que quieres cancelar este gasto?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: () => {
          runLocked(async () => {
            try {
              await cancelExpense(expenseId, uid);
              await load();
            } catch (e) {
              Alert.alert('Error', e?.message || 'No se pudo cancelar el gasto.');
              throw e;
            }
          }).catch(() => {});
        },
      },
    ]);
  };

  // FASE E6.3.1: rechazar un gasto ya APPROVED es una acción con más
  // consecuencias que rechazar uno PENDING (el reembolso puede ya estar
  // pagado) — la confirmación lo deja explícito antes de ejecutar.
  const buildRejectMessage = () => {
    if (expense.status !== 'APPROVED') return '¿Rechazar este gasto?';
    if (reimbursement?.status === 'PAID') {
      return 'Este gasto ya fue reembolsado.\n\nAl rechazarlo se generará una deuda por el monto reembolsado para su posterior recuperación.\n\n¿Rechazar este gasto?';
    }
    if (expense.paymentMethod === 'PERSONAL') {
      return 'El gasto ya fue aprobado.\nSi el reembolso ya fue pagado, el monto deberá ser recuperado posteriormente.\n\n¿Rechazar este gasto?';
    }
    return 'El gasto ya fue aprobado.\n\n¿Rechazar este gasto?';
  };

  const handleReview = (decision) => {
    const isApprove = decision === 'APPROVED';
    Alert.alert(
      isApprove ? 'Aprobar gasto' : 'Rechazar gasto',
      isApprove ? '¿Aprobar este gasto?' : buildRejectMessage(),
      [
        { text: 'No', style: 'cancel' },
        {
          text: isApprove ? 'Sí, aprobar' : 'Sí, rechazar',
          style: isApprove ? 'default' : 'destructive',
          onPress: () => {
            runLocked(async () => {
              try {
                await reviewExpense(expenseId, decision, uid);
                await load();
              } catch (e) {
                Alert.alert('Error', e?.message || 'No se pudo revisar el gasto.');
                throw e;
              }
            }).catch(() => {});
          },
        },
      ],
    );
  };

  const handlePaySubmit = ({ paymentMethod, reference, notes }) => {
    Alert.alert(
      'Confirmar pago',
      `¿Confirmar pago del reembolso?\n\nMonto: ${formatCurrency(reimbursement.amount)}\nMétodo: ${PAYMENT_METHOD_PAY_LABELS[paymentMethod]}\n\nEsta acción no puede deshacerse.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => {
            runLocked(async () => {
              try {
                await payReimbursement(expenseId, { paymentMethod, reference, notes, paidByUid: uid });
                setPayModalVisible(false);
                await load();
              } catch (e) {
                Alert.alert('Error', e?.message || 'No se pudo registrar el pago.');
                throw e;
              }
            }).catch(() => {});
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBack} onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalle del Gasto</Text>
        <View style={styles.headerBack} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardTitle}>{CATEGORY_LABELS[expense.category] || expense.category}</Text>
            <Text style={styles.cardAmount}>{formatCurrency(expense.amount)}</Text>
          </View>

          <View style={[styles.badge, { backgroundColor: `${STATUS_COLORS[expense.status]}22` }]}>
            <Text style={[styles.badgeText, { color: STATUS_COLORS[expense.status] }]}>
              {STATUS_LABELS[expense.status] || expense.status}
            </Text>
          </View>

          <Text style={styles.detailLabel}>Método de pago</Text>
          <Text style={styles.detailValue}>{PAYMENT_METHOD_LABELS[expense.paymentMethod] || expense.paymentMethod}</Text>

          <Text style={styles.detailLabel}>Impacto</Text>
          <Text style={styles.detailValue}>{getPaymentMethodImpactMessage(expense.paymentMethod)}</Text>

          {expense.paymentMethod === 'PERSONAL' && (
            <>
              <Text style={styles.detailLabel}>Reembolso</Text>
              <Text style={styles.detailValue}>
                {reimbursement
                  ? `${REIMBURSEMENT_STATUS_LABELS[reimbursement.status] || reimbursement.status} · ${formatCurrency(reimbursement.amount)}`
                  : 'Sin reembolso todavía (el gasto sigue en revisión)'}
              </Text>
              {reimbursement?.status === 'PAID' && (
                <Text style={styles.cardSub}>
                  {PAYMENT_METHOD_PAY_LABELS[reimbursement.paymentMethod] || reimbursement.paymentMethod}
                  {reimbursement.reference ? ` · Ref. ${reimbursement.reference}` : ''}
                  {reimbursement.paidAt?.toDate ? ` · ${reimbursement.paidAt.toDate().toLocaleDateString('es-NI')}` : ''}
                </Text>
              )}
            </>
          )}

          {!!expense.description && (
            <>
              <Text style={styles.detailLabel}>Descripción</Text>
              <Text style={styles.detailValue}>{expense.description}</Text>
            </>
          )}

          <Text style={styles.detailLabel}>Fecha</Text>
          <Text style={styles.detailValue}>
            {expense.createdAt?.toDate ? expense.createdAt.toDate().toLocaleString('es-NI') : '—'}
          </Text>
        </View>

        {!!expense.receipt?.url && (
          <View style={styles.card}>
            <Text style={styles.detailLabel}>Comprobante</Text>
            <Image source={{ uri: expense.receipt.url }} style={[styles.photoPreview, { marginTop: 8 }]} resizeMode="cover" />
          </View>
        )}

        {expense.cashClosingId && (
          <View style={styles.lockedNotice}>
            <Text style={styles.lockedNoticeText}>Este gasto ya fue incluido en una liquidación.</Text>
          </View>
        )}

        {showApprove && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: COLORS.green }]}
            onPress={() => handleReview('APPROVED')}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Aprobar gasto</Text>}
          </TouchableOpacity>
        )}

        {showReject && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: COLORS.red }]}
            onPress={() => handleReview('REJECTED')}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Rechazar gasto</Text>}
          </TouchableOpacity>
        )}

        {showPay && (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => setPayModalVisible(true)}
            disabled={submitting}
          >
            <Text style={styles.primaryBtnText}>Marcar como pagado</Text>
          </TouchableOpacity>
        )}

        {showCancel && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: COLORS.red }]}
            onPress={handleCancel}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Cancelar gasto</Text>}
          </TouchableOpacity>
        )}
      </ScrollView>

      <PayReimbursementModal
        visible={payModalVisible}
        reimbursement={reimbursement}
        saving={submitting}
        onClose={() => setPayModalVisible(false)}
        onSubmit={handlePaySubmit}
      />
    </View>
  );
}
