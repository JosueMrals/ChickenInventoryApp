import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import globalStyles from '../../../styles/globalStyles';
import styles, { COLORS, formatMoney } from '../styles/cashClosingStyles';
import { useMyTurno } from '../hooks/useMyTurno';
import { usePendingReviews } from '../hooks/usePendingReviews';
import { useOpenTurnos } from '../hooks/useOpenTurnos';
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
      <Text style={styles.turnoLabel}>{turno ? 'Neto de tu turno' : 'Mi turno'}</Text>
      {/* Lo que el trabajador entrega = ingresos - egresos. El desglose va
          siempre visible (aunque valga cero) para que un cero sea una lectura
          y no una duda. */}
      <Text style={styles.turnoAmount}>{turno ? formatMoney(netAmount) : 'Cerrado'}</Text>
      {turno && (
        <Text style={styles.turnoMeta}>
          Ingresos: {formatMoney(total)} · Gastos en efectivo: -{formatMoney(cashExpensesTotal)}
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

/**
 * Una caja abierta ahora mismo, con su monto en vivo. El neto es lo que ese
 * trabajador tendría que entregar si cerrara en este momento; el cierre lo
 * recalcula igual dentro de la transacción.
 */
function OpenTurnoRow({ item, isMine, onClose, busy }) {
  return (
    <View style={styles.pendingCard}>
      <View style={styles.pendingTopRow}>
        <Text style={styles.pendingName} numberOfLines={1}>
          {item.userName || item.uid}{isMine ? ' · tú' : ''}
        </Text>
        <Text style={styles.pendingAmount}>{formatMoney(item.neto)}</Text>
      </View>
      <Text style={styles.pendingMeta}>
        Ingresos {formatMoney(item.ingresos)} · Gastos en efectivo -{formatMoney(item.egresos)}
      </Text>
      <Text style={styles.pendingMeta}>
        {item.role ? `${item.role} · ` : ''}Abierto {formatTimestamp(item.openedAt)}
      </Text>

      <View style={styles.pendingActions}>
        <TouchableOpacity
          style={[styles.secondaryButton, { flex: 1 }, busy && styles.disabledButton]}
          onPress={() => onClose(item)}
          disabled={busy}
        >
          <Icon name="lock-closed-outline" size={16} color={COLORS.accent} />
          <Text style={styles.secondaryButtonText}>Cerrar turno</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** El desglose que el admin confirma antes de cerrar la caja de alguien. */
const buildCloseSummary = (ingresos, egresos) => {
  const neto = Number((ingresos - egresos).toFixed(2));
  return egresos > 0
    ? `Ingresos ${formatMoney(ingresos)} menos ${formatMoney(egresos)} de gastos en efectivo = ${formatMoney(neto)} a entregar.`
    : `Cobrado ${formatMoney(ingresos)}.`;
};

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
  const { turnos: openTurnos } = useOpenTurnos(isAdmin);
  const { runLocked } = useSubmitLock();
  const { bottomPadding } = useAdaptiveBottom();
  const [menuVisible, setMenuVisible] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [savingReview, setSavingReview] = useState(false);
  const [closingUid, setClosingUid] = useState(null);

  // Los ids a reclamar vienen de la misma suscripción en vivo que pinta el
  // monto de la fila — no hace falta releer antes de preguntar. La transacción
  // de closeTurno los relee igual, así que esta lista nunca decide nada.
  const runClose = useCallback(
    (turno) =>
      runLocked(async () => {
        setClosingUid(turno.uid);
        try {
          await closeTurno(turno, turno.collectionIds, turno.expenseIds);
        } catch (e) {
          Alert.alert('Error', e?.message || 'No se pudo cerrar el turno.');
        } finally {
          setClosingUid(null);
        }
      }).catch(() => {}),
    [runLocked],
  );

  const askCloseTurno = useCallback(
    (turno) => {
      Alert.alert(
        `Cerrar turno de ${turno.userName || turno.uid}`,
        `${buildCloseSummary(turno.ingresos, turno.egresos)} Quedará pendiente de revisión.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Cerrar turno', onPress: () => runClose(turno) },
        ],
      );
    },
    [runClose],
  );

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
            {isAdmin && (
              <>
                <Text style={styles.sectionTitle}>Cajas abiertas ahora ({openTurnos.length})</Text>
                {openTurnos.length === 0 ? (
                  <Text style={styles.pendingMeta}>Nadie tiene una caja abierta.</Text>
                ) : (
                  openTurnos.map((t) => (
                    <OpenTurnoRow
                      key={t.id}
                      item={t}
                      isMine={t.uid === uid}
                      busy={closingUid === t.uid}
                      onClose={askCloseTurno}
                    />
                  ))
                )}
                <Text style={styles.sectionTitle}>Turnos por revisar</Text>
              </>
            )}
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
