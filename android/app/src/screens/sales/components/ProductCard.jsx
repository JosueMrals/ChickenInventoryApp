// ProductCard.jsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput } from 'react-native';
import styles from '../styles/productStyles';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function ProductCard({ product, onAddOne, onAddWithQty }) {
  const [qtyModal, setQtyModal] = useState(false);
  const [qty, setQty] = useState('1');

  const handleLongPress = () => {
    setQty('1');
    setQtyModal(true);
  };

  const submitQty = () => {
    const q = parseInt(qty) || 1;
    onAddWithQty(product, q);
    setQtyModal(false);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.card}
        onPress={() => onAddOne(product)}
        onLongPress={handleLongPress}
        delayLongPress={300}
      >
        <View>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.price}>C${(product.salePrice ?? product.price ?? 0).toFixed(2)}</Text>
          {product.wholesaleThreshold ? (
            <Text style={styles.wholesale}>Mayoreo: {product.wholesaleThreshold}u → C${(product.wholesalePrice ?? 0).toFixed(2)}</Text>
          ) : null}
        </View>
      </TouchableOpacity>

      <Modal visible={qtyModal} transparent animationType="slide">
        <View style={styles.qtyOverlay}>
          <View style={styles.qtyModal}>
            <Text style={styles.qtyTitle}>Agregar cantidad</Text>
            <TextInput
              keyboardType="numeric"
              value={qty}
              onChangeText={setQty}
              style={styles.qtyInput}
            />
            <View style={styles.qtyRow}>
              <TouchableOpacity onPress={() => setQtyModal(false)} style={styles.qtyCancel}>
                <Text style={{ color: '#fff' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={submitQty} style={styles.qtyAdd}>
                <Text style={{ color: '#fff' }}>Agregar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
