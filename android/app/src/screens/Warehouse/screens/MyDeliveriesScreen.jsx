import React, { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Icon from 'react-native-vector-icons/Ionicons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { startOfDay, endOfDay, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigation } from '@react-navigation/native';
import globalStyles from '../../../styles/globalStyles';
import { useRoute } from '../../../context/RouteContext';
import { resolveCustomerName } from '../../../utils/customerUtils';
import StatCardGrid from '../../dashboard/components/StatCardGrid';
import { getDaysOverdue } from '../../../utils/creditUtils';
import { PreSaleContext } from '../../presales/context/preSaleContext';

// Una factura cobrada sigue siendo del entregador aunque tenga devoluciones.
// 'credit_dispatched': crédito ya entregado pero sin saldar; se mantiene en el
// historial con su saldo en vivo hasta que el crédito se pague por completo.
const HISTORY_STATUSES = ['paid', 'partially_returned', 'returned', 'credit_dispatched'];

const isCreditSale = (item) =>
  item?.paymentMethod === 'credit' || String(item?.status || '').startsWith('credit_');

// Devoluciones aprobadas sobre la factura (returnService.applyReturnToPresale).
const getReturnSummary = (sale) => {
  const lines = sale?.returnedSummary;
  if (!Array.isArray(lines) || lines.length === 0) return null;
  return {
    label: lines
      .map((l) => `${Number(l.quantity || 0)} ${l.productName}${l.isBonus ? ' (regalo)' : ''}`)
      .join(' · '),
    amount: Number(sale.returnedTotal) || 0,
    isFull: sale.status === 'returned',
  };
};

// Efectivo realmente recibido: el vuelto no cuenta, y un crédito puede abonarse parcial.
// Para créditos sin saldar el dato vivo es el crédito (suma de abonos), no la preventa.
const getCollectedAmount = (item, credit) => {
  const total = Number(item?.total) || 0;
  if (item?.status === 'credit_dispatched') {
    const creditPaid = Number(credit?.paid);
    if (Number.isFinite(creditPaid)) return Math.min(creditPaid, total);
  }
  const paid = Number(item?.amountPaid);
  return Number.isFinite(paid) && paid > 0 ? Math.min(paid, total) : total;
};

// Componente para cada Entrega (Versión Resumida)
// memo: fila de lista. El padre re-renderiza en cada tecla del buscador y en cada
// cambio de filtro; sin esto se vuelve a renderizar toda la lista montada.
const DeliveryItem = React.memo(({ item, onGoToPayment, customerName }) => {
  const isCredit = isCreditSale(item);

  const createdDate = item.createdAt
    ? new Date(item.createdAt.toDate()).toLocaleDateString() + ' ' + new Date(item.createdAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    : '---';

  return (
    <View style={styles.card}>
        <View style={styles.cardHeader}>
             <View style={styles.cardHeaderInfo}>
                  <Text style={styles.customerName}>{customerName || 'Cliente General'}</Text>
                  <Text style={styles.metaText}>#{item.id.substring(0, 6).toUpperCase()} · {createdDate}</Text>
              </View>

             <View style={styles.cardHeaderRight}>
                  <Text style={styles.totalText}>${item.total?.toFixed(2)}</Text>
                  <View style={styles.badgeRow}>
                     <View style={styles.badge}>
                       <Text style={styles.badgeText}>Pendiente</Text>
                     </View>
                     {isCredit && (
                       <View style={styles.creditBadge}>
                         <Text style={styles.creditBadgeText}>Crédito</Text>
                       </View>
                     )}
                  </View>
             </View>
        </View>

        <TouchableOpacity style={styles.mainActionButton} onPress={() => onGoToPayment(item)}>
            <Text style={styles.mainActionText}>COBRAR</Text>
        </TouchableOpacity>
    </View>
  );
});

const formatTimestamp = (date) => {
  if (!date) return '---';
  if (typeof date.toDate === 'function') {
    const value = date.toDate();
    return value.toLocaleDateString() + ' ' + value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const value = date instanceof Date ? date : new Date(date);
  return value.toLocaleDateString() + ' ' + value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const normalizeQuery = (value) => (value || '').toString().toLowerCase().trim();

const matchesFilter = (item, query, customerName) => {
  if (!query) return true;
  const haystack = [
    item.id,
    customerName || item.customerName,
    item.phone,
    item.address,
    item.total?.toFixed ? item.total.toFixed(2) : item.total,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
};

const toDate = (value) => (typeof value?.toDate === 'function' ? value.toDate() : new Date(value));

// Rango personalizado del calendario. Con solo 'from' filtra ese día exacto;
// con ambas fechas, el rango completo. Los límites se estiran al día entero para
// que una entrega de las 14:00 del día 'hasta' no quede fuera.
const isWithinCustomRange = (date, from, to) => {
  if (!from && !to) return true;
  if (!date) return false;
  const value = toDate(date);
  const start = startOfDay(from || to);
  const end = endOfDay(to || from);
  return value >= start && value <= end;
};

const isWithinRange = (date, rangeKey) => {
  if (!date || !rangeKey) return true;
  const baseDate = toDate(date);
  const now = new Date();

  if (rangeKey === 'today') {
    return baseDate.toDateString() === now.toDateString();
  }

  if (rangeKey === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return baseDate.toDateString() === yesterday.toDateString();
  }

  if (rangeKey === 'week') {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    return baseDate >= weekStart && baseDate <= now;
  }

  if (rangeKey === 'month') {
    return baseDate.getFullYear() === now.getFullYear() && baseDate.getMonth() === now.getMonth();
  }

  return true;
};

const DATE_CHIPS = [
  { key: 'all', label: 'Todas' },
  { key: 'today', label: 'Hoy' },
  { key: 'yesterday', label: 'Ayer' },
  { key: 'week', label: '7 dias' },
  { key: 'month', label: 'Mes' },
  { key: 'custom', label: 'Fecha', icon: 'calendar-outline' },
];

const METHOD_CHIPS = [
  { key: 'all', label: 'Todos' },
  { key: 'cash', label: 'Efectivo' },
  { key: 'credit', label: 'Credito' },
];

const matchesMethod = (item, methodKey) => {
  if (methodKey === 'cash') return !isCreditSale(item);
  if (methodKey === 'credit') return isCreditSale(item);
  return true;
};

const FilterChips = ({ chips, value, onChange }) => (
  <View style={styles.filterChips}>
    {chips.map((chip) => {
      const active = value === chip.key;
      return (
        <TouchableOpacity
          key={chip.key}
          style={[styles.chip, active && styles.chipActive]}
          onPress={() => onChange(chip.key)}
        >
          {!!chip.icon && (
            <Icon name={chip.icon} size={13} color={active ? '#FFFFFF' : '#333333'} />
          )}
          <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

// Selector de fecha/rango del historial. Un solo día = elegir "Desde" y dejar
// "Hasta" vacío; el resumen de arriba refleja siempre lo que se está viendo.
const DateRangeFilter = ({ from, to, onPick, onClear }) => {
  const label = (date, fallback) => (date ? format(date, "d 'de' MMM yyyy", { locale: es }) : fallback);
  return (
    <View style={styles.rangeBox}>
      <View style={styles.rangeRow}>
        <TouchableOpacity style={styles.rangeBtn} onPress={() => onPick('from')} activeOpacity={0.85}>
          <Icon name="calendar-outline" size={15} color="#007AFF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.rangeLabel}>Desde</Text>
            <Text style={styles.rangeValue} numberOfLines={1}>{label(from, 'Elegir fecha')}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.rangeBtn} onPress={() => onPick('to')} activeOpacity={0.85}>
          <Icon name="calendar-outline" size={15} color="#007AFF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.rangeLabel}>Hasta</Text>
            <Text style={styles.rangeValue} numberOfLines={1}>{label(to, 'Mismo día')}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {(from || to) && (
        <TouchableOpacity style={styles.rangeClear} onPress={onClear}>
          <Icon name="close-circle" size={14} color="#8E8E93" />
          <Text style={styles.rangeClearText}>Quitar fechas</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const getBonusSummary = (sale) => {
  const bonuses = sale?.bonusesAwarded || sale?.bonuses || [];
  if (!Array.isArray(bonuses) || bonuses.length === 0) {
    return { hasBonuses: false, skuCount: 0, unitsCount: 0 };
  }

  const skuSet = new Set();
  let units = 0;

  bonuses.forEach((bonus, idx) => {
    const skuKey = String(bonus?.productId || bonus?.id || bonus?.productName || bonus?.name || `bonus_${idx}`)
      .trim()
      .toLowerCase();
    if (skuKey) skuSet.add(skuKey);
    units += Number(bonus?.quantity || bonus?.qty || bonus?.bonusQty || 0);
  });

  return {
    hasBonuses: true,
    skuCount: skuSet.size,
    unitsCount: Number(units.toFixed(2)),
  };
};

// memo: ver DeliveryItem.
const HistoryItem = React.memo(({ item, onOpen, customerName, credit }) => {
  const paidDate = formatTimestamp(item.fechaPago || item.dispatchedAt || item.fechaEntregaRepartidor);
  const bonusSummary = getBonusSummary(item);
  const returnSummary = getReturnSummary(item);
  const isUnsettledCredit = item.status === 'credit_dispatched';
  // Saldo en vivo del crédito; si aún no carga el listener, aproximar con la preventa.
  const creditPending = isUnsettledCredit
    ? (Number.isFinite(Number(credit?.pending))
        ? Number(credit.pending)
        : Math.max((Number(item.total) || 0) - (Number(item.amountPaid) || 0), 0))
    : 0;
  const creditPaid = isUnsettledCredit ? getCollectedAmount(item, credit) : 0;
  const daysOverdue = isUnsettledCredit ? getDaysOverdue(credit || { dueDate: item.creditDueDate }) : 0;
  return (
    <TouchableOpacity style={styles.historyCard} onPress={() => onOpen(item)}>
      <View style={styles.historyRow}>
        <View style={styles.historyInfo}>
          <Text style={styles.historyTitle}>Pre-Venta #{item.id.substring(0, 6).toUpperCase()}</Text>
          <Text style={styles.historyCustomer}>{customerName || 'Cliente General'}</Text>
          <Text style={styles.historyMeta}>{paidDate}</Text>
        </View>
        <View style={styles.historyRight}>
          <Text style={[styles.historyTotal, isUnsettledCredit && styles.historyTotalPending]}>
            C${(Number(item.total) || 0).toFixed(2)}
          </Text>
          <Icon name="chevron-forward" size={20} color="#94A3B8" />
        </View>
      </View>

      {/* Crédito sin saldar: saldo y abonos en vivo desde el módulo de créditos. */}
      {isUnsettledCredit && (
        <View style={styles.historyCreditRow}>
          <Icon name="card-outline" size={14} color="#5856D6" />
          <Text style={styles.historyCreditText}>
            Por cobrar: ${creditPending.toFixed(2)}
            {creditPaid > 0 ? ` · Abonado: $${creditPaid.toFixed(2)}` : ' · Sin abonos'}
          </Text>
          {daysOverdue > 0 && (
            <Text style={styles.historyCreditOverdue}>{daysOverdue}d atraso</Text>
          )}
        </View>
      )}

      {/* Devolución aprobada: qué salió de la factura y cuánto se descontó. */}
      {returnSummary && (
        <View style={styles.historyReturnRow}>
          <Icon name="return-up-back-outline" size={14} color="#FF3B30" />
          <Text style={styles.historyReturnText} numberOfLines={2}>
            {returnSummary.isFull ? 'Devuelta: ' : 'Devuelto: '}
            {returnSummary.label}
          </Text>
          {returnSummary.amount > 0 && (
            <Text style={styles.historyReturnAmount}>-${returnSummary.amount.toFixed(2)}</Text>
          )}
        </View>
      )}

      {bonusSummary.hasBonuses && (
        <View style={styles.historyBonusRow}>
          <Icon name="gift-outline" size={14} color="#5856D6" />
          <Text style={styles.historyBonusText}>
            {bonusSummary.skuCount} regalo(s) · {bonusSummary.unitsCount} unidad(es)
          </Text>
        </View>
      )}

      {isCreditSale(item) && (
        <View style={styles.historyBadgeRow}>
          <View style={styles.creditBadge}>
            <Text style={styles.creditBadgeText}>{isUnsettledCredit ? 'Crédito sin saldar' : 'Crédito'}</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
});

export default function MyDeliveriesScreen({ user, role }) {
  const [deliveries, setDeliveries] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [deliveryFilter, setDeliveryFilter] = useState('');
  const [deliveryMethodFilter, setDeliveryMethodFilter] = useState('all');
  const [historyFilter, setHistoryFilter] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState('all');
  const [historyMethodFilter, setHistoryMethodFilter] = useState('all');
  const [customFrom, setCustomFrom] = useState(null);
  const [customTo, setCustomTo] = useState(null);
  const [pickerTarget, setPickerTarget] = useState(null);   // 'from' | 'to' | null
  const [activePanel, setActivePanel] = useState('pending');
  const [showFilters, setShowFilters] = useState(false);
  const [creditsByPreSaleId, setCreditsByPreSaleId] = useState({});
  const navigation = useNavigation();
  const { selectedRoute } = useRoute();

  // El mapa de clientes lo mantiene PreSaleProvider a nivel app. Antes cada pantalla
  // de Bodega abría su propio listener sobre la colección `customers` completa.
  const { customersById } = useContext(PreSaleContext);

  const isAdmin = role === 'admin';
  // El entregador siempre trabaja sobre una ruta seleccionada, igual que el
  // bodeguero en WarehouseDashboardScreen; admin puede ver todas.
  const routeMissing = !isAdmin && !selectedRoute?.id;

  useEffect(() => {
    if (!user || !user.uid) {
        setLoading(false);
        setLoadingHistory(false);
        return;
    }
    if (routeMissing) {
        setDeliveries([]);
        setHistory([]);
        setLoading(false);
        setLoadingHistory(false);
        return;
    }

    console.log(`Escuchando entregas para: ${user.uid}`);

    // CORRECCIÓN: Colección 'presales' y estado 'dispatched'
    let query = firestore()
      .collection('presales')
      .where('status', '==', 'dispatched');

    if (!isAdmin) {
      query = query.where('entregadorId', '==', user.uid);
    }

    if (!isAdmin && selectedRoute && selectedRoute.id) {
      query = query.where('routeId', '==', selectedRoute.id);
    }

    const subscriber = query.onSnapshot(querySnapshot => {
        if (!querySnapshot) {
          setDeliveries([]);
          setLoading(false);
          return;
        }
        const sales = [];
        querySnapshot.forEach(doc => sales.push({ id: doc.id, ...doc.data() }));

        sales.sort((a, b) => {
            const dateA = a.fechaEntregaRepartidor ? a.fechaEntregaRepartidor.toMillis() : 0;
            const dateB = b.fechaEntregaRepartidor ? b.fechaEntregaRepartidor.toMillis() : 0;
            return dateB - dateA;
        });

        console.log(`Entregas encontradas: ${sales.length}`);
        setDeliveries(sales);
        setLoading(false);
      }, error => {
        console.error("Error al escuchar entregas:", error);
        setDeliveries([]);
        setLoading(false);
      });

    // Historial de entregas pagadas por el repartidor. Una devolución aprobada
    // cambia el status a returned/partially_returned: la factura sigue siendo del
    // entregador, así que se mantiene en el historial con sus totales ya recalculados.
    let historyQuery = firestore()
      .collection('presales')
      .where('status', 'in', HISTORY_STATUSES);

    if (!isAdmin) {
      historyQuery = historyQuery.where('entregadorId', '==', user.uid);
    }

    if (!isAdmin && selectedRoute && selectedRoute.id) {
      historyQuery = historyQuery.where('routeId', '==', selectedRoute.id);
    }

    const historySubscriber = historyQuery.onSnapshot(querySnapshot => {
        if (!querySnapshot) {
          setHistory([]);
          setLoadingHistory(false);
          return;
        }
        const sales = [];
        querySnapshot.forEach(doc => sales.push({ id: doc.id, ...doc.data() }));

        const sortDate = (s) => {
          const ts = s.fechaPago || s.dispatchedAt || s.fechaEntregaRepartidor;
          return ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0;
        };
        sales.sort((a, b) => sortDate(b) - sortDate(a));

        setHistory(sales);
        setLoadingHistory(false);
      }, error => {
        console.error("Error al escuchar historial:", error);
        setHistory([]);
        setLoadingHistory(false);
      });

    // Saldo en vivo de los créditos sin saldar: cada abono registrado en el módulo
    // de créditos se refleja aquí sin recargar (los saldados cambian la preventa a 'paid').
    const creditsSubscriber = firestore()
      .collection('credits')
      .where('status', '==', 'pending')
      .onSnapshot(querySnapshot => {
        if (!querySnapshot) {
          setCreditsByPreSaleId({});
          return;
        }
        const map = {};
        querySnapshot.forEach(doc => {
          const data = doc.data() || {};
          if (data.preSaleId) map[data.preSaleId] = { id: doc.id, ...data };
        });
        setCreditsByPreSaleId(map);
      }, error => {
        console.error('Error al escuchar créditos pendientes:', error);
        setCreditsByPreSaleId({});
      });

    return () => {
      subscriber();
      historySubscriber();
      creditsSubscriber();
    };
  }, [user, isAdmin, selectedRoute, routeMissing]);

  const handleGoToPayment = useCallback((item) => {
      navigation.navigate('DeliveryPayment', { delivery: item });
  }, [navigation]);

  const openHistory = useCallback((item) => {
    navigation.navigate('DeliveryDone', { sale: item });
  }, [navigation]);

  // renderItem con identidad estable: si se declara inline en el JSX, cada render
  // crea una función nueva y React.memo en las filas no sirve de nada.
  const renderDelivery = useCallback(({ item }) => (
    <DeliveryItem
      item={item}
      onGoToPayment={handleGoToPayment}
      customerName={resolveCustomerName(item, customersById)}
    />
  ), [handleGoToPayment, customersById]);

  const renderHistory = useCallback(({ item }) => (
    <HistoryItem
      item={item}
      onOpen={openHistory}
      customerName={resolveCustomerName(item, customersById)}
      credit={creditsByPreSaleId[item.id]}
    />
  ), [openHistory, customersById, creditsByPreSaleId]);

  const filteredDeliveries = useMemo(() => {
    const query = normalizeQuery(deliveryFilter);
    return deliveries.filter((item) => {
      const customerName = resolveCustomerName(item, customersById);
      if (!matchesFilter(item, query, customerName)) return false;
      return matchesMethod(item, deliveryMethodFilter);
    });
  }, [deliveries, deliveryFilter, deliveryMethodFilter, customersById]);

  const filteredHistory = useMemo(() => {
    const query = normalizeQuery(historyFilter);
    const isCustom = historyDateFilter === 'custom';
    const rangeKey = historyDateFilter === 'all' || isCustom ? '' : historyDateFilter;
    return history.filter((item) => {
      const customerName = resolveCustomerName(item, customersById);
      if (!matchesFilter(item, query, customerName)) return false;
      if (!matchesMethod(item, historyMethodFilter)) return false;
      const date = item.fechaPago || item.dispatchedAt || item.fechaEntregaRepartidor;
      return isCustom
        ? isWithinCustomRange(date, customFrom, customTo)
        : isWithinRange(date, rangeKey);
    });
  }, [history, historyFilter, historyDateFilter, historyMethodFilter, customersById, customFrom, customTo]);

  const handlePickDate = useCallback((target) => setPickerTarget(target), []);

  const handleConfirmDate = useCallback((date) => {
    // Fechas invertidas: se arrastra el otro extremo en vez de rechazar la selección.
    if (pickerTarget === 'from') {
      setCustomFrom(date);
      setCustomTo((prev) => (prev && prev < date ? date : prev));
    } else {
      setCustomTo(date);
      setCustomFrom((prev) => (prev && prev > date ? date : prev));
    }
    setPickerTarget(null);
  }, [pickerTarget]);

  const handleClearDates = useCallback(() => {
    setCustomFrom(null);
    setCustomTo(null);
  }, []);

  // Efectivo vs credito: lo que el entregador debe traer en mano no incluye el credito.
  const pendingTotals = useMemo(() => {
    return filteredDeliveries.reduce(
      (acc, item) => {
        const total = Number(item.total) || 0;
        if (isCreditSale(item)) acc.credit += total;
        else acc.cash += total;
        return acc;
      },
      { cash: 0, credit: 0 }
    );
  }, [filteredDeliveries]);

  const collectedTotals = useMemo(() => {
    return filteredHistory.reduce(
      (acc, item) => {
        const amount = getCollectedAmount(item, creditsByPreSaleId[item.id]);
        if (isCreditSale(item)) acc.credit += amount;
        else acc.cash += amount;
        return acc;
      },
      { cash: 0, credit: 0 }
    );
  }, [filteredHistory, creditsByPreSaleId]);

  const isPending = activePanel === 'pending';
  const searchValue = isPending ? deliveryFilter : historyFilter;
  const routeHint = isAdmin
    ? 'Administrador: todas las rutas'
    : `Ruta: ${selectedRoute?.name || '---'}`;

  // 'custom' sin fechas elegidas todavia no filtra nada, así que no cuenta como activo.
  const hasDateFilter = historyDateFilter === 'custom'
    ? !!(customFrom || customTo)
    : historyDateFilter !== 'all';

  // Chips activos (distintos del valor por defecto) para avisar que la lista viene filtrada
  // aunque el panel de filtros este colapsado.
  const activeFilterCount = isPending
    ? Number(deliveryMethodFilter !== 'all')
    : Number(historyMethodFilter !== 'all') + Number(hasDateFilter);

  // Gate: el entregador debe seleccionar una ruta antes de ver sus entregas.
  // Mismo patrón que WarehouseDashboardScreen para el bodeguero.
  if (routeMissing) {
    return (
      <View style={globalStyles.container}>
        <View style={globalStyles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="chevron-back" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={globalStyles.title}>Mis Entregas</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 }}>
          <Icon name="map-outline" size={64} color="#C7C7CC" />
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#333', marginTop: 16, textAlign: 'center' }}>
            Selecciona una ruta
          </Text>
          <Text style={{ fontSize: 14, color: '#8E8E93', marginTop: 8, textAlign: 'center' }}>
            Para ver tus entregas primero debes elegir la ruta en la que vas a trabajar.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#007AFF', borderRadius: 30, paddingVertical: 14, paddingHorizontal: 28, marginTop: 24 }}
            onPress={() => navigation.navigate('RouteSelection', { user, role, returnTo: 'MyDeliveries' })}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Seleccionar Ruta</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={globalStyles.container}>
      <View style={globalStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={globalStyles.title}>Mis Entregas</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.bodyLayout}>
        <View style={styles.panelStrip}>
          <TouchableOpacity
            style={[styles.panelButton, activePanel === 'pending' && styles.panelButtonActive]}
            onPress={() => setActivePanel('pending')}
          >
            <Icon name="bicycle-outline" size={16} color={activePanel === 'pending' ? '#fff' : '#8E8E93'} />
            <Text style={[styles.panelText, activePanel === 'pending' && styles.panelTextActive]}>
              Pendientes ({filteredDeliveries.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.panelButton, activePanel === 'history' && styles.panelButtonActive]}
            onPress={() => setActivePanel('history')}
          >
            <Icon name="receipt-outline" size={16} color={activePanel === 'history' ? '#fff' : '#8E8E93'} />
            <Text style={[styles.panelText, activePanel === 'history' && styles.panelTextActive]}>
              Historial ({filteredHistory.length})
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.contentPanel}>
          <View style={styles.toolbar}>
            <View style={styles.searchBox}>
              <Icon name="search-outline" size={16} color="#8E8E93" />
              <TextInput
                value={isPending ? deliveryFilter : historyFilter}
                onChangeText={isPending ? setDeliveryFilter : setHistoryFilter}
                placeholder={isPending ? 'Buscar cliente, id o total' : 'Buscar en historial'}
                style={styles.searchInput}
                placeholderTextColor="#8E8E93"
                autoCorrect={false}
              />
              {!!searchValue && (
                <TouchableOpacity onPress={() => (isPending ? setDeliveryFilter('') : setHistoryFilter(''))}>
                  <Icon name="close-circle" size={16} color="#8E8E93" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.filterToggle, (showFilters || activeFilterCount > 0) && styles.filterToggleActive]}
              onPress={() => setShowFilters((prev) => !prev)}
            >
              <Icon
                name="options-outline"
                size={18}
                color={showFilters || activeFilterCount > 0 ? '#fff' : '#8E8E93'}
              />
              {activeFilterCount > 0 && <Text style={styles.filterToggleBadge}>{activeFilterCount}</Text>}
            </TouchableOpacity>
          </View>

          {isPending ? (
            loading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={{ marginTop: 6 }}>Cargando tus entregas...</Text>
              </View>
            ) : (
              <FlatList
                data={filteredDeliveries}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={(
                  <View>
                    {showFilters && (
                      <FilterChips
                        chips={METHOD_CHIPS}
                        value={deliveryMethodFilter}
                        onChange={setDeliveryMethodFilter}
                      />
                    )}
                    <Text style={styles.routeHint}>{routeHint}</Text>
                    <StatCardGrid
                      availableStats={{
                        pendingCash: {
                          icon: 'cash-outline',
                          color: '#007AFF',
                          title: 'Efectivo por cobrar',
                          value: `C$${pendingTotals.cash.toFixed(2)}`,
                        },
                        pendingCredit: {
                          icon: 'card-outline',
                          color: '#5856D6',
                          title: 'Credito por cobrar',
                          value: `C$${pendingTotals.credit.toFixed(2)}`,
                        },
                      }}
                      layout={[[
                        { key: 'pendingCash', size: 1 },
                        { key: 'pendingCredit', size: 1 },
                      ]]}
                    />
                  </View>
                )}
                renderItem={renderDelivery}
                ListEmptyComponent={(
                  <View style={styles.centerContainer}>
                    <Icon name="bicycle-outline" size={64} color="#E0E0E0" />
                    <Text style={styles.emptyText}>No tienes entregas pendientes por cobrar.</Text>
                  </View>
                )}
                contentContainerStyle={styles.listContent}
              />
            )
          ) : loadingHistory ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={{ marginTop: 6 }}>Cargando historial...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredHistory}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={(
                <View>
                  {showFilters && (
                    <>
                      <FilterChips
                        chips={DATE_CHIPS}
                        value={historyDateFilter}
                        onChange={setHistoryDateFilter}
                      />
                      {historyDateFilter === 'custom' && (
                        <DateRangeFilter
                          from={customFrom}
                          to={customTo}
                          onPick={handlePickDate}
                          onClear={handleClearDates}
                        />
                      )}
                      <FilterChips
                        chips={METHOD_CHIPS}
                        value={historyMethodFilter}
                        onChange={setHistoryMethodFilter}
                      />
                    </>
                  )}
                  <Text style={styles.routeHint}>{routeHint}</Text>
                  <StatCardGrid
                    availableStats={{
                      cashCollected: {
                        icon: 'cash-outline',
                        color: '#34C759',
                        title: 'Efectivo cobrado',
                        value: `C$${collectedTotals.cash.toFixed(2)}`,
                      },
                      creditCollected: {
                        icon: 'card-outline',
                        color: '#5856D6',
                        title: 'Credito cobrado',
                        value: `C$${collectedTotals.credit.toFixed(2)}`,
                      },
                    }}
                    layout={[[
                      { key: 'cashCollected', size: 1 },
                      { key: 'creditCollected', size: 1 },
                    ]]}
                  />
                </View>
              )}
              renderItem={renderHistory}
              ListEmptyComponent={(
                <View style={styles.centerContainer}>
                  <Icon name="receipt-outline" size={64} color="#E0E0E0" />
                  <Text style={styles.emptyText}>
                    {hasDateFilter
                      ? 'No hay entregas cobradas en las fechas seleccionadas.'
                      : 'No tienes entregas cobradas.'}
                  </Text>
                </View>
              )}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
      </View>

      {/* Calendario del filtro por fecha (historial) */}
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

const styles = StyleSheet.create({
  // Tokens de ../DESIGN.md: Field Blue #007AFF (accion primaria/estado activo),
  // verde #34C759 solo para cobrado/pagado, morado #5856D6 para credito, Card Lift como
  // unica sombra.
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  emptyText: { textAlign: 'center', marginTop: 10, fontSize: 16, color: '#8E8E93', maxWidth: '80%' },
  bodyLayout: { flex: 1 },
  panelStrip: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F5F6FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  panelButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#EEEEEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelButtonActive: { backgroundColor: '#007AFF' },
  panelText: { fontSize: 12, fontWeight: '700', color: '#8E8E93' },
  panelTextActive: { color: '#FFFFFF' },
  contentPanel: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchInput: { flex: 1, paddingVertical: 8, color: '#1A1A1A', fontSize: 14, fontWeight: '600' },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#EEEEEE',
  },
  filterToggleActive: { backgroundColor: '#007AFF' },
  filterToggleBadge: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  filterChips: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#EEEEEE',
  },
  chipActive: { backgroundColor: '#007AFF' },
  chipText: { fontSize: 12, color: '#333333', fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  routeHint: { fontSize: 11, fontWeight: '500', color: '#8E8E93', marginBottom: 6 },

  // Selector de rango: contenedor anidado sobre el lienzo, radio 12 del sistema.
  rangeBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 8,
    marginBottom: 8,
  },
  rangeRow: { flexDirection: 'row', gap: 8 },
  rangeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F6FA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  rangeLabel: { fontSize: 10, fontWeight: '600', color: '#8E8E93' },
  rangeValue: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  rangeClear: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 8,
  },
  rangeClearText: { fontSize: 12, fontWeight: '600', color: '#8E8E93' },
  listContent: { paddingBottom: 20, flexGrow: 1 },

  // Card Lift: la unica receta de sombra del sistema.
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 10,
    paddingBottom: 10,
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  cardHeaderInfo: { flex: 1, paddingRight: 12, minWidth: 0 },
  cardHeaderRight: { alignItems: 'flex-end', flexShrink: 0, minWidth: 94 },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  metaText: { fontSize: 11, fontWeight: '500', color: '#8E8E93' },
  // Pendiente: aun no es dinero cobrado, por eso va en tinta y no en verde.
  totalText: { fontSize: 16, fontWeight: '800', color: '#1A1A1A', lineHeight: 20, marginBottom: 4 },
  badge: {
    backgroundColor: '#EEEEEE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#8E8E93' },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
    gap: 6,
  },
  creditBadge: {
    backgroundColor: '#5856D6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  creditBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  mainActionButton: {
    backgroundColor: '#007AFF',
    marginHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.6,
  },

  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 10,
    padding: 12,
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyInfo: { flex: 1, paddingRight: 12, minWidth: 0 },
  historyTitle: { fontSize: 11, fontWeight: '500', color: '#8E8E93', marginBottom: 2 },
  historyCustomer: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  historyMeta: { fontSize: 11, fontWeight: '500', color: '#8E8E93' },
  historyRight: { alignItems: 'flex-end', gap: 4, flexShrink: 0, minWidth: 74 },
  // Cobrado: verde semantico, aqui si corresponde.
  historyTotal: { fontSize: 16, fontWeight: '800', color: '#34C759', lineHeight: 20 },
  // Credito sin saldar: todavia no es dinero cobrado, va en tinta.
  historyTotalPending: { color: '#1A1A1A' },
  // Credito sin saldar: morado #5856D6, mismo codigo de color que el badge de credito.
  historyCreditRow: {
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: '#5856D615',
    borderWidth: 1,
    borderColor: '#5856D630',
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyCreditText: { flex: 1, color: '#5856D6', fontSize: 12, fontWeight: '600' },
  historyCreditOverdue: { color: '#FF3B30', fontSize: 12, fontWeight: '800' },
  historyBadgeRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, flexShrink: 0 },
  historyBonusRow: {
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: '#5856D615',
    borderWidth: 1,
    borderColor: '#5856D630',
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyBonusText: { color: '#5856D6', fontSize: 12, fontWeight: '600' },
  // Devolucion: rojo semantico (dinero que sale de la factura), no decorativo.
  historyReturnRow: {
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: '#FF3B3010',
    borderWidth: 1,
    borderColor: '#FF3B3030',
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyReturnText: { flex: 1, color: '#FF3B30', fontSize: 12, fontWeight: '600' },
  historyReturnAmount: { color: '#FF3B30', fontSize: 12, fontWeight: '800' },
});
