import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated } from 'react-native';
import { fetchCredits, getCreditTotals, abonarCredito, eliminarCredito } from '../services/creditsService';
import { auth } from '../../../services/firebaseConfig';
import { useSubmitLock } from '../../../hooks/useSubmitLock';
import { formatCurrency } from '../../../utils/formatMoney';

const parseAmount = (value) => {
  const normalized = (value || '').toString().replace(',', '.').trim();
  const num = Number(normalized);
  return Number.isFinite(num) ? num : NaN;
};

const resolvePaymentActor = (user) => {
  const email = typeof user?.email === 'string' ? user.email.trim() : '';
  if (email) return email;

  const username = typeof user?.user === 'string' ? user.user.trim() : '';
  if (username) return username;

  const current = auth()?.currentUser;
  return current?.email || current?.displayName || null;
};

export const useCredits = (user, role, initialFilter = 'pending') => {
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedCredit, setSelectedCredit] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [filter, setFilter] = useState(initialFilter);
  // Rango de fechas: va al query, no se filtra en cliente (ver fetchCredits).
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  // El botón "Reintentar" hacía `setFilter(filter)`: mismo valor, sin re-render,
  // sin resuscripción. `reloadKey` sí fuerza volver a montar el listener.
  const [reloadKey, setReloadKey] = useState(0);
  // Cerrojo por ref: `submittingPayment` era estado, y dos toques rápidos leían
  // ambos `false` antes del re-render → se registraba el abono DOS veces.
  const { submitting: submittingPayment, runLocked } = useSubmitLock();
  const animValue = useRef(new Animated.Value(0)).current;

  const [totals, setTotals] = useState({ paid: 0, pending: 0 });

  // El status va al query: antes se traía la colección `credits` entera y se
  // filtraba en JS. Cambiar de pestaña ahora resuscribe con el filtro aplicado.
  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    const status = filter === 'pending' || filter === 'paid' ? filter : null;
    const unsub = fetchCredits(
      (data) => {
        setCredits(data);
        setLoadError(null);
        setLoading(false);
      },
      { status, from: dateFrom, to: dateTo },
      // Un query fallido (índice en construcción, permisos) debe cortar la carga
      // y mostrar el motivo; antes dejaba la pantalla girando indefinidamente.
      (error) => {
        setCredits([]);
        setLoadError(error);
        setLoading(false);
      },
    );
    return unsub;
  }, [filter, dateFrom, dateTo, reloadKey]);

  // Los totales se suman en el servidor sobre TODA la colección: la lista está
  // acotada, así que calcularlos sobre `credits` daría montos incompletos.
  // `refreshTotals` se vuelve a llamar tras cada abono o eliminación.
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Los totales siguen el mismo rango de fechas que la lista: si no, el encabezado
  // mostraría el saldo de toda la cartera bajo una vista filtrada a una semana.
  const refreshTotals = useCallback(async () => {
    const next = await getCreditTotals({ from: dateFrom, to: dateTo });
    // getCreditTotals es asíncrono y la pantalla puede cerrarse antes de que resuelva.
    if (mountedRef.current) setTotals(next);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    refreshTotals();
  }, [refreshTotals, reloadKey]);

  // La lista ya viene filtrada del servidor.
  const filteredCredits = credits;

  const setDateRange = useCallback((from, to) => {
    setDateFrom(from || null);
    setDateTo(to || null);
  }, []);

  const clearFilters = useCallback(() => {
    setDateFrom(null);
    setDateTo(null);
    setFilter('pending');
  }, []);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const openModal = (credit) => {
    setSelectedCredit(credit);
    setPaymentAmount('');
    setModalVisible(true);
    setTimeout(() => {
      Animated.timing(animValue, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    }, 250);
  };

  const closeModal = () => {
    Animated.timing(animValue, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setModalVisible(false);
      setSelectedCredit(null);
      setPaymentAmount('');
    });
  };

  const handleAbono = async () => {
    if (!selectedCredit) {
      Alert.alert('Error', 'No hay crédito seleccionado.');
      return;
    }

    const amount = parseAmount(paymentAmount);

    if (!amount || amount <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto válido para abonar.');
      return;
    }

    const creditId = selectedCredit.id;

    return runLocked(async () => {
      try {
        const paymentActor = resolvePaymentActor(user);
        const res = await abonarCredito(creditId, amount, paymentActor);

        setCredits((prev) =>
          prev.map((c) =>
            c.id === creditId
              ? {
                  ...c,
                  paid: res.nuevoPagado,
                  pending: res.nuevoPendiente,
                  status: res.estado,
                }
              : c
          )
        );

        // El abono cambió `paid`/`pending`: los totales son de servidor, hay que releerlos.
        refreshTotals();

        const changeMsg = res.change > 0
          ? `\nCambio a devolver: ${formatCurrency(res.change)}`
          : '';
        // El enlace con la preventa se actualiza aparte y puede fallar. Antes solo
        // se registraba en consola: la pantalla decía "saldado" mientras la venta
        // seguía figurando como crédito por cobrar, sin que nadie se enterara.
        const linkMsg = res.linkedPreSaleUpdated === false
          ? '\n\n⚠ El crédito quedó saldado, pero la pre-venta enlazada no pudo actualizarse. Revísala manualmente.'
          : '';
        Alert.alert(
          'Abono registrado',
          (res.estado === 'paid'
            ? 'Crédito saldado completamente.'
            : 'Pago parcial aplicado correctamente.') + changeMsg + linkMsg
        );

        closeModal();
      } catch (e) {
        console.log('Error al registrar abono:', e);
        Alert.alert('Error', e?.message || 'No se pudo registrar el abono.');
        throw e;
      }
    }).catch(() => {});
  };

  const handleDelete = async (id) => {
    if (role !== 'admin') return Alert.alert('No autorizado');
    Alert.alert('Eliminar crédito', '¿Deseas eliminar este crédito?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        // eliminarCredito ahora rechaza si el crédito tiene abonos o si la orden
        // ya salió de bodega: sin este catch el error quedaba sin manejar y la
        // pantalla no decía nada.
        onPress: async () => {
          try {
            await eliminarCredito(id);
            refreshTotals();
          } catch (e) {
            Alert.alert('No se pudo eliminar', e?.message || 'Intenta de nuevo.');
          }
        },
      },
    ]);
  };

  return {
    credits,
    loading,
    loadError,
    filter,
    setFilter,
    dateFrom,
    dateTo,
    setDateRange,
    clearFilters,
    reload,
    filteredCredits,
    totals,
    // Contadores por estado: vienen del servidor, no de `credits` (esa lista ya
    // está filtrada por estado y el estado inactivo siempre daría 0).
    counts: { pending: totals.countPending, paid: totals.countPaid },
    selectedCredit,
    paymentAmount,
    setPaymentAmount,
    modalVisible,
    openModal,
    closeModal,
    animValue,
    handleAbono,
    handleDelete,
    submittingPayment,
  };
};
