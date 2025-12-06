import React, { useState, useEffect } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import firebaseService from '../services/firebaseService';


export default function AddProductStep1({ navigation, route }) {
const [name, setName] = useState('');
const [barcode, setBarcode] = useState('');
const [descipction, setDescipction] = useState('');


useEffect(() => {
const unsubscribe = navigation.addListener('beforeRemove', (e) => {
// limpiar al salir
setName(''); setBarcode(''); setDescipction('');
});
return unsubscribe;
}, [navigation]);


const onNext = async () => {
if (!name.trim()) return Alert.alert('Nombre requerido');
// validar duplicados
const exists = await firebaseService.getProductByName(name.trim());
if (exists) return Alert.alert('Ya existe un producto con ese nombre');


// si barcode no vacío validar
if (barcode.trim()) {
const existsBar = await firebaseService.getProductByBarcode(barcode.trim());
if (existsBar) return Alert.alert('Ya existe un producto con ese código de barras');
}


navigation.navigate('AddProductStep2', { name: name.trim(), barcode: barcode.trim(), descipction: descipction.trim() });
};


return (
<View style={styles.container}>
<Text>Nombre</Text>
<TextInput value={name} onChangeText={setName} style={styles.input} />


<Text>Código de barras</Text>
<View style={{ flexDirection: 'row', alignItems: 'center' }}>
<TextInput value={barcode} onChangeText={setBarcode} style={[styles.input, { flex: 1 }]} />
<TouchableOpacity style={styles.scanBtn} onPress={() => {
// placeholder: abrir lector
navigation.navigate('BarcodeScanner', { from: 'AddProductStep1' });
}}>
<Text>📷</Text>
</TouchableOpacity>
</View>


<Text>Descripción</Text>
<TextInput value={descipction} onChangeText={setDescipction} style={styles.input} />


<View style={{ flexDirection: 'row', marginTop: 20 }}>
<TouchableOpacity onPress={() => { setName(''); setBarcode(''); setDescipction(''); navigation.goBack(); }} style={styles.buttonAlt}>
<Text>Cancelar</Text>
</TouchableOpacity>
<TouchableOpacity onPress={onNext} style={styles.buttonPrimary}>
<Text style={{ color: '#fff' }}>Siguiente</Text>
</TouchableOpacity>
</View>
</View>
);
}


const styles = StyleSheet.create({
container: { flex: 1, padding: 16 },
input: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 8, marginBottom: 12 },
scanBtn: { marginLeft: 8, padding: 12, borderRadius: 8, backgroundColor: '#eee' },
buttonPrimary: { marginLeft: 12, padding: 12, backgroundColor: '#2a9d8f', borderRadius: 8 },
buttonAlt: { padding: 12, borderRadius: 8, backgroundColor: '#f5f5f5' },
});