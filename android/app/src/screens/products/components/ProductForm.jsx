import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, Alert } from 'react-native';
import styles from '../styles/productFormStyles';
import {
  createProduct,
  updateProduct,
  deleteProduct,
  addStockToProduct
} from '../services/productService';

export default function ProductForm({ visible, onClose, product, role }) {
  const isNew = !product || !product.id;
  const isAdmin = role === "admin";

  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [price, setPrice] = useState('');
  const [measureType, setMeasureType] = useState('unit'); // unit | weight
  const [stock, setStock] = useState(0);

  const [stockModal, setStockModal] = useState(false);
  const [addAmount, setAddAmount] = useState('');

  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setBarcode(product.barcode || '');
      setPrice(product.price?.toString() || '');
      setMeasureType(product.measureType || 'unit');
      setStock(product.stock || 0);
    }
  }, [product]);

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Error', 'El nombre es obligatorio');
    if (!barcode.trim()) return Alert.alert('Error', 'El código de barras es obligatorio');
    if (!price.trim() || isNaN(price)) return Alert.alert('Error', 'Precio inválido');

    const data = {
      name,
      barcode,
      price: parseFloat(price),
      measureType,
      stock: stock ?? 0
    };

    try {
      if (isNew) await createProduct(data);
      else await updateProduct(product.id, data);

      onClose();
    } catch (err) {
      Alert.alert('Error', 'No se pudo guardar el producto');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Eliminar producto",
      "¿Seguro que deseas eliminar este producto?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            await deleteProduct(product.id);
            onClose();
          }
        }
      ]
    );
  };

  const handleAddStock = async () => {
    if (!addAmount.trim() || isNaN(addAmount))
      return Alert.alert("Error", "Cantidad inválida");

    await addStockToProduct(product.id, parseFloat(addAmount));
    setAddAmount('');
    setStockModal(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>

          <Text style={styles.title}>
            {isNew ? "Nuevo Producto" : `Producto: ${product.name}`}
          </Text>

          {/* Nombre */}
          <Text style={styles.label}>Nombre</Text>
          <TextInput
            editable={isAdmin}
            value={name}
            onChangeText={setName}
            style={styles.input}
          />

          {/* Código de barra */}
          <Text style={styles.label}>Código de barras</Text>
          <TextInput
            editable={isAdmin}
            value={barcode}
            onChangeText={setBarcode}
            style={styles.input}
          />

          {/* Precio */}
          <Text style={styles.label}>Precio (venta)</Text>
          <TextInput
            editable={isAdmin}
            keyboardType="numeric"
            value={price}
            onChangeText={setPrice}
            style={styles.input}
          />

          {/* Tipo de medida */}
          <Text style={styles.label}>Medición</Text>
          <View style={styles.measureRow}>
            <TouchableOpacity
              disabled={!isAdmin}
              onPress={() => setMeasureType('unit')}
              style={[styles.measureBtn, measureType === 'unit' && styles.measureActive]}
            >
              <Text>Unidad</Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={!isAdmin}
              onPress={() => setMeasureType('weight')}
              style={[styles.measureBtn, measureType === 'weight' && styles.measureActive]}
            >
              <Text>Peso</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Stock actual: {stock}</Text>

          {/* Botones */}
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cerrar</Text>
            </TouchableOpacity>

            {isAdmin && (
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveText}>{isNew ? "Crear" : "Guardar"}</Text>
              </TouchableOpacity>
            )}
          </View>

          {isAdmin && !isNew && (
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.stockBtn}
                onPress={() => setStockModal(true)}
              >
                <Text style={styles.stockText}>➕ Ingreso al inventario</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleDelete}
              >
                <Text style={styles.deleteText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          )}

        </View>
      </View>

      {/* MODAL - Aumentar stock */}
      <Modal visible={stockModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.stockModalBox}>
            <Text style={styles.title}>Ingreso de productos</Text>

            <TextInput
              placeholder="Cantidad"
              keyboardType="numeric"
              value={addAmount}
              onChangeText={setAddAmount}
              style={styles.input}
            />

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setStockModal(false)}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleAddStock}
              >
                <Text style={styles.saveText}>Ingresar</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

    </Modal>
  );
}
