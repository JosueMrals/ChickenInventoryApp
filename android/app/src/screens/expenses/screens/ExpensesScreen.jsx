import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, TextInput, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { startOfDay, endOfDay, subDays, startOfMonth, format } from 'date-fns';
import { es } from 'date-fns/locale';
import auth from '@react-native-firebase/auth';

import { getMyExpenses } from '../services/expenseService';
import { CATEGORY_LABELS, STATUS_LABELS, getCashImpactBadge } from '../utils/expenseLabels';
import { formatCurrency } from '../../../utils/formatMoney';
import { normalizeText } from '../../../utils/textUtils';
import styles, { COLORS } from '../styles/expensesStyles';

// Colores del badge de estado — mismo criterio semántico del design system
// (verde éxito, rojo peligro, ámbar pendiente); sin inventar un componente
// genérico nuevo, este módulo no lo necesitaba en ningún otro lado del repo.
const STATUS_COLORS = {
  PENDING: COLORS.amber,
  APPROVED: COLORS.green,
  REJECTED: COLORS.red,
  CANCELLED: COLORS.muted,
};

const STATUS_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'PENDING', label: 'Pendiente' },
  { key: 'APPROVED', label: 'Aprobado' },
  { key: 'REJECTED', label: 'Rechazado' },
  { key: 'CANCELLED', label: 'Cancelado' },
];

const DATE_FILTERS = [
  { key: 'all', label: 'Todo' },
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: '7 días' },
  { key: 'month', label: 'Mes' },
  { key: 'custom', label: 'Fecha', icon: 'calendar-outline' },
];

// Rango [desde, hasta] de cada atajo — mismo criterio que HandoverHistoryScreen.
function presetRange(key) {
  const now = new Date();
  switch (key) {
    case 'today': return [startOfDay(now), endOfDay(now)];
    case 'week': return [startOfDay(subDays(now, 6)), endOfDay(now)];
    case 'month': return [startOfMonth(now), endOfDay(now)];
    default: return null;
  }
}

function expenseDate(item) {
  const millis = item.createdAt?.toMillis?.();
  return millis ? new Date(millis) : null;
}

function formatShortDate(date) {
  if (!date) return '—';
  return format(date, 'd MMM · HH:mm', { locale: es });
}

export default function ExpensesScreen({ navigation, route }) {
  const { role } = route?.params ?? {};
  const isAdmin = role === 'admin';
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [menuVisible, setMenuVisible] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [customFrom, setCustomFrom] = useState(null);
  const [customTo, setCustomTo] = useState(null);
  const [pickerTarget, setPickerTarget] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    const uid = auth().currentUser?.uid;
    if (!uid) return;
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      // Solo los propios — mismo uid del usuario autenticado, nunca uno arbitrario.
      const list = await getMyExpenses(uid);
      list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      setExpenses(list);
    } catch (e) {
      console.error('[ExpensesScreen] error cargando gastos:', e);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Rango de fecha efectivo. En "Fecha" sin nada elegido todavía, cae al día de hoy.
  const customRange = useMemo(() => {
    if (dateFilter !== 'custom') return null;
    if (!customFrom && !customTo) return [startOfDay(new Date()), endOfDay(new Date())];
    const start = startOfDay(customFrom || customTo);
    const end = endOfDay(customTo || customFrom);
    return [start, end];
  }, [dateFilter, customFrom, customTo]);

  const filtered = useMemo(() => {
    const query = normalizeText(search);
    const range = dateFilter === 'custom' ? customRange : presetRange(dateFilter);
    return expenses.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (range) {
        const date = expenseDate(item);
        if (!date || date < range[0] || date > range[1]) return false;
      }
      if (query) {
        const haystack = normalizeText([
          CATEGORY_LABELS[item.category] || item.category,
          item.description,
          STATUS_LABELS[item.status],
        ].filter(Boolean).join(' '));
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [expenses, search, statusFilter, dateFilter, customRange]);

  const totalAmount = useMemo(
    () => filtered.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [filtered],
  );

  const handleConfirmDate = useCallback((date) => {
    if (pickerTarget === 'from') {
      setCustomFrom(date);
      setCustomTo((prev) => (prev && prev < date ? date : prev));
    } else {
      setCustomTo(date);
      setCustomFrom((prev) => (prev && prev > date ? date : prev));
    }
    setPickerTarget(null);
  }, [pickerTarget]);

  const hasActiveFilters = !!search || statusFilter !== 'all' || dateFilter !== 'all';

  const renderItem = ({ item }) => {
    const statusColor = STATUS_COLORS[item.status] || COLORS.muted;
    return (
      <TouchableOpacity
        style={styles.expenseRow}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('ExpenseDetail', { expenseId: item.id })}
      >
        <View style={[styles.expenseStripe, { backgroundColor: statusColor }]} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.expenseRowTitle} numberOfLines={1}>
              {CATEGORY_LABELS[item.category] || item.category}
            </Text>
            <Text style={styles.expenseRowAmount}>{formatCurrency(item.amount)}</Text>
          </View>
          <Text style={styles.expenseRowMeta} numberOfLines={1}>
            {formatShortDate(expenseDate(item))}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <Text style={[styles.expenseRowMeta, { color: statusColor, fontWeight: '700' }]}>
              {STATUS_LABELS[item.status] || item.status}
            </Text>
            <Text style={styles.expenseRowMeta}>{getCashImpactBadge(item.paymentMethod)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBack} onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gastos Operativos</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setMenuVisible((prev) => !prev)}
            style={[styles.headerMenuBtn, hasActiveFilters && styles.headerMenuBtnActive]}
          >
            <Icon name="ellipsis-vertical" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {menuVisible && (
        <>
          <TouchableOpacity style={styles.topActionsBackdrop} activeOpacity={1} onPress={() => setMenuVisible(false)} />
          <View style={styles.topActionsMenu}>
            <TouchableOpacity
              style={styles.topActionsMenuOption}
              onPress={() => {
                setMenuVisible(false);
                setFiltersVisible((prev) => !prev);
              }}
            >
              <Icon name="options-outline" size={18} color={COLORS.primary} />
              <Text style={styles.topActionsMenuOptionText}>{filtersVisible ? 'Ocultar filtros' : 'Filtros'}</Text>
            </TouchableOpacity>

            {isAdmin && (
              <TouchableOpacity
                style={[styles.topActionsMenuOption, { borderBottomWidth: 0 }]}
                onPress={() => {
                  setMenuVisible(false);
                  navigation.navigate('ExpenseReview', { role });
                }}
              >
                <Icon name="checkmark-done-outline" size={18} color={COLORS.primary} />
                <Text style={styles.topActionsMenuOptionText}>Revisar pendientes</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      {/* Banda de resumen: cuántos gastos y cuánto suman, sobre lo YA filtrado. */}
      <View style={styles.summaryBandSm}>
        <View style={styles.summaryCellSm}>
          <Text style={styles.summaryValueSm}>{filtered.length}</Text>
          <Text style={styles.summaryLabelSm}>Gastos</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCellSm}>
          <Text style={styles.summaryValueSm}>{formatCurrency(totalAmount)}</Text>
          <Text style={styles.summaryLabelSm}>Total</Text>
        </View>
      </View>

      {filtersVisible && (
        <>
          <View style={styles.searchRowSm}>
            <Icon name="search" size={16} color={COLORS.muted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInputSm}
              placeholder="Buscar categoría, descripción, estado"
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

          {/* Filtros en una sola fila horizontal deslizable: fecha + separador + estado. */}
          <View style={styles.chipsRowWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRowSm}
            >
              {DATE_FILTERS.map((f) => {
                const active = dateFilter === f.key;
                return (
                  <TouchableOpacity
                    key={`d-${f.key}`}
                    style={[styles.chipSm, active && styles.chipSmActive]}
                    onPress={() => setDateFilter(f.key)}
                  >
                    {!!f.icon && (
                      <Icon name={f.icon} size={11} color={active ? '#fff' : COLORS.muted} style={{ marginRight: 3 }} />
                    )}
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

          {dateFilter === 'custom' && (
            <View style={styles.rangeRow}>
              <TouchableOpacity style={styles.rangeBtn} onPress={() => setPickerTarget('from')}>
                <Icon name="calendar-outline" size={14} color={COLORS.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rangeLabel}>Desde</Text>
                  <Text style={styles.rangeValue} numberOfLines={1}>
                    {customFrom ? format(customFrom, "d 'de' MMM", { locale: es }) : 'Elegir'}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rangeBtn} onPress={() => setPickerTarget('to')}>
                <Icon name="calendar-outline" size={14} color={COLORS.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rangeLabel}>Hasta</Text>
                  <Text style={styles.rangeValue} numberOfLines={1}>
                    {customTo ? format(customTo, "d 'de' MMM", { locale: es }) : 'Mismo día'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={COLORS.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 90, paddingTop: 4 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Icon name="receipt-outline" size={40} color={COLORS.faint} />
              <Text style={styles.emptyText}>
                {hasActiveFilters
                  ? 'Ningún gasto coincide con el filtro.'
                  : 'Todavía no has registrado ningún gasto.'}
              </Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreateExpense')}>
        <Icon name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <DateTimePickerModal
        isVisible={!!pickerTarget}
        mode="date"
        locale="es"
        date={(pickerTarget === 'from' ? customFrom : customTo) || new Date()}
        maximumDate={new Date()}
        confirmTextIOS="Aceptar"
        cancelTextIOS="Cancelar"
        onConfirm={handleConfirmDate}
        onCancel={() => setPickerTarget(null)}
      />
    </View>
  );
}
