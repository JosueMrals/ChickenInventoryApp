// Indicadores del comportamiento crediticio del cliente: uso del límite,
// saldo vigente, puntualidad de pago y recomendación para ajustar el límite.
import React from 'react';
import { Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import styles from '../styles/customerDetailStyles';
import { getCreditBehavior, getEffectiveCreditLimit } from '../../../utils/creditUtils';

export default function CustomerCreditIndicators({ customer, credits }) {
  const limit = getEffectiveCreditLimit(customer);
  const behavior = getCreditBehavior(credits);

  const available = Math.max(limit.total - behavior.pendingAmount, 0);
  const usage = limit.total > 0 ? Math.min(behavior.pendingAmount / limit.total, 1) : 0;

  // Buen candidato a subir límite: historial pagado, puntualidad alta y sin atrasos vigentes.
  const goodPayer = behavior.onTimeRate != null && behavior.onTimeRate >= 80 && behavior.overdueCount === 0;
  const badPayer = behavior.overdueCount > 0 || (behavior.onTimeRate != null && behavior.onTimeRate < 50);

  return (
    <View style={styles.indicatorsCard}>
      <Text style={styles.sectionTitle}>Créditos</Text>

      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Text style={styles.statLabel}>Límite{limit.extra > 0 ? ' + sobregiro' : ''}</Text>
          <Text style={styles.statValue}>C${limit.total.toFixed(2)}</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statLabel}>Saldo vigente</Text>
          <Text style={[styles.statValue, behavior.pendingAmount > 0 && styles.statValueDanger]}>
            C${behavior.pendingAmount.toFixed(2)}
          </Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statLabel}>Disponible</Text>
          <Text style={[styles.statValue, styles.statValueSuccess]}>C${available.toFixed(2)}</Text>
        </View>
      </View>

      {limit.total > 0 && (
        <>
          <View style={styles.usageBarWrap}>
            <View style={[styles.usageBar, usage >= 1 && styles.usageBarDanger, { width: `${usage * 100}%` }]} />
          </View>
          <Text style={styles.usageLabel}>{Math.round(usage * 100)}% del límite en uso</Text>
        </>
      )}

      <View style={styles.behaviorRow}>
        <Icon name="check-circle-outline" size={15} color="#34C759" />
        <Text style={styles.behaviorText}>Pagados a tiempo: {behavior.paidOnTime}</Text>
      </View>
      <View style={styles.behaviorRow}>
        <Icon name="clock-alert-outline" size={15} color="#FF3B30" />
        <Text style={styles.behaviorText}>
          Pagados con atraso: {behavior.paidLate} · Vencidos ahora: {behavior.overdueCount}
        </Text>
      </View>
      {behavior.onTimeRate != null && (
        <View style={styles.behaviorRow}>
          <Icon name="chart-line" size={15} color="#007AFF" />
          <Text style={styles.behaviorText}>Puntualidad de pago: {behavior.onTimeRate}%</Text>
        </View>
      )}

      {goodPayer && (
        <View style={[styles.recommendBanner, styles.recommendGood]}>
          <Icon name="trending-up" size={16} color="#1E7E34" />
          <Text style={[styles.recommendText, styles.recommendTextGood]}>
            Buen pagador: candidato a aumento de límite de crédito.
          </Text>
        </View>
      )}
      {badPayer && (
        <View style={[styles.recommendBanner, styles.recommendBad]}>
          <Icon name="alert-outline" size={16} color="#C0392B" />
          <Text style={[styles.recommendText, styles.recommendTextBad]}>
            Tiene créditos vencidos o paga con atraso: revisar antes de dar más crédito.
          </Text>
        </View>
      )}
    </View>
  );
}
