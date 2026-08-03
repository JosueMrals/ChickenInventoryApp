import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import styles, { COLORS, formatMoney } from '../styles/payrollStyles';
import { ROLE_LABELS, StaffAccount } from '../types';
import { buildStaffName } from '../services/payrollService';

interface Props {
  account: StaffAccount;
  onPress: (account: StaffAccount) => void;
}

const initials = (name: string): string =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';

/** Chip de una deducción. Se oculta en cero: un "C$0.00" no aporta nada. */
const DeductionTag = ({ icon, amount, color }: { icon: string; amount: number; color: string }) => {
  if (!amount) return null;
  return (
    <View style={[styles.tag, { backgroundColor: `${color}18` }]}>
      <Icon name={icon} size={11} color={color} />
      <Text style={[styles.tagText, { color }]}>{formatMoney(amount)}</Text>
    </View>
  );
};

const StaffCard = ({ account, onPress }: Props) => {
  const { staff, netPay, advancesTotal, purchasesTotal, shortagesTotal, deductionsTotal } = account;
  const name = buildStaffName(staff);
  const salaryMissing = staff.salary == null;

  return (
    <TouchableOpacity style={styles.staffCard} onPress={() => onPress(account)} activeOpacity={0.75}>
      <View style={styles.staffTopRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(name)}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.staffName} numberOfLines={1}>{name}</Text>
          <Text style={styles.staffRole}>{ROLE_LABELS[staff.role] || staff.role}</Text>
        </View>

        {salaryMissing ? (
          <View style={styles.noSalaryTag}>
            <Text style={styles.noSalaryText}>Sin salario</Text>
          </View>
        ) : (
          <View>
            <Text style={styles.staffNetLabel}>A pagar</Text>
            <Text style={[styles.staffNet, netPay < 0 && { color: COLORS.danger }]}>
              {formatMoney(netPay)}
            </Text>
          </View>
        )}

        <Icon name="chevron-forward" size={18} color={COLORS.muted} />
      </View>

      {deductionsTotal > 0 && (
        <View style={styles.staffBreakdown}>
          <DeductionTag icon="cash-outline" amount={advancesTotal} color={COLORS.accent} />
          <DeductionTag icon="basket-outline" amount={purchasesTotal} color="#5856D6" />
          <DeductionTag icon="alert-circle-outline" amount={shortagesTotal} color={COLORS.danger} />
        </View>
      )}
    </TouchableOpacity>
  );
};

export default React.memo(StaffCard);
