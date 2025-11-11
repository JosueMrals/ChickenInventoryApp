import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Animated,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import styles from '../styles/CreditsStyles';
import { fetchCredits, abonarCredito, eliminarCredito } from '../services/creditsService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CreditsScreen({ route }) {
  const { user, role } = route.params;
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCredit, setSelectedCredit] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [filter, setFilter] = useState('all');
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
    });
  };

  const handleAbono = async () => {
    if (!selectedCredit) {
      Alert.alert('Error', 'No hay crédito seleccionado.');
      return;
    }

    const amount = parseFloat(paymentAmount);
    const pending = parseFloat(selectedCredit.pending || 0);

    // 🚫 Validaciones front-end
    if (!amount || amount <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto válido para abonar.');
      return;
    }
    if (amount > pending) {
      Alert.alert(
        'Monto excedido',
        `El abono no puede ser mayor al saldo pendiente ($${pending.toFixed(2)}).`
      );
      return;
    }

    console.log('💵 Abonando crédito:', selectedCredit.id, 'Monto:', amount);

    try {
      const res = await abonarCredito(
        selectedCredit.id,
        selectedCredit.paid,
        selectedCredit.pending,
        amount,
        user.email
      );

      // ✅ Actualizar vista local
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
        '✅ Abono registrado',
        res.estado === 'paid'
          ? 'Crédito saldado completamente.'
          : 'Pago parcial aplicado.'
      );

      closeModal();
    } catch (e) {
      console.log('🔥 Error al registrar abono:', e);
      Alert.alert('Error', e.message);
    }
  };


  const handleDelete = async (id) => {
    if (role !== 'admin') return Alert.alert('No autorizado');
    Alert.alert('Eliminar crédito', '¿Deseas eliminar este crédito?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => await eliminarCredito(id) },
    ]);
  };

  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Créditos</Text>
        <Text style={{ color: '#fff', fontSize: 14, marginTop: 4 }}>
          Pagados: C${totals.paid.toFixed(2)} | Pendientes: ${totals.pending.toFixed(2)}
        </Text>
      </View>

      {/* Filtros */}
      <View style={styles.filters}>
        {['all', 'pending', 'paid'].map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[
              styles.filterBtn,
              { backgroundColor: filter === f ? '#007AFF' : '#E0E0E0' },
            ]}
          >
            <Text style={{ color: filter === f ? '#fff' : '#333', fontWeight: '600' }}>
              {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendientes' : 'Pagados'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista */}
      <FlatList
        data={filteredCredits}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={{ fontWeight: '700', fontSize: 16 }}>{item.clientName || 'Cliente'}</Text>
              <Text style={{ color: item.status === 'paid' ? 'green' : 'red', fontWeight: '600' }}>
                {item.status === 'paid' ? 'Pagado' : 'Pendiente'}
              </Text>
            </View>

            <Text>Total: ${item.total.toFixed(2)}</Text>
            <Text style={{ color: '#007AFF' }}>Pagado: C${item.paid.toFixed(2)}</Text>
            <Text style={{ color: '#FF3B30' }}>Pendiente: C${item.pending.toFixed(2)}</Text>

            {/* Historial de abonos */}
            {item.payments?.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text style={{ fontWeight: '700', marginBottom: 4 }}>Historial de abonos:</Text>
                {item.payments.map((p, idx) => (
                  <View key={idx} style={styles.paymentItem}>
                    <Text style={{ fontSize: 13 }}>
                      {new Date(p.date.seconds * 1000).toLocaleDateString()} — ${p.amount.toFixed(2)}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#666' }}>Por: {p.by}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
              {item.status === 'pending' && (
                <TouchableOpacity
                  onPress={() => openModal(item)}
                  style={[styles.btn, styles.btnPrimary]}
                >
                  <Text style={styles.btnText}>Abonar</Text>
                </TouchableOpacity>
              )}
              {role === 'admin' && (
                <TouchableOpacity
                  onPress={() => handleDelete(item.id)}
                  style={[styles.btn, styles.btnDanger]}
                >
                  <Text style={styles.btnText}>Eliminar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />

      {/* Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          {!selectedCredit ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <Animated.View style={[styles.modalContent, { transform: [{ scale: animValue }] }]}>
              <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 10 }}>Registrar Abono</Text>
              <Text style={{ color: '#007AFF', marginBottom: 8 }}>
                Pendiente: C${selectedCredit?.pending?.toFixed(2)}
              </Text>

              <TextInput
                placeholder="Monto a abonar"
                keyboardType="numeric"
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                style={styles.input}
              />

              <View style={styles.rowButtons}>
                <TouchableOpacity onPress={handleAbono} style={[styles.btn, styles.btnPrimary]}>
                  <Text style={styles.btnText}>Confirmar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={closeModal} style={[styles.btn, styles.btnDanger]}>
                  <Text style={styles.btnText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </View>
      </Modal>
    </View>
  );
}
