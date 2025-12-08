import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, Text, Alert, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { db } from '../../../services/firebase'; 
import firestore from '@react-native-firebase/firestore';

export default function AddStockScreen({ route, navigation }) {
  const { productId } = route.params;
  const [amount, setAmount] = useState('');
  const [product, setProduct] = useState(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [saving, setSaving] = useState(false);
  const [operation, setOperation] = useState('add'); // 'add' | 'remove'

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingProduct(true);
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

  async function handleUpdateStock() {
    const qty = parseAmount(amount);
    if (Number.isNaN(qty) || qty <= 0) {
      Alert.alert('Cantidad inválida', 'Ingresa una cantidad numérica mayor que cero.');
      return;
    }

    const isAdding = operation === 'add';
    const currentStock = product?.stock ?? 0;

    // Validación para disminuir stock
    if (!isAdding && qty > currentStock) {
      Alert.alert('Stock insuficiente', `No puedes retirar ${qty} unidades. Stock actual: ${currentStock}.`);
      return;
    }

    const actionText = isAdding ? 'Agregar' : 'Disminuir';
    const confirmMessage = isAdding 
      ? `¿Agregar ${qty} a "${product?.name}"?` 
      : `¿Disminuir ${qty} de "${product?.name}"?`;

    Alert.alert(
      'Confirmar',
      confirmMessage,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: actionText,
          style: isAdding ? 'default' : 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const docRef = db.doc(`products/${productId}`);
              const incrementValue = isAdding ? qty : -qty;
              
              await docRef.update({
                stock: firestore.FieldValue.increment(incrementValue),
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
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>Cargando producto...</Text>
      </View>
    );
  }

  const isAdding = operation === 'add';

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Producto:</Text>
      <Text style={styles.productName}>{product?.name ?? '—'}</Text>

      <Text style={styles.label}>Stock actual: {product?.stock ?? 0}</Text>

      <View style={styles.toggleContainer}>
        <TouchableOpacity 
          style={[styles.toggleBtn, isAdding && styles.toggleBtnActiveAdd]} 
          onPress={() => setOperation('add')}
        >
          <Text style={[styles.toggleText, isAdding && styles.toggleTextActive]}>Agregar (+)</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.toggleBtn, !isAdding && styles.toggleBtnActiveRemove]} 
          onPress={() => setOperation('remove')}
        >
          <Text style={[styles.toggleText, !isAdding && styles.toggleTextActive]}>Disminuir (-)</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
        placeholder={isAdding ? "Cantidad a agregar" : "Cantidad a disminuir"}
        editable={!saving}
        style={styles.input}
      />

      {saving ? (
        <ActivityIndicator />
      ) : (
        <>
          <Button 
            title={isAdding ? "Confirmar Ingreso" : "Confirmar Salida"} 
            onPress={handleUpdateStock} 
            disabled={!amount}
            color={isAdding ? "#2196F3" : "#F44336"} 
          />
          <View style={{ height: 16 }} />
          <Button title="Cancelar" onPress={() => navigation.goBack()} color="#888" />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, color: '#666', marginBottom: 4 },
  productName: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    fontSize: 16
  },
  toggleContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#f9f9f9'
  },
  toggleBtnActiveAdd: {
    backgroundColor: '#E3F2FD'
  },
  toggleBtnActiveRemove: {
    backgroundColor: '#FFEBEE'
  },
  toggleText: {
    fontWeight: '600',
    color: '#999'
  },
  toggleTextActive: {
    color: '#333'
  }
});
