import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  Alert,
  Linking,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fetchCustomers, createCustomer, deleteCustomer } from '../services/customersService';
import styles from '../styles/CustomersStyles';
import { useNavigation } from '@react-navigation/native';

export default function CustomersScreen({ route }) {
  const { role } = route.params;
  const navigation = useNavigation();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    cedula: '',
    address: '',
    creditLimit: '',
  });

  useEffect(() => {
    const unsub = fetchCustomers(setCustomers);
    return unsub;
  }, []);

  const filtered = customers.filter(c =>
    (c.firstName + ' ' + c.lastName + c.cedula)
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const handleDelete = async (id) => {
    if (role !== 'admin') {
      Alert.alert('No autorizado');
      return;
    }
    Alert.alert('Eliminar cliente', '¿Deseas eliminar este cliente?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => await deleteCustomer(id) },
    ]);
  };

  const callClient = (phone) => Linking.openURL(`tel:${phone}`);
  const openWhatsApp = (phone) => Linking.openURL(`https://wa.me/${phone}`);

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim()) {
      Alert.alert('Campos requeridos', 'Nombre, apellido y teléfono son obligatorios.');
      return;
    }

    try {
      const data = {
        ...form,
        creditLimit: parseFloat(form.creditLimit) || 0,
      };
      await createCustomer(data);
      Alert.alert('✅ Cliente agregado con éxito');
      setModalVisible(false);
      setForm({
        firstName: '',
        lastName: '',
        phone: '',
        cedula: '',
        address: '',
        creditLimit: '',
      });
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Clientes</Text>

      {/* 🔍 Buscar cliente */}
      <TextInput
        style={styles.search}
        placeholder="Buscar cliente..."
        value={search}
        onChangeText={setSearch}
      />

      {/* Lista de clientes */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.name}>
                {item.firstName} {item.lastName}
              </Text>
              <Text style={{ color: '#007AFF', fontWeight: '600' }}>
                Límite: C${item.creditLimit?.toFixed(2) || 0}
              </Text>
            </View>

            <Text style={styles.text}>Tel: {item.phone}</Text>
            <Text style={styles.text}>Cédula: {item.cedula}</Text>
            <Text style={styles.text}>Dirección: {item.address}</Text>

            <View style={styles.actions}>
              <TouchableOpacity onPress={() => callClient(item.phone)}>
                <Icon name="phone" size={22} color="#007AFF" />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => openWhatsApp(item.phone)}>
                <Icon name="whatsapp" size={22} color="#25D366" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('CustomerDetail', { customer: item })}
              >
                <Icon name="history" size={22} color="#555" />
              </TouchableOpacity>

              {role === 'admin' && (
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                  <Icon name="delete" size={22} color="#FF3B30" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />

      {/* ➕ Botón flotante para agregar cliente */}
      {(role === 'admin' || role === 'user') && (
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={{
            position: 'absolute',
            bottom: 30,
            right: 20,
            backgroundColor: '#007AFF',
            width: 60,
            height: 60,
            borderRadius: 30,
            justifyContent: 'center',
            alignItems: 'center',
            elevation: 6,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 30, fontWeight: '700' }}>+</Text>
        </TouchableOpacity>
      )}

      {/* 🧾 Modal para agregar cliente */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: 20,
          }}
        >
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20 }}>
            <ScrollView>
              <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 10 }}>
                Nuevo cliente
              </Text>

              <TextInput
                placeholder="Nombres"
                value={form.firstName}
                onChangeText={(t) => setForm({ ...form, firstName: t })}
                style={styles.input}
              />
              <TextInput
                placeholder="Apellidos"
                value={form.lastName}
                onChangeText={(t) => setForm({ ...form, lastName: t })}
                style={styles.input}
              />
              <TextInput
                placeholder="Teléfono"
                keyboardType="phone-pad"
                value={form.phone}
                onChangeText={(t) => setForm({ ...form, phone: t })}
                style={styles.input}
              />
              <TextInput
                placeholder="Cédula"
                value={form.cedula}
                onChangeText={(t) => setForm({ ...form, cedula: t })}
                style={styles.input}
              />
              <TextInput
                placeholder="Dirección"
                value={form.address}
                onChangeText={(t) => setForm({ ...form, address: t })}
                style={styles.input}
              />
              {role === 'admin' && (
                <TextInput
                  placeholder="Límite de crédito"
                  keyboardType="numeric"
                  value={form.creditLimit}
                  onChangeText={(t) => setForm({ ...form, creditLimit: t })}
                  style={styles.input}
                />
              )}

              <View
                style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}
              >
                <TouchableOpacity
                  onPress={handleSave}
                  style={{
                    backgroundColor: '#007AFF',
                    padding: 12,
                    borderRadius: 8,
                    flex: 1,
                    alignItems: 'center',
                    marginRight: 6,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Guardar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={{
                    backgroundColor: '#FF3B30',
                    padding: 12,
                    borderRadius: 8,
                    flex: 1,
                    alignItems: 'center',
                    marginLeft: 6,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
