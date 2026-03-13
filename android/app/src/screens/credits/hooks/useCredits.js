import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated } from 'react-native';
import { fetchCredits, abonarCredito, eliminarCredito } from '../services/creditsService';
import { auth } from '../../../services/firebaseConfig';

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

export const useCredits = (user, role, initialFilter = 'all') => {
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCredit, setSelectedCredit] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [filter, setFilter] = useState(initialFilter);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsub = fetchCredits((data) => {
      setCredits(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const filteredCredits = useMemo(() => {
    switch (filter) {
      case 'pending':
        return credits.filter((c) => c.status === 'pending');
      case 'paid':
        return credits.filter((c) => c.status === 'paid');
      default:
        return credits;
    }
  }, [credits, filter]);

  const totals = useMemo(() => ({
    paid: credits.filter((c) => c.status === 'paid').reduce((a, c) => a + c.total, 0),
    pending: credits.filter((c) => c.status === 'pending').reduce((a, c) => a + c.pending, 0),
  }), [credits]);

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
    if (submittingPayment) return;

    if (!selectedCredit) {
      Alert.alert('Error', 'No hay crédito seleccionado.');
      return;
    }

    const amount = parseAmount(paymentAmount);
    const pending = Number(selectedCredit.pending || 0);

    if (!amount || amount <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto válido para abonar.');
      return;
    }

    // Validación rápida en cliente; la validación final ocurre en transacción del servicio.
    if (pending > 0 && amount - pending > 0.0001) {
      Alert.alert(
        'Monto excedido',
        `El abono no puede ser mayor al saldo pendiente (C$${pending.toFixed(2)}).`
      );
      return;
    }

    try {
      setSubmittingPayment(true);
      const paymentActor = resolvePaymentActor(user);
      const res = await abonarCredito(selectedCredit.id, amount, paymentActor);

      setCredits((prev) =>
        prev.map((c) =>
          c.id === selectedCredit.id
            ? {
                ...c,
                paid: res.nuevoPagado,
                pending: res.nuevoPendiente,
                status: res.estado,
              }
            : c
        )
      );

      Alert.alert(
        'Abono registrado',
        res.estado === 'paid'
          ? 'Credito saldado completamente.'
          : 'Pago parcial aplicado correctamente.'
      );

      closeModal();
    } catch (e) {
      console.log('Error al registrar abono:', e);
      Alert.alert('Error', e?.message || 'No se pudo registrar el abono.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleDelete = async (id) => {
    if (role !== 'admin') return Alert.alert('No autorizado');
    Alert.alert('Eliminar crédito', '¿Deseas eliminar este crédito?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => await eliminarCredito(id) },
    ]);
  };

  return {
    credits,
    loading,
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
