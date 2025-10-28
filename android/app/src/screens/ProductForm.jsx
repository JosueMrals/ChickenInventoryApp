import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ScrollView
} from 'react-native';
import { db } from '../services/firebase';

export default function ProductForm({ product, onClose }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');

  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setDescription(product.description || '');
      setPrice(product.price ? String(product.price) : '');
    } else {
      setName(''); setDescription(''); setPrice('');
    }
  }, [product]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Validación', 'Nombre es requerido'); return; }
    const payload = { name: name.trim(), description: description.trim(), price: parseFloat(price) || 0, updatedAt: new Date() };

    try {
      if (product && product.id) {
        // update
        await db.collection('products').doc(product.id).update(payload);
      } else {
        // create
        await db.collection('products').add({ ...payload, createdAt: new Date() });
      }
      onClose();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo guardar. Revisa la consola.');
    }
  };

  return (
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{padding:16}}>
        <Text style={{fontSize:20, fontWeight:'700', marginBottom:12}}>{product ? 'Editar producto' : 'Nuevo producto'}</Text>

        <Text style={{marginTop:8}}>Nombre</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Nombre del producto" style={{
          borderWidth:1, borderColor:'#e6e6e6', padding:12, borderRadius:8, marginTop:6
        }} />

        <Text style={{marginTop:12}}>Descripción</Text>
        <TextInput value={description} onChangeText={setDescription} placeholder="Descripción breve" multiline style={{
          borderWidth:1, borderColor:'#e6e6e6', padding:12, borderRadius:8, marginTop:6, minHeight:80
        }} />

        <Text style={{marginTop:12}}>Precio</Text>
        <TextInput value={price} onChangeText={setPrice} placeholder="0.00" keyboardType="numeric" style={{
          borderWidth:1, borderColor:'#e6e6e6', padding:12, borderRadius:8, marginTop:6
        }} />

        <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:24}}>
          <TouchableOpacity onPress={onClose} style={{padding:12, borderRadius:8, backgroundColor:'#f1f1f1', flex:1, marginRight:8, alignItems:'center'}}>
            <Text>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSave} style={{padding:12, borderRadius:8, backgroundColor:'#0066FF', flex:1, marginLeft:8, alignItems:'center'}}>
            <Text style={{color:'#fff', fontWeight:'600'}}>Guardar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
