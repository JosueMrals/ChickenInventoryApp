import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useGoodsReceipts, TIME_FILTERS } from '../hooks/useGoodsReceipts';
import styles, { COLORS } from '../styles/receptionStyles';

const STATUS_FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'completed', label: 'OK' },
  { key: 'voided', label: 'Anuladas' },
];

// Fecha corta: sin año en el mismo día. Ahorra ancho en la fila compacta.
function formatShortDate(ts) {
  const millis = ts?.toMillis?.() ?? (typeof ts === 'number' ? ts : null);
  if (!millis) return '—';
  return format(new Date(millis), 'd MMM · HH:mm', { locale: es });
}

// Formatea C$ compacto (1.2k / 12.3k) para no reventar la banda de resumen.
function shortMoney(n) {
  const v = Number(n) || 0;
  if (v >= 10000) return `C$${(v / 1000).toFixed(1)}k`;
  return `C$${v.toFixed(0)}`;
}

export default function ReceptionListScreen({ navigation, route }) {
  const { user, role } = route?.params ?? {};
  const insets = useSafeAreaInsets();
  const {
    receipts,
    loading,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    timeFilter,
    setTimeFilter,
    summary,
  } = useGoodsReceipts({ limit: 150 });

  // Item de lista en una sola línea: N.º + estado a la izquierda, meta + total a la derecha.
  const renderReceipt = ({ item }) => {
    const isVoided = item.status === 'voided';
    return (
      <TouchableOpacity
        style={styles.receiptRow}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('ReceptionDetail', { receiptId: item.id, user, role })}
      >
        {/* Barra lateral de color: verde = ok, rojo = anulada. Estado visible sin badges. */}
        <View style={[styles.receiptStripe, { backgroundColor: isVoided ? COLORS.red : COLORS.green }]} />

        <View style={{ flex: 1 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.receiptNumberSm} numberOfLines={1}>
              #{item.receiptNumber ?? '—'} · {item.supplier || 'Sin proveedor'}
            </Text>
            <Text style={[styles.receiptTotal, isVoided && { color: COLORS.muted, textDecorationLine: 'line-through' }]}>
              C${Number(item.totalCost || 0).toFixed(0)}
            </Text>
          </View>
          <Text style={styles.receiptMetaSm} numberOfLines={1}>
            {formatShortDate(item.createdAt)}
            {item.reference ? `  ·  ${item.reference}` : ''}
            {`  ·  ${item.totalUnits ?? 0} u`}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recepción de Mercancía</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('ReceptionCreate', { user, role })}
          style={styles.headerBtn}
        >
          <Icon name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Banda de resumen compacta: una sola tarjeta con tres métricas separadas por | */}
      <View style={styles.summaryBandSm}>
        <View style={styles.summaryCellSm}>
          <Text style={styles.summaryValueSm}>{summary.completedCount}</Text>
          <Text style={styles.summaryLabelSm}>Recep.</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCellSm}>
          <Text style={styles.summaryValueSm}>{summary.totalUnits}</Text>
          <Text style={styles.summaryLabelSm}>Unidades</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCellSm}>
          <Text style={styles.summaryValueSm}>{shortMoney(summary.totalCost)}</Text>
          <Text style={styles.summaryLabelSm}>Costo</Text>
        </View>
      </View>

      {/* Búsqueda con ícono embebido, sin card grande */}
      <View style={styles.searchRowSm}>
        <Icon name="search" size={16} color={COLORS.muted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInputSm}
          placeholder="Buscar proveedor, factura, producto"
          placeholderTextColor={COLORS.muted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="close-circle" size={16} color={COLORS.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filtros en una sola fila horizontal deslizable: tiempo + separador + estado.
          Envuelto en View con altura fija: sin esto, el ScrollView horizontal se
          estira verticalmente por defecto y deja los chips flotando en el medio. */}
      <View style={styles.chipsRowWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRowSm}
        >
        {TIME_FILTERS.map((f) => {
          const active = timeFilter === f.key;
          return (
            <TouchableOpacity
              key={`t-${f.key}`}
              style={[styles.chipSm, active && styles.chipSmActive]}
              onPress={() => setTimeFilter(f.key)}
            >
              <Text style={[styles.chipSmText, active && styles.chipSmTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
        <View style={styles.chipsSeparator} />
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.key;
          return (
            <TouchableOpacity
              key={`s-${f.key}`}
              style={[styles.chipSm, active && styles.chipSmActive]}
              onPress={() => setStatusFilter(f.key)}
            >
              <Text style={[styles.chipSmText, active && styles.chipSmTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={receipts}
          keyExtractor={(item) => item.id}
          renderItem={renderReceipt}
          contentContainerStyle={{ paddingBottom: 24, paddingTop: 4 }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Icon name="file-tray-full-outline" size={48} color={COLORS.faint} />
              <Text style={styles.emptyText}>
                {search || statusFilter !== 'all' || timeFilter !== 'all'
                  ? 'No hay recepciones que coincidan con el filtro.'
                  : 'Aún no hay recepciones registradas. Toca + para registrar la primera.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
