import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
import firestore from '@react-native-firebase/firestore';

export default function ProductForm({ route, navigation }) {
  const { product, role } = route.params || {};
  const isEdit = !!product;

  const [form, setForm] = useState({
    name: product?.name || '',
    price: product?.price?.toString() || '',
    stock: product?.stock?.toString() || '',
  });

  useEffect(() => {
    navigation.setOptions({
      title: isEdit ? 'Editar producto' : 'Nuevo producto',
    });
  }, [isEdit]);

  const handleSave = async () => {
    if (role !== 'admin') {
      Alert.alert('Permiso denegado', 'Solo los administradores pueden modificar productos.');
      return;
    }

    if (!form.name.trim() || !form.price.trim()) {
      Alert.alert('Campos requeridos', 'Nombre y precio son obligatorios.');
      return;
    }

    try {
      if (isEdit) {
        await firestore().collection('products').doc(product.id).update({
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
      Alert.alert('Éxito', isEdit ? 'Producto actualizado' : 'Producto creado');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6FA', padding: 20 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', marginBottom: 20 }}>
        {isEdit ? 'Editar producto' : 'Nuevo producto'}
      </Text>

      <TextInput
        placeholder="Nombre del producto"
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

      <View style={{ flexDirection: 'row', marginTop: 20 }}>
        <TouchableOpacity onPress={handleSave} style={btnPrimary}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>Guardar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={btnCancel}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const inputStyle = {
  backgroundColor: '#fff',
  borderWidth: 1,
  borderColor: '#ddd',
  borderRadius: 8,
  padding: 12,
  marginBottom: 12,
};

const btnPrimary = {
  flex: 1,
  backgroundColor: '#007AFF',
  padding: 14,
  borderRadius: 8,
  alignItems: 'center',
  marginRight: 6,
};

const btnCancel = {
  flex: 1,
  backgroundColor: '#FF3B30',
  padding: 14,
  borderRadius: 8,
  alignItems: 'center',
  marginLeft: 6,
};
