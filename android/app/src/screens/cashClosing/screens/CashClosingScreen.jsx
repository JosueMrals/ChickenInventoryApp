import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import globalStyles from '../../../styles/globalStyles';
import styles, { COLORS, formatMoney } from '../styles/cashClosingStyles';
import { useMyTurno } from '../hooks/useMyTurno';
import { usePendingReviews } from '../hooks/usePendingReviews';
import { openTurno, closeTurno, reviewTurno } from '../services/cashClosingService';
import { useSubmitLock } from '../../../hooks/useSubmitLock';
import { useAdaptiveBottom } from '../../../hooks/useAdaptiveBottom';
import { formatTimestamp } from '../../returns/utils/format';
import CashClosingMenu from '../components/CashClosingMenu';
import ReviewTurnoModal from '../components/ReviewTurnoModal';

const buildUserName = (user) => user?.nombre || user?.displayName || user?.email || 'Usuario';

/** "Mi turno": abrir/cerrar y ver lo cobrado en vivo. */
function MyTurnoCard({ uid, user, role }) {
  const { turno, collections, expenses, total, cashExpensesTotal, netAmount, loading } = useMyTurno(uid);
  const { runLocked } = useSubmitLock();
  const [busy, setBusy] = useState(false);

  const handleOpen = useCallback(() => {
    runLocked(async () => {
      setBusy(true);
      try {
        await openTurno({ uid, userName: buildUserName(user), role });
      } catch (e) {
        Alert.alert('Error', e?.message || 'No se pudo abrir el turno.');
      } finally {
        setBusy(false);
      }
    }).catch(() => {});
  }, [uid, user, role, runLocked]);

  const handleClose = useCallback(() => {
    if (!turno) return;
    // Si quien cierra YA es admin, no tiene sentido decirle "el admin
    // revisará" — puede ser el mismo u otro admin quien lo revise después.
    const reviewNote = role === 'admin'
      ? 'Quedará pendiente de revisión en "Turnos por revisar".'
      : 'El admin revisará ese monto contra el efectivo entregado.';
    const amountNote = cashExpensesTotal > 0
      ? `Se cerrará tu turno con ${formatMoney(total)} cobrados menos ${formatMoney(cashExpensesTotal)} de gastos en efectivo = ${formatMoney(netAmount)} a entregar.`
      : `Se cerrará tu turno con ${formatMoney(total)} cobrados.`;
    Alert.alert(
      'Cerrar turno',
      `${amountNote} ${reviewNote}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar turno',
          onPress: () =>
            runLocked(async () => {
              setBusy(true);
              try {
                await closeTurno(turno, collections.map((c) => c.id), expenses.map((e) => e.id));
              } catch (e) {
                Alert.alert('Error', e?.message || 'No se pudo cerrar el turno.');
              } finally {
                setBusy(false);
              }
            }).catch(() => {}),
        },
      ],
    );
  }, [turno, total, collections, expenses, cashExpensesTotal, netAmount, role, runLocked]);

  if (loading) {
    return (
      <View style={[styles.turnoCard, { alignItems: 'center' }]}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  return (
    <View style={styles.turnoCard}>
      <Text style={styles.turnoLabel}>{turno ? 'Cobrado en tu turno' : 'Mi turno'}</Text>
      <Text style={styles.turnoAmount}>{turno ? formatMoney(total) : 'Cerrado'}</Text>
      {turno && cashExpensesTotal > 0 && (
        <Text style={styles.turnoMeta}>
          Gastos en efectivo: -{formatMoney(cashExpensesTotal)} · A entregar: {formatMoney(netAmount)}
        </Text>
      )}
      {turno && <Text style={styles.turnoMeta}>Abierto {formatTimestamp(turno.openedAt)}</Text>}

      <TouchableOpacity
        style={[styles.primaryButton, { marginTop: 14 }, busy && styles.disabledButton]}
        onPress={turno ? handleClose : handleOpen}
        disabled={busy}
        activeOpacity={0.85}
      >
        {busy ? (
          <ActivityIndicator color={COLORS.surface} />
        ) : (
          <>
            <Icon name={turno ? 'lock-closed-outline' : 'lock-open-outline'} size={18} color={COLORS.surface} />
            <Text style={styles.primaryButtonText}>{turno ? 'Cerrar turno' : 'Abrir turno'}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

function PendingReviewRow({ item, onMarkComplete, onRegisterShortage, busy }) {
  return (
    <View style={styles.pendingCard}>
      <View style={styles.pendingTopRow}>
        <Text style={styles.pendingName} numberOfLines={1}>{item.userName}</Text>
        <Text style={styles.pendingAmount}>{formatMoney(item.expectedAmount)}</Text>
      </View>
      <Text style={styles.pendingMeta}>Cerrado {formatTimestamp(item.closedAt)}</Text>

      <View style={styles.pendingActions}>
        <TouchableOpacity style={[styles.successButton, busy && styles.disabledButton]} onPress={() => onMarkComplete(item)} disabled={busy}>
          <Icon name="checkmark-circle-outline" size={16} color={COLORS.surface} />
          <Text style={styles.successButtonText}>Dinero completo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.dangerButton, busy && styles.disabledButton]} onPress={() => onRegisterShortage(item)} disabled={busy}>
          <Icon name="alert-circle-outline" size={16} color={COLORS.danger} />
          <Text style={styles.dangerButtonText}>Falta dinero</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function CashClosingScreen({ navigation, user, role }) {
  const uid = user?.uid;
  const isAdmin = role === 'admin';
  const { closings: pendingReviews, loading: reviewsLoading } = usePendingReviews();
  const { runLocked } = useSubmitLock();
  const { bottomPadding } = useAdaptiveBottom();
  const [menuVisible, setMenuVisible] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [savingReview, setSavingReview] = useState(false);

  const submitReview = useCallback(
    (turno, shortageAmount) =>
      runLocked(async () => {
        setSavingReview(true);
        try {
          await reviewTurno(turno, shortageAmount);
          setReviewTarget(null);
        } catch (e) {
          Alert.alert('Error', e?.message || 'No se pudo revisar el turno.');
        } finally {
          setSavingReview(false);
        }
      }).catch(() => {}),
    [runLocked],
  );

  return (
    <View style={[globalStyles.container, { paddingBottom: bottomPadding }]}>
      <View style={globalStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={globalStyles.title}>Cierre de Caja</Text>
        <TouchableOpacity onPress={() => setMenuVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="ellipsis-vertical" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={isAdmin ? pendingReviews : []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <PendingReviewRow
            item={item}
            busy={savingReview}
            onMarkComplete={(t) => submitReview(t, 0)}
            onRegisterShortage={(t) => setReviewTarget(t)}
          />
        )}
        ListHeaderComponent={
          <>
            <MyTurnoCard uid={uid} user={user} role={role} />
            {isAdmin && <Text style={styles.sectionTitle}>Turnos por revisar</Text>}
          </>
        }
        ListEmptyComponent={
          isAdmin && !reviewsLoading ? (
            <View style={styles.emptyState}>
              <Icon name="checkmark-done-outline" size={44} color={COLORS.muted} />
              <Text style={styles.emptyText}>No hay turnos pendientes de revisar.</Text>
            </View>
          ) : null
        }
      />

      <CashClosingMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onOpenHistory={() => navigation.navigate('CashClosingHistory', { user, role })}
      />

      <ReviewTurnoModal
        visible={!!reviewTarget}
        turno={reviewTarget}
        saving={savingReview}
        onClose={() => setReviewTarget(null)}
        onSubmit={(amount) => submitReview(reviewTarget, amount)}
      />
    </View>
  );
}
