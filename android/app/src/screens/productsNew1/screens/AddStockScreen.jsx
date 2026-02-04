import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, Text, Alert, ActivityIndicator, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { db } from '../../../services/firebase'; 
import firestore, { serverTimestamp, increment } from '@react-native-firebase/firestore';
import globalStyles from '../../../styles/globalStyles';
import Icon from 'react-native-vector-icons/Ionicons';

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
                stock: increment(incrementValue),
                updatedAt: serverTimestamp()
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
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 10, color: '#666' }}>Cargando producto...</Text>
      </View>
    );
  }

  const isAdding = operation === 'add';

  return (
    <View style={globalStyles.container}>
		<View style={globalStyles.header}>
			<TouchableOpacity onPress={() => {
				navigation.goBack();
			  }}>
			  <Icon name="chevron-back" size={26} color="#fff" />
			</TouchableOpacity>
			<Text style={globalStyles.title}>Stock del Producto</Text>
		</View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={styles.content}
      >
        <View style={styles.card}>
            <Text style={styles.label}>Producto</Text>
            <Text style={styles.productName}>{product?.name ?? '—'}</Text>
            
            <View style={styles.divider} />

            <Text style={styles.label}>Stock actual</Text>
            <Text style={styles.stockValue}>{product?.stock ?? 0}</Text>
        </View>

        <View style={styles.toggleContainer}>
            <TouchableOpacity 
            style={[styles.toggleBtn, isAdding && styles.toggleBtnActiveAdd]} 
            onPress={() => setOperation('add')}
            >
            <Text style={[styles.toggleText, isAdding && styles.toggleTextActiveAdd]}>Agregar (+)</Text>
            </TouchableOpacity>
            <TouchableOpacity 
            style={[styles.toggleBtn, !isAdding && styles.toggleBtnActiveRemove]} 
            onPress={() => setOperation('remove')}
            >
            <Text style={[styles.toggleText, !isAdding && styles.toggleTextActiveRemove]}>Disminuir (-)</Text>
            </TouchableOpacity>
        </View>

        <TextInput
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            placeholder={isAdding ? "Cantidad a agregar" : "Cantidad a disminuir"}
            placeholderTextColor="#999"
            editable={!saving}
            style={styles.input}
        />

        {saving ? (
            <ActivityIndicator size="large" color={isAdding ? "#2196F3" : "#F44336"} />
        ) : (
            <View style={{ marginTop: 10 }}>
                <TouchableOpacity 
                    style={[
                        styles.actionButton, 
                        { backgroundColor: isAdding ? "#007AFF" : "#FF3B30", opacity: !amount ? 0.6 : 1 }
                    ]}
                    onPress={handleUpdateStock}
                    disabled={!amount}
                >
                    <Text style={styles.actionButtonText}>
                        {isAdding ? "Confirmar Ingreso" : "Confirmar Salida"}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.cancelButton} 
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
            </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
      padding: 16,
      flex: 1
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F6FA' },
  
  card: {
      backgroundColor: '#fff',
      padding: 20,
      borderRadius: 16,
      marginBottom: 24,
      elevation: 2,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: {width:0, height: 2}
  },
  label: { fontSize: 13, color: '#888', marginBottom: 6, fontWeight: '600', textTransform: 'uppercase' },
  productName: { fontSize: 20, fontWeight: '700', color: '#333' },
  stockValue: { fontSize: 28, fontWeight: '800', color: '#333' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 16 },

  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    fontSize: 18,
    color: '#333'
  },
  toggleContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#EFEFEF',
    borderRadius: 12,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  toggleBtnActiveAdd: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  toggleBtnActiveRemove: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  toggleText: {
    fontWeight: '600',
    color: '#999',
    fontSize: 15
  },
  toggleTextActiveAdd: {
    color: '#007AFF'
  },
  toggleTextActiveRemove: {
    color: '#FF3B30'
  },

  actionButton: {
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginBottom: 12,
      elevation: 2
  },
  actionButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700'
  },
  cancelButton: {
      paddingVertical: 16,
      alignItems: 'center'
  },
  cancelButtonText: {
      color: '#888',
      fontSize: 16,
      fontWeight: '600'
  }
});
