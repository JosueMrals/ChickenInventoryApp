import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { NavigationProp } from '@react-navigation/native';
import globalStyles from '../../../styles/globalStyles';
import styles, { COLORS, formatMoney } from '../styles/payrollStyles';
import { formatTimestamp } from '../../returns/utils/format';
import { subscribeSettlements } from '../services/payrollService';
import { ROLE_LABELS, Settlement } from '../types';

interface Props {
  navigation: NavigationProp<any>;
}

/** Una deducción del recibo; se oculta en cero para no llenar de "C$0.00". */
const DeductionRow = ({ label, amount }: { label: string; amount: number }) => {
  if (!amount) return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
      <Text style={styles.lineMeta}>{label}</Text>
      <Text style={[styles.lineMeta, { color: COLORS.danger }]}>-{formatMoney(amount)}</Text>
    </View>
  );
};

/** Historial de pagos cerrados: el detalle de cada periodo ya liquidado. */
export default function PayrollHistoryScreen({ navigation }: Props) {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeSettlements((list) => {
      setSettlements(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <View style={styles.container}>
      <View style={globalStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={globalStyles.title}>Historial de Pagos</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Cargando historial...</Text>
        </View>
      ) : (
        <FlatList
          data={settlements}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Icon name="receipt-outline" size={17} color={COLORS.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>{item.userName}</Text>
                  <Text style={styles.lineMeta}>
                    {ROLE_LABELS[item.role] || item.role} · {formatTimestamp(item.paidAt)}
                  </Text>
                </View>
                <Text style={[styles.sectionTotal, { color: COLORS.success }]}>
                  {formatMoney(item.netPay)}
                </Text>
              </View>

              <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.divider }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.lineMeta}>Salario</Text>
                  <Text style={styles.lineMeta}>{formatMoney(item.salary)}</Text>
                </View>
                <DeductionRow label="Adelantos" amount={item.advancesTotal} />
                <DeductionRow label="Productos de bodega" amount={item.purchasesTotal} />
                <DeductionRow label="Faltantes" amount={item.shortagesTotal} />
                {!!item.paidBy && (
                  <Text style={[styles.lineMeta, { marginTop: 8 }]}>Pagado por {item.paidBy}</Text>
                )}
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="receipt-outline" size={48} color={COLORS.muted} />
              <Text style={styles.emptyText}>Todavía no se ha cerrado ningún pago.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
