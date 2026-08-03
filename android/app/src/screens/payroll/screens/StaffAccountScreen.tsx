import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { NavigationProp, RouteProp } from '@react-navigation/native';
import globalStyles from '../../../styles/globalStyles';
import styles, { COLORS, formatMoney } from '../styles/payrollStyles';
import AccountSection, { AccountLine } from '../components/AccountSection';
import AdvanceModal from '../components/AdvanceModal';
import { useStaffAccount } from '../hooks/usePayroll';
import { useSubmitLock } from '../../../hooks/useSubmitLock';
import { useAdaptiveBottom } from '../../../hooks/useAdaptiveBottom';
import { formatTimestamp } from '../../returns/utils/format';
import {
  addAdvance,
  buildStaffName,
  cancelStaffPurchase,
  deleteAdvance,
  setSalary,
  settleStaffPeriod,
} from '../services/payrollService';
import { ROLE_LABELS } from '../types';

interface Props {
  navigation: NavigationProp<any>;
  route: RouteProp<any>;
}

export default function StaffAccountScreen({ navigation, route }: Props) {
  const uid = (route.params as any)?.uid as string;
  const { account, loading } = useStaffAccount(uid);
  const { runLocked } = useSubmitLock();
  const { bottomPadding } = useAdaptiveBottom();

  const [salaryText, setSalaryText] = useState('');
  const [savingSalary, setSavingSalary] = useState(false);
  const [advanceModal, setAdvanceModal] = useState(false);
  const [savingAdvance, setSavingAdvance] = useState(false);
  const [settling, setSettling] = useState(false);

  const staffName = account ? buildStaffName(account.staff) : '';

  // El salario del servidor manda mientras no se esté editando: si otro admin lo
  // cambia, el campo se actualiza en vez de quedarse con el valor viejo.
  const serverSalary = account?.staff?.salary;
  useEffect(() => {
    if (serverSalary === undefined || savingSalary) return;
    setSalaryText(serverSalary == null ? '' : String(serverSalary));
  }, [serverSalary, savingSalary]);

  const handleSaveSalary = useCallback(async () => {
    const parsed = Number(salaryText.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) {
      Alert.alert('Salario inválido', 'Ingresa un monto válido mayor o igual a cero.');
      return;
    }
    setSavingSalary(true);
    try {
      await setSalary(uid, parsed);
      Alert.alert('Salario guardado', `El salario de ${staffName} quedó en ${formatMoney(parsed)}.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo guardar el salario.');
    } finally {
      setSavingSalary(false);
    }
  }, [salaryText, uid, staffName]);

  const handleAddAdvance = useCallback(
    async (amount: number, note: string) => {
      setSavingAdvance(true);
      try {
        await addAdvance({ uid, userName: staffName, amount, note });
        setAdvanceModal(false);
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'No se pudo registrar el adelanto.');
      } finally {
        setSavingAdvance(false);
      }
    },
    [uid, staffName],
  );

  const confirmRemove = useCallback(
    (title: string, message: string, action: () => Promise<void>) => {
      Alert.alert(title, message, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await action();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'No se pudo completar la operación.');
            }
          },
        },
      ]);
    },
    [],
  );

  // El cierre mueve dinero y marca faltantes como cobrados: se confirma antes y
  // se serializa con runLocked para que un doble toque no abra dos pagos.
  const handleSettle = useCallback(() => {
    if (!account) return;

    if (account.staff.salary == null) {
      Alert.alert('Falta el salario', 'Configura el salario antes de cerrar el pago.');
      return;
    }

    const detail = [
      `Salario: ${formatMoney(account.staff.salary)}`,
      account.advancesTotal > 0 ? `Adelantos: -${formatMoney(account.advancesTotal)}` : null,
      account.purchasesTotal > 0 ? `Productos de bodega: -${formatMoney(account.purchasesTotal)}` : null,
      account.shortagesTotal > 0 ? `Faltantes: -${formatMoney(account.shortagesTotal)}` : null,
      '',
      `Neto a pagar: ${formatMoney(account.netPay)}`,
      '',
      'Se cerrará el periodo y los adelantos, productos y faltantes vuelven a cero.',
    ]
      .filter((l) => l !== null)
      .join('\n');

    Alert.alert(`Pagar a ${staffName}`, detail, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar pago',
        onPress: () =>
          runLocked(async () => {
            setSettling(true);
            try {
              const settlement = await settleStaffPeriod(account);
              Alert.alert(
                'Pago registrado',
                `Se pagó ${formatMoney(settlement.netPay)} a ${settlement.userName}. El periodo quedó en cero.`,
              );
              navigation.goBack();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'No se pudo registrar el pago.');
            } finally {
              setSettling(false);
            }
          }).catch(() => {}),
      },
    ]);
  }, [account, staffName, runLocked, navigation]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Cargando cuenta...</Text>
        </View>
      </View>
    );
  }

  if (!account) {
    return (
      <View style={styles.container}>
        <View style={globalStyles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="chevron-back" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={globalStyles.title}>Cuenta</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.emptyState}>
          <Icon name="person-outline" size={48} color={COLORS.muted} />
          <Text style={styles.emptyText}>Este trabajador ya no está disponible.</Text>
        </View>
      </View>
    );
  }

  const advanceLines: AccountLine[] = account.advances.map((a) => ({
    id: a.id,
    title: a.note || 'Adelanto de salario',
    meta: `${formatTimestamp(a.createdAt)}${a.createdBy ? ` · ${a.createdBy}` : ''}`,
    amount: a.amount,
  }));

  const purchaseLines: AccountLine[] = account.purchases.map((p) => ({
    id: p.id,
    title: (p.items || []).map((i) => `${i.quantity} × ${i.productName}`).join(', ') || 'Productos de bodega',
    meta: `${formatTimestamp(p.createdAt)}${p.createdBy ? ` · entregó ${p.createdBy}` : ''}`,
    amount: p.total,
  }));

  const shortageLines: AccountLine[] = account.shortages.map((s) => ({
    id: s.id,
    title: s.customerName ? `Faltante · ${s.customerName}` : 'Faltante de entrega',
    meta: formatTimestamp(s.recordedAt),
    amount: s.totalMissingValue,
  }));

  return (
    <View style={styles.container}>
      <View style={globalStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={globalStyles.title} numberOfLines={1}>{staffName}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {/* Salario base */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Icon name="briefcase-outline" size={17} color={COLORS.accent} />
            <Text style={styles.sectionTitle}>
              Salario del periodo · {ROLE_LABELS[account.staff.role] || account.staff.role}
            </Text>
          </View>

          <View style={[styles.salaryRow, { marginTop: 10 }]}>
            <TextInput
              style={styles.salaryInput}
              value={salaryText}
              onChangeText={setSalaryText}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={COLORS.muted}
            />
            <TouchableOpacity
              style={[styles.secondaryButton, savingSalary && styles.disabledButton]}
              onPress={handleSaveSalary}
              disabled={savingSalary}
              activeOpacity={0.8}
            >
              {savingSalary ? (
                <ActivityIndicator size="small" color={COLORS.accent} />
              ) : (
                <>
                  <Icon name="save-outline" size={15} color={COLORS.accent} />
                  <Text style={styles.secondaryButtonText}>Guardar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <AccountSection
          title="Adelantos de salario"
          icon="cash-outline"
          color={COLORS.accent}
          total={account.advancesTotal}
          lines={advanceLines}
          emptyText="Sin adelantos en este periodo."
          actionLabel="Registrar adelanto"
          onAction={() => setAdvanceModal(true)}
          onRemoveLine={(line) =>
            confirmRemove(
              'Eliminar adelanto',
              `¿Eliminar el adelanto de ${formatMoney(line.amount)}?`,
              () => deleteAdvance(line.id),
            )
          }
        />

        <AccountSection
          title="Productos de bodega"
          icon="basket-outline"
          color="#5856D6"
          total={account.purchasesTotal}
          lines={purchaseLines}
          emptyText="No ha solicitado productos en este periodo."
          onRemoveLine={(line) =>
            confirmRemove(
              'Anular entrega',
              `¿Anular esta entrega de ${formatMoney(line.amount)}? Los productos vuelven al inventario.`,
              () => cancelStaffPurchase(line.id),
            )
          }
          removeIcon="arrow-undo-outline"
        />

        <AccountSection
          title="Faltantes por pagar"
          icon="alert-circle-outline"
          color={COLORS.danger}
          total={account.shortagesTotal}
          lines={shortageLines}
          emptyText="Sin faltantes pendientes."
        />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomPadding }]}>
        <View style={styles.footerNetRow}>
          <Text style={styles.footerNetLabel}>Neto a pagar</Text>
          <Text style={[styles.footerNetValue, account.netPay < 0 && { color: COLORS.danger }]}>
            {formatMoney(account.netPay)}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, (settling || account.staff.salary == null) && styles.disabledButton]}
          onPress={handleSettle}
          disabled={settling || account.staff.salary == null}
          activeOpacity={0.85}
        >
          {settling ? (
            <ActivityIndicator color={COLORS.surface} />
          ) : (
            <>
              <Icon name="checkmark-circle-outline" size={19} color={COLORS.surface} />
              <Text style={styles.primaryButtonText}>Pagar y cerrar periodo</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <AdvanceModal
        visible={advanceModal}
        staffName={staffName}
        saving={savingAdvance}
        onClose={() => setAdvanceModal(false)}
        onSubmit={handleAddAdvance}
      />
    </View>
  );
}
