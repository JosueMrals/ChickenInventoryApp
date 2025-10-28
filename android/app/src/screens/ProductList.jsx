import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { getUserRole } from '../services/auth';
import auth from '@react-native-firebase/auth';

export default function ProductList({ role: initialRole }) {
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [role, setRole] = useState(initialRole || '');
  const [animValue] = useState(new Animated.Value(0));
  const user = auth().currentUser;

  const [form, setForm] = useState({
    name: '',
    price: '',
    stock: '',
  });

  useEffect(() => {
    if (!role) fetchUserRole();

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
  }, []);

  const fetchUserRole = async () => {
    if (!user) return;
    const r = await getUserRole(user.uid);
    setRole(r);
  };

  // 🔍 Búsqueda
  useEffect(() => {
    let data = [...products];
    if (search.trim()) {
      data = data.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    switch (filter) {
      case 'lowStock':
        data = data.filter(p => (p.stock || 0) < 5);
        break;
      case 'priceAsc':
        data = data.sort((a, b) => a.price - b.price);
        break;
      case 'priceDesc':
        data = data.sort((a, b) => b.price - a.price);
        break;
      default:
        break;
    }
    setFiltered(data);
  }, [search, filter, products]);

  const animateModal = () => {
    Animated.timing(animValue, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price.trim()) {
      Alert.alert('Campos obligatorios', 'Nombre y precio son requeridos.');
      return;
    }

    try {
      if (currentProduct) {
        await firestore().collection('products').doc(currentProduct.id).update({
          ...form,
          price: parseFloat(form.price),
          stock: parseInt(form.stock) || 0,
          updatedAt: new Date(),
        });
      } else {
        await firestore().collection('products').add({
          ...form,
          price: parseFloat(form.price),
          stock: parseInt(form.stock) || 0,
          createdAt: new Date(),
        });
      }
      setModalVisible(false);
      setForm({ name: '', price: '', stock: '' });
      setCurrentProduct(null);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', e.message);
    }
  };

  const handleDelete = async (id) => {
    Alert.alert('Eliminar producto', '¿Deseas eliminar este producto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await firestore().collection('products').doc(id).delete();
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const openEdit = (product) => {
    setCurrentProduct(product);
    setForm({
      name: product.name,
      price: product.price.toString(),
      stock: product.stock?.toString() || '',
    });
    setModalVisible(true);
    animateModal();
  };

  const renderItem = ({ item }) => (
    <Animated.View
      style={{
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 14,
        marginVertical: 6,
        marginHorizontal: 10,
        elevation: 2,
        transform: [
          {
            scale: animValue.interpolate({
              inputRange: [0, 1],
              outputRange: [0.98, 1],
            }),
          },
        ],
      }}
    >
      <TouchableOpacity
        onPress={() => role === 'admin' && openEdit(item)}
        disabled={role !== 'admin'}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 18, fontWeight: '600' }}>{item.name}</Text>
          <Text style={{ fontSize: 16, color: '#007AFF' }}>
            ${item.price.toFixed(2)}
          </Text>
        </View>
        <Text style={{ color: '#666', marginTop: 4 }}>
          Stock: {item.stock || 0}
        </Text>

        {role === 'admin' && (
          <TouchableOpacity
            onPress={() => handleDelete(item.id)}
            style={{ marginTop: 8, alignSelf: 'flex-end' }}
          >
            <Text style={{ color: '#FF3B30', fontWeight: '600' }}>Eliminar</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading) {
    return (
      <View style={{flex:1,justifyContent:'center',alignItems:'center'}}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F6FA' }}>
      {/* Encabezado */}
      <View
        style={{
          padding: 16,
          backgroundColor: '#007AFF',
          borderBottomLeftRadius: 14,
          borderBottomRightRadius: 14,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>
          Inventario
        </Text>

        {/* 🔍 Búsqueda */}
        <TextInput
          placeholder="Buscar producto..."
          placeholderTextColor="#eee"
          value={search}
          onChangeText={setSearch}
          style={{
            marginTop: 12,
            backgroundColor: '#fff',
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 8,
            fontSize: 16,
          }}
        />
      </View>

      {/* Filtros */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-around',
          marginVertical: 10,
        }}
      >
        {[
          { label: 'Todos', value: 'all' },
          { label: 'Stock bajo', value: 'lowStock' },
          { label: '▲ Precio ↑', value: 'priceAsc' },
          { label: '▼ Precio ↓', value: 'priceDesc' },
        ].map(f => (
          <TouchableOpacity
            key={f.value}
            onPress={() => setFilter(f.value)}
            style={{
              backgroundColor: filter === f.value ? '#007AFF' : '#E0E0E0',
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 8,
            }}
          >
            <Text
              style={{
                color: filter === f.value ? '#fff' : '#333',
                fontWeight: '600',
              }}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista */}
      {filtered.length === 0 ? (
        <View style={{flex:1,justifyContent:'center',alignItems:'center'}}>
          <Text style={{color:'#aaa'}}>No hay productos</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 10 }}
        />
      )}

      {/* Botón agregar */}
      {role === 'admin' && (
        <TouchableOpacity
          onPress={() => {
            setModalVisible(true);
            setCurrentProduct(null);
            setForm({ name: '', price: '', stock: '' });
            animateModal();
          }}
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

      {/* Modal Crear/Editar */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: 20,
          }}
        >
          <Animated.View
            style={{
              backgroundColor: '#fff',
              borderRadius: 12,
              padding: 20,
              transform: [
                {
                  scale: animValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                },
              ],
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12 }}>
              {currentProduct ? 'Editar producto' : 'Nuevo producto'}
            </Text>

            <TextInput
              placeholder="Nombre"
              value={form.name}
              onChangeText={t => setForm({ ...form, name: t })}
              style={inputStyle}
            />
            <TextInput
              placeholder="Precio"
              keyboardType="numeric"
              value={form.price}
              onChangeText={t => setForm({ ...form, price: t })}
              style={inputStyle}
            />
            <TextInput
              placeholder="Stock"
              keyboardType="numeric"
              value={form.stock}
              onChangeText={t => setForm({ ...form, stock: t })}
              style={inputStyle}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity onPress={handleSave} style={btnPrimary}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Guardar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  setForm({ name: '', price: '', stock: '' });
                  setCurrentProduct(null);
                }}
                style={btnCancel}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: '#ddd',
  borderRadius: 8,
  padding: 12,
  marginBottom: 8,
};

const btnPrimary = {
  backgroundColor: '#007AFF',
  padding: 12,
  borderRadius: 8,
  flex: 1,
  alignItems: 'center',
  marginRight: 6,
};

const btnCancel = {
  backgroundColor: '#FF3B30',
  padding: 12,
  borderRadius: 8,
  flex: 1,
  alignItems: 'center',
  marginLeft: 6,
};
