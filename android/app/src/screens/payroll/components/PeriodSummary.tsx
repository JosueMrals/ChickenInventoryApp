import React from 'react';
import { View, Text } from 'react-native';
import styles, { formatMoney } from '../styles/payrollStyles';

interface Props {
  staffCount: number;
  salaries: number;
  deductions: number;
  netPay: number;
}

/**
 * Cabecera del periodo abierto: lo que costaría pagar hoy a toda la plantilla.
 * El neto es el número grande porque es el que el admin necesita tener en caja.
 */
const PeriodSummary = ({ staffCount, salaries, deductions, netPay }: Props) => (
  <View style={styles.summaryCard}>
    <Text style={styles.summaryTitle}>Total a pagar · periodo abierto</Text>
    <Text style={styles.summaryNet}>{formatMoney(netPay)}</Text>

    <View style={styles.summaryBreakdown}>
      <View style={styles.summaryChip}>
        <Text style={styles.summaryChipLabel}>Salarios</Text>
        <Text style={styles.summaryChipValue}>{formatMoney(salaries)}</Text>
      </View>
      <View style={styles.summaryChip}>
        <Text style={styles.summaryChipLabel}>Deducciones</Text>
        <Text style={styles.summaryChipValue}>{formatMoney(deductions)}</Text>
      </View>
      <View style={styles.summaryChip}>
        <Text style={styles.summaryChipLabel}>Trabajadores</Text>
        <Text style={styles.summaryChipValue}>{staffCount}</Text>
      </View>
    </View>
  </View>
);

export default React.memo(PeriodSummary);
