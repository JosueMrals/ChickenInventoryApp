// AddStockScreen.jsx
import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, Text, Alert, ActivityIndicator } from 'react-native';
import { db } from '../../../services/firebase'; // tu archivo firebase.js que exporta db
import firestore from '@react-native-firebase/firestore';

export default function AddStockScreen({ route, navigation }) {
  const { productId } = route.params;
  const [amount, setAmount] = useState('');
  const [product, setProduct] = useState(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingProduct(true);
        // obtiene el documento nativo: db.doc('products/{id}')
        const docRef = db.doc(`products/${productId}`);
        const snap = await docRef.get();
        if (mounted) {
          if (snap.exists) setProduct({ id: snap.id, ...snap.data() });
          else {
            Alert.alert('No encontrado', 'El producto solicitado no existe.');
            navigation.goBack();
          }
        }
      } catch (err) {
        console.error('Error cargando producto:', err);
        Alert.alert('Error', 'No se pudo cargar el producto. Revisa la conexión.');
        navigation.goBack();
      } finally {
        if (mounted) setLoadingProduct(false);
      }
    })();
    return () => { mounted = false; };
  }, [productId, navigation]);

  function parseAmount(value) {
    const v = value?.toString().trim();
    if (!v) return NaN;
    const num = Number(v);
    return Number.isFinite(num) ? num : NaN;
  }

  async function handleAdd() {
    const qty = parseAmount(amount);
    if (Number.isNaN(qty) || qty <= 0) {
      Alert.alert('Cantidad inválida', 'Ingresa una cantidad numérica mayor que cero.');
      return;
    }

    Alert.alert(
      'Confirmar',
      `Agregar ${qty} a "${product?.name}" (stock actual: ${product?.stock ?? 0})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Agregar',
          onPress: async () => {
            setSaving(true);
            try {
              const docRef = db.doc(`products/${productId}`);
              await docRef.update({
                stock: firestore.FieldValue.increment(qty), // incremento atómico
                updatedAt: firestore.FieldValue.serverTimestamp()
              });
              navigation.goBack();
            } catch (err) {
              console.error('Error actualizando stock:', err);
              Alert.alert('Error', 'No se pudo actualizar el stock. Intenta nuevamente.');
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  }

  if (loadingProduct) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
        <Text>Cargando producto...</Text>
      </View>
    );
  }

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ marginBottom: 8, fontWeight: '600' }}>Producto:</Text>
      <Text style={{ marginBottom: 12 }}>{product?.name ?? '—'}</Text>

      <Text style={{ marginBottom: 8 }}>Stock actual: {product?.stock ?? 0}</Text>

      <TextInput
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
        placeholder="Cantidad a añadir"
        editable={!saving}
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 10,
          borderRadius: 6,
          marginBottom: 12
        }}
      />

      {saving ? (
        <ActivityIndicator />
      ) : (
        <>
          <Button title="Agregar" onPress={handleAdd} disabled={!amount} />
          <View style={{ height: 8 }} />
          <Button title="Cancelar" onPress={() => navigation.goBack()} color="#888" />
        </>
      )}
    </View>
  );
}
