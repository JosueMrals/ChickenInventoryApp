import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, Animated, ScrollView, Alert,
} from 'react-native';
import styles from '../styles/productsStyles';
import { createProduct, updateProduct } from '../services/productService';

export default function ProductForm({ visible, onClose, product, role }) {
  const [form, setForm] = useState({
    name: '',
    purchasePrice: '',
    salePrice: '',
    stock: '',
    wholesaleThreshold: '',
    wholesalePrice: '',
  });
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || '',
        purchasePrice: product.purchasePrice?.toString() || '',
        salePrice: product.salePrice?.toString() || '',
        stock: (product.stock ?? 0).toString(),
        wholesaleThreshold: product.wholesaleThreshold?.toString() || '',
        wholesalePrice: product.wholesalePrice?.toString() || '',
      });
    } else {
      resetForm();
    }
  }, [product]);

  useEffect(() => {
    if (visible) {
      Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    }
  }, [visible]);

  const resetForm = () => setForm({
    name: '',
    purchasePrice: '',
    salePrice: '',
    stock: '',
    wholesaleThreshold: '',
    wholesalePrice: '',
  });

  const validateAndSubmit = async () => {
    if (!form.name.trim() || !form.salePrice.trim()) {
      return Alert.alert('Campos requeridos', 'Nombre y precio de venta son obligatorios.');
    }

    // parse numbers safely
    const payload = {
      name: form.name.trim(),
      purchasePrice: role === 'admin' ? parseFloat(form.purchasePrice || 0) : undefined,
      salePrice: parseFloat(form.salePrice || 0),
      stock: parseInt(form.stock || 0),
      wholesaleThreshold: parseInt(form.wholesaleThreshold || 0) || 0,
      wholesalePrice: form.wholesalePrice ? parseFloat(form.wholesalePrice) : null,
      updatedAt: new Date(),
    };

    try {
      if (product && product.id) {
        await updateProduct(product.id, payload);
      } else {
        await createProduct(payload);
      }
      onClose();
      resetForm();
    } catch (e) {
      console.error('Error guardando producto', e);
      Alert.alert('Error', e.message || 'No se pudo guardar el producto.');
    }
  };

  return (
    <Modal transparent visible={visible} animationType="none">
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.modalCard, { transform: [{ scale: anim }] }]}>
          <ScrollView>
            <Text style={styles.modalTitle}>{product ? 'Editar producto' : 'Nuevo producto'}</Text>

            <TextInput placeholder="Nombre" value={form.name} onChangeText={(t) => setForm({...form, name: t})} style={styles.input} />

            {role === 'admin' && (
              <TextInput placeholder="Precio compra" keyboardType="numeric" value={form.purchasePrice} onChangeText={(t) => setForm({...form, purchasePrice: t})} style={styles.input} />
            )}

            <TextInput placeholder="Precio venta" keyboardType="numeric" value={form.salePrice} onChangeText={(t) => setForm({...form, salePrice: t})} style={styles.input} />

            <TextInput placeholder="Stock" keyboardType="numeric" value={form.stock} onChangeText={(t) => setForm({...form, stock: t})} style={styles.input} />

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput placeholder="Umbral mayoreo (cantidad)" keyboardType="numeric" value={form.wholesaleThreshold} onChangeText={(t) => setForm({...form, wholesaleThreshold: t})} style={[styles.input, { flex: 1 }]} />
              <TextInput placeholder="Precio mayoreo" keyboardType="numeric" value={form.wholesalePrice} onChangeText={(t) => setForm({...form, wholesalePrice: t})} style={[styles.input, { flex: 1 }]} />
            </View>

            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={validateAndSubmit}>
                <Text style={styles.btnText}>Guardar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => { resetForm(); onClose(); }}>
                <Text style={styles.btnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
