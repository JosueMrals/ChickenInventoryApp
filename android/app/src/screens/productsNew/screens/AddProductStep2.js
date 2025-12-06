import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import firebaseService from '../services/firebaseService';


export default function AddProductStep2({ navigation, route }) {
const { name, barcode, descipction } = route.params || {};
const [purchasePrice, setPurchasePrice] = useState('');
const [profitMargin, setProfitMargin] = useState('30'); // default 30%
const [salePrice, setSalePrice] = useState('');
const [autoCalc, setAutoCalc] = useState(true);
const [measureType, setMeasureType] = useState('unit'); // 'unit' or 'weight'
const [wholsalePrice, setWholsalePrice] = useState('');
const [wholesaleThreshold, setWholesaleThreshold] = useState('');


useEffect(() => {
const unsubscribe = navigation.addListener('beforeRemove', (e) => {
// limpiar
setPurchasePrice(''); setProfitMargin('30'); setSalePrice('');
});
return unsubscribe;
}, [navigation]);


useEffect(() => {
if (autoCalc) {
const p = parseFloat(purchasePrice) || 0;
const m = parseFloat(profitMargin) || 0;
if (p > 0 && m < 100) {
const calculated = p / (1 - (m / 100));
setSalePrice(calculated ? calculated.toFixed(2).toString() : '');
}
}
}, [purchasePrice, profitMargin, autoCalc]);
const onSave = async () => {
if (!purchasePrice || isNaN(parseFloat(purchasePrice))) return Alert.alert('Precio de compra inválido');


// create object
const product = {
name,
barcode,
descipction,
purchasePrice: parseFloat(purchasePrice),
profitMargin: parseFloat(profitMargin),
salePrice: parseFloat(salePrice) || 0,
measureType,
wholsalePrice: parseFloat(wholsalePrice) || 0,
wholesaleThreshold: parseFloat(wholesaleThreshold) || 0,
};


try {
// double-check duplicates before saving
const existsName = await firebaseService.getProductByName(name);
if (existsName) return Alert.alert('Ya existe un producto con ese nombre');
if (barcode) {
const existsBarcode = await firebaseService.getProductByBarcode(barcode);
if (existsBarcode) return Alert.alert('Ya existe un producto con ese código de barras');
}


await firebaseService.createProduct(product);
Alert.alert('Producto creado');
navigation.popToTop();
} catch (err) {
Alert.alert('Error', err.message);
}
};


return (
<View style={{ flex: 1, padding: 16 }}>
<Text style={{ fontWeight: '700', marginBottom: 12 }}>{name}</Text>


<Text>Precio de compra</Text>
<TextInput keyboardType="numeric" value={purchasePrice} onChangeText={setPurchasePrice} style={styles.input} />


<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
<View style={{ flex: 1 }}>
<Text>% Margen</Text>
<TextInput keyboardType="numeric" value={profitMargin} onChangeText={setProfitMargin} style={styles.input} />
</View>
<TouchableOpacity style={{ marginLeft: 8 }} onPress={() => setAutoCalc(!autoCalc)}>
<Text>{autoCalc ? 'Auto' : 'Manual'}</Text>
</TouchableOpacity>
</View>


<Text>Precio de venta</Text>
<TextInput keyboardType="numeric" value={salePrice} onChangeText={setSalePrice} editable={!autoCalc} style={styles.input} />


<Text>Tipo de medida</Text>
<View style={{ flexDirection: 'row', marginBottom: 8 }}>
<TouchableOpacity onPress={() => setMeasureType('unit')} style={measureType==='unit' ? styles.chipActive : styles.chip}> <Text>Unidad</Text></TouchableOpacity>
<TouchableOpacity onPress={() => setMeasureType('weight')} style={measureType==='weight' ? styles.chipActive : styles.chip}> <Text>Peso</Text></TouchableOpacity>
</View>


<Text>Precio mayorista</Text>
<TextInput keyboardType="numeric" value={wholsalePrice} onChangeText={setWholsalePrice} style={styles.input} />


<Text>Umbral mayorista (cantidad mínima)</Text>
<TextInput keyboardType="numeric" value={wholesaleThreshold} onChangeText={setWholesaleThreshold} style={styles.input} />


<View style={{ flexDirection: 'row', marginTop: 20 }}>
<TouchableOpacity onPress={() => navigation.goBack()} style={styles.buttonAlt}><Text>Volver</Text></TouchableOpacity>
<TouchableOpacity onPress={onSave} style={styles.buttonPrimary}><Text style={{ color: '#fff' }}>Guardar</Text></TouchableOpacity>
</View>
</View>
);
}


const styles = StyleSheet.create({
input: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 8, marginBottom: 12 },
chip: { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', marginRight: 8 },
chipActive: { padding: 8, borderRadius: 8, backgroundColor: '#e0f2f1', marginRight: 8 },
buttonPrimary: { marginLeft: 12, padding: 12, backgroundColor: '#2a9d8f', borderRadius: 8 },
buttonAlt: { padding: 12, borderRadius: 8, backgroundColor: '#f5f5f5' },
});