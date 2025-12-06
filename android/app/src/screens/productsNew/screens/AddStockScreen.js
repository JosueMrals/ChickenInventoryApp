import React, { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity, Alert } from 'react-native';
import firebaseService from '../services/firebaseService';

export default function AddStockScreen({ route, navigation }) {
    const { productId } = route.params;
    const [qty, setQty] = useState('');


    const onAdd = async () => {
        const q = parseInt(qty, 10);
        if (isNaN(q) || q <= 0) return Alert.alert('Cantidad inválida');
        try {
            await firebaseService.addStock(productId, q);
            Alert.alert('Stock agregado');
            navigation.goBack();
        } catch (err) { Alert.alert('Error', err.message); }
    };


    return (
        <View style={{ flex: 1, padding: 16 }}>
            <Text>Cantidad a agregar</Text>
            <TextInput keyboardType="numeric" value={qty} onChangeText={setQty} style={{ borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 8 }} />
            <View style={{ flexDirection: 'row', marginTop: 12 }}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 12, backgroundColor: '#f5f5f5', borderRadius: 8 }}><Text>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity onPress={onAdd} style={{ marginLeft: 12, padding: 12, backgroundColor: '#2a9d8f', borderRadius: 8 }}><Text style={{ color: '#fff' }}>Agregar</Text></TouchableOpacity>
            </View>
        </View>
    );
}