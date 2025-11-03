import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  Animated,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { firestore } from '../services/firebaseConfig';
import { getUserRole } from '../services/auth';
import { useNavigation } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';

export default function ProductList({ role: propRole, user: propUser }) {
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [role, setRole] = useState(propRole || '');
  const [user, setUser] = useState(propUser || auth().currentUser);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [form, setForm] = useState({ name: '', price: '', stock: '' });
  const animValue = useRef(new Animated.Value(0)).current;

  const navigation = useNavigation();

  // 🔹 Cargar productos + rol
  useEffect(() => {
    if (!role && user) {
      getUserRole(user.uid).then(r => setRole(r));
    }

    const unsubscribe = firestore()
      .collection('products')
      .orderBy('name', 'asc')
      .onSnapshot(snapshot => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProducts(data);
        setFiltered(data);
        setLoading(false);
      });

    return () => unsubscribe();
  }, [user]);

  // 🔍 Filtros y búsqueda
  useEffect(() => {
    let data = [...products];
    if (search.trim()) {
      data = data.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (filter === 'lowStock') data = data.filter(p => (p.stock || 0) < 5);
    if (filter === 'priceAsc') data = data.sort((a, b) => a.price - b.price);
    if (filter === 'priceDesc') data = data.sort((a, b) => b.price - a.price);
    setFiltered(data);
  }, [search, filter, products]);

  // 🧩 Animación modal
  const showModal = () => {
    setModalVisible(true);
    Animated.timing(animValue, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const hideModal = () => {
    Animated.timing(animValue, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
      setCurrentProduct(null);
      setForm({ name: '', price: '', stock: '' });
    });
  };

  // 🧠 Guardar producto
  const handleSave = async () => {
    if (role !== 'admin') {
      Alert.alert('Permiso denegado', 'Solo los administradores pueden guardar productos.');
      return;
    }

    if (!form.name.trim() || !form.price.trim()) {
      Alert.alert('Campos requeridos', 'Nombre y precio son obligatorios.');
      return;
    }

    try {
      if (currentProduct) {
        await firestore().collection('products').doc(currentProduct.id).update({
          name: form.name,
          price: parseFloat(form.price),
          stock: parseInt(form.stock) || 0,
          updatedAt: new Date(),
        });
      } else {
        await firestore().collection('products').add({
          name: form.name,
          price: parseFloat(form.price),
          stock: parseInt(form.stock) || 0,
          createdAt: new Date(),
        });
      }

      hideModal();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const openEdit = (product) => {
    if (role !== 'admin') return;
    setCurrentProduct(product);
    setForm({
      name: product.name,
      price: product.price.toString(),
      stock: product.stock?.toString() || '',
    });
    showModal();
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => openEdit(item)}
      activeOpacity={0.8}
      style={{
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 14,
        marginVertical: 6,
        marginHorizontal: 10,
        elevation: 2,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 18, fontWeight: '600' }}>{item.name}</Text>
        <Text style={{ fontSize: 16, color: '#007AFF' }}>
          ${item.price.toFixed(2)}
        </Text>
      </View>
      <Text style={{ color: '#666', marginTop: 4 }}>Stock: {item.stock || 0}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={{flex:1,justifyContent:'center',alignItems:'center'}}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6FA' }}>
      {/* Header */}
      <View
        style={{
          padding: 16,
          backgroundColor: '#007AFF',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', paddingTop: 10 }}>Inventario</Text>
        <TouchableOpacity onPress={() => navigation.openDrawer()}>
          <Text style={{ color: '#fff', fontSize: 18 }}>☰</Text>
        </TouchableOpacity>
      </View>

      {/* Buscar */}
      <View style={{ padding: 10 }}>
        <TextInput
          placeholder="Buscar producto..."
          value={search}
          onChangeText={setSearch}
          style={{
            backgroundColor: '#fff',
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 8,
            fontSize: 16,
          }}
        />
      </View>

      {/* Lista */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* Botón agregar */}
      {role === 'admin' && (
        <TouchableOpacity
          onPress={() => showModal()}
          style={{
            position: 'absolute',
            right: 20,
            bottom: 30,
            backgroundColor: '#007AFF',
            width: 60,
            height: 60,
            borderRadius: 30,
            justifyContent: 'center',
            alignItems: 'center',
            elevation: 5,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>+</Text>
        </TouchableOpacity>
      )}

      {/* 🪟 MODAL PEQUEÑO */}
      <Modal transparent visible={modalVisible} animationType="none">
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 20,
        }}>
          <Animated.View style={{
            width: '100%',
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 20,
            elevation: 8,
            transform: [
              {
                scale: animValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }),
              },
            ],
            opacity: animValue,
          }}>
            <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12 }}>
              {currentProduct ? 'Editar producto' : 'Nuevo producto'}
            </Text>

            <TextInput
              placeholder="Nombre"
              value={form.name}
              onChangeText={(t) => setForm({ ...form, name: t })}
              style={inputStyle}
            />
            <TextInput
              placeholder="Precio"
              keyboardType="numeric"
              value={form.price}
              onChangeText={(t) => setForm({ ...form, price: t })}
              style={inputStyle}
            />
            <TextInput
              placeholder="Stock"
              keyboardType="numeric"
              value={form.stock}
              onChangeText={(t) => setForm({ ...form, stock: t })}
              style={inputStyle}
            />

            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <TouchableOpacity onPress={handleSave} style={btnPrimary}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Guardar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={hideModal} style={btnCancel}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const inputStyle = {
  backgroundColor: '#F9FAFB',
  borderWidth: 1,
  borderColor: '#ddd',
  borderRadius: 8,
  padding: 12,
  marginBottom: 8,
};

const btnPrimary = {
  flex: 1,
  backgroundColor: '#007AFF',
  padding: 12,
  borderRadius: 8,
  alignItems: 'center',
  marginRight: 5,
};

const btnCancel = {
  flex: 1,
  backgroundColor: '#FF3B30',
  padding: 12,
  borderRadius: 8,
  alignItems: 'center',
  marginLeft: 5,
};
