import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import styles, { COLORS, formatMoney } from '../styles/payrollStyles';

export interface AccountLine {
  id: string;
  title: string;
  meta?: string | null;
  amount: number;
}

interface Props {
  title: string;
  icon: string;
  color: string;
  total: number;
  lines: AccountLine[];
  emptyText: string;
  /** Si se pasa, cada línea muestra el botón de quitar. */
  onRemoveLine?: (line: AccountLine) => void;
  removeIcon?: string;
  /** Acción del encabezado (p. ej. "Agregar" un adelanto). */
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Sección de deducciones del estado de cuenta. Es una sola para adelantos,
 * entregas de bodega y faltantes: las tres se ven igual (título, total, líneas)
 * y solo cambian los datos, así que no hay tres componentes casi idénticos.
 */
const AccountSection = ({
  title, icon, color, total, lines, emptyText,
  onRemoveLine, removeIcon = 'trash-outline', actionLabel, onAction,
}: Props) => (
  <View style={styles.sectionCard}>
    <View style={styles.sectionHeader}>
      <Icon name={icon} size={17} color={color} />
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={[styles.sectionTotal, total > 0 && { color }]}>{formatMoney(total)}</Text>
    </View>

    {lines.length === 0 ? (
      <Text style={styles.sectionEmpty}>{emptyText}</Text>
    ) : (
      lines.map((line) => (
        <View key={line.id} style={styles.lineRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.lineTitle} numberOfLines={2}>{line.title}</Text>
            {!!line.meta && <Text style={styles.lineMeta}>{line.meta}</Text>}
          </View>

          <Text style={styles.lineAmount}>{formatMoney(line.amount)}</Text>

          {onRemoveLine && (
            <TouchableOpacity
              style={styles.lineAction}
              onPress={() => onRemoveLine(line)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name={removeIcon} size={17} color={COLORS.danger} />
            </TouchableOpacity>
          )}
        </View>
      ))
    )}

    {!!actionLabel && !!onAction && (
      <TouchableOpacity
        style={[styles.secondaryButton, { marginTop: 12, alignSelf: 'flex-start' }]}
        onPress={onAction}
        activeOpacity={0.8}
      >
        <Icon name="add" size={16} color={COLORS.accent} />
        <Text style={styles.secondaryButtonText}>{actionLabel}</Text>
      </TouchableOpacity>
    )}
  </View>
);

export default React.memo(AccountSection);
