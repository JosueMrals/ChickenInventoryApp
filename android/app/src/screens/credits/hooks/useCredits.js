import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated } from 'react-native';
import { fetchCredits, getCreditTotals, abonarCredito, eliminarCredito } from '../services/creditsService';
import { auth } from '../../../services/firebaseConfig';
import { useSubmitLock } from '../../../hooks/useSubmitLock';

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
      { status },
      // Un query fallido (índice en construcción, permisos) debe cortar la carga
      // y mostrar el motivo; antes dejaba la pantalla girando indefinidamente.
      (error) => {
        setCredits([]);
        setLoadError(error);
        setLoading(false);
      },
    );
    return unsub;
  }, [filter]);

  // Los totales se suman en el servidor sobre TODA la colección: la lista está
  // acotada, así que calcularlos sobre `credits` daría montos incompletos.
  // `refreshTotals` se vuelve a llamar tras cada abono o eliminación.
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const refreshTotals = useCallback(async () => {
    const next = await getCreditTotals();
    // getCreditTotals es asíncrono y la pantalla puede cerrarse antes de que resuelva.
    if (mountedRef.current) setTotals(next);
  }, []);

  useEffect(() => {
    refreshTotals();
  }, [refreshTotals]);

  // La lista ya viene filtrada del servidor.
  const filteredCredits = credits;

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
          ? `\nCambio a devolver: C$${res.change.toFixed(2)}`
          : '';
        Alert.alert(
          'Abono registrado',
          (res.estado === 'paid'
            ? 'Crédito saldado completamente.'
            : 'Pago parcial aplicado correctamente.') + changeMsg
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
        onPress: async () => {
          await eliminarCredito(id);
          refreshTotals();
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
    filteredCredits,
    totals,
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
