import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import firebaseService from '../services/firebaseService';
import firestore from '@react-native-firebase/firestore';


export default function EditProductScreen({ route, navigation }) {
    const { productId } = route.params;
    const [product, setProduct] = useState(null);
    useEffect(() => {
    const sub = firestore().collection('products').doc(productId).onSnapshot(doc => {
    setProduct({ id: doc.id, ...doc.data() });
    });
    return () => sub();
    }, [productId]);


    const onSave = async () => {
    try {
    // validate duplicates: name and barcode
    const existsName = await firebaseService.getProductByName(product.name);
    if (existsName && existsName.id !== productId) return Alert.alert('Nombre duplicado');
    if (product.barcode) {
    const existsBarcode = await firebaseService.getProductByBarcode(product.barcode);
    if (existsBarcode && existsBarcode.id !== productId) return Alert.alert('Código de barras duplicado');
    }
    await firebaseService.updateProduct(productId, product);
    Alert.alert('Guardado');
    navigation.goBack();
    } catch (err) { Alert.alert('Error', err.message); }
    };


    if (!product) return <Text>Cargando...</Text>;


    return (
    <View style={{ flex: 1, padding: 16 }}>
    <Text>Nombre</Text>
    <TextInput value={product.name} onChangeText={(t) => setProduct({ ...product, name: t })} style={styles.input} />


    <Text>Codigo</Text>
    <TextInput value={product.barcode} onChangeText={(t) => setProduct({ ...product, barcode: t })} style={styles.input} />


    <Text>Descripcion</Text>
    <TextInput value={product.descipction} onChangeText={(t) => setProduct({ ...product, descipction: t })} style={styles.input} />


    {/* Agregar otros campos editables si es necesario */}


    <View style={{ flexDirection: 'row', marginTop: 12 }}>
    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.buttonAlt}><Text>Cancelar</Text></TouchableOpacity>
    <TouchableOpacity onPress={onSave} style={styles.buttonPrimary}><Text style={{ color: '#fff' }}>Guardar</Text></TouchableOpacity>
    </View>
    </View>
    );
}


const styles = StyleSheet.create({
    input: { borderWidth: 1,
        borderColor: '#ddd',
        padding: 10,
        borderRadius: 8,
        marginBottom: 12
    },
    buttonPrimary: {
        marginLeft: 12,
        padding: 12,
        backgroundColor: '#2a9d8f',
        borderRadius: 8
    },
    buttonAlt: {
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#f5f5f5'
    },
});