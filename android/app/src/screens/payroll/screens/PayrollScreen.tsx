import React, { useCallback, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { NavigationProp } from '@react-navigation/native';
import globalStyles from '../../../styles/globalStyles';
import styles, { COLORS } from '../styles/payrollStyles';
import PeriodSummary from '../components/PeriodSummary';
import StaffCard from '../components/StaffCard';
import { usePayroll } from '../hooks/usePayroll';
import { StaffAccount } from '../types';

interface Props {
  navigation: NavigationProp<any>;
  role?: string;
  user?: any;
}

/**
 * Nómina: lo que hay que pagar a cada trabajador en el periodo abierto.
 *
 * "Periodo abierto" es todo lo acumulado desde el último cierre: no hay fechas
 * fijas configuradas porque el negocio paga quincenal o mensual según el caso,
 * y el corte lo marca el admin al pagar (ver StaffAccountScreen).
 *
 * Esta vista con la lista completa expone salarios de toda la plantilla, así
 * que es exclusiva del admin: quien no lo es entra directo a su propia cuenta
 * en modo lectura (StaffAccountScreen con readOnly).
 */
export default function PayrollScreen({ navigation, role, user }: Props) {
  const isAdmin = !role || role === 'admin';

  useEffect(() => {
    if (!isAdmin && user?.uid) {
      navigation.replace('StaffAccount', { uid: user.uid, readOnly: true });
    }
  }, [isAdmin, navigation, user]);

  // No-admin: ni siquiera se monta la lista de abajo, que suscribe a los
  // salarios de TODA la plantilla — eso solo puede verlo el admin.
  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return <AdminPayrollList navigation={navigation} />;
}

function AdminPayrollList({ navigation }: { navigation: NavigationProp<any> }) {
  const { accounts, totals, loading, error } = usePayroll();

  const openAccount = useCallback(
    (account: StaffAccount) => {
      navigation.navigate('StaffAccount', { uid: account.staff.uid });
    },
    [navigation],
  );

  return (
    <View style={styles.container}>
      <View style={globalStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={globalStyles.title}>Nómina</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('PayrollHistory')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="time-outline" size={26} color="#FFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Cargando nómina...</Text>
        </View>
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={(item) => item.staff.uid}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <StaffCard account={item} onPress={openAccount} />}
          ListHeaderComponent={
            <>
              <PeriodSummary
                staffCount={totals.staffCount}
                salaries={totals.salaries}
                deductions={totals.deductions}
                netPay={totals.netPay}
              />

              {!!error && (
                <View style={styles.noticeBanner}>
                  <Icon name="alert-circle-outline" size={16} color={COLORS.danger} />
                  <Text style={[styles.noticeText, { color: COLORS.danger }]}>{error}</Text>
                </View>
              )}

              {totals.missingSalary > 0 && (
                <View style={styles.noticeBanner}>
                  <Icon name="information-circle-outline" size={16} color={COLORS.accent} />
                  <Text style={styles.noticeText}>
                    {totals.missingSalary === 1
                      ? '1 trabajador no tiene salario configurado.'
                      : `${totals.missingSalary} trabajadores no tienen salario configurado.`}
                  </Text>
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="people-outline" size={48} color={COLORS.muted} />
              <Text style={styles.emptyText}>
                No hay trabajadores con rol de vendedor, entregador o bodeguero.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
