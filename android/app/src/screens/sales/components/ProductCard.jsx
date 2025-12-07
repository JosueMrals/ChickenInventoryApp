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

  // Logic to display wholesale info
  const renderWholesaleInfo = () => {
    if (Array.isArray(product.wholesalePrices) && product.wholesalePrices.length > 0) {
      // Show the best price or range? Or just "Mayoreo disp."
      // Let's show the first one (usually lowest qty) or "Multiple"
      // Or show the minimum threshold and price.
      // Sort by quantity ascending to show the first tier
      const sorted = [...product.wholesalePrices].sort((a, b) => a.quantity - b.quantity);
      const first = sorted[0];
      const count = sorted.length;
      
      if (count === 1) {
        return <Text style={styles.wholesale}>Mayoreo: {first.quantity}u → C${Number(first.price).toFixed(2)}</Text>;
      } else {
        return <Text style={styles.wholesale}>Mayoreo: {first.quantity}u → C${Number(first.price).toFixed(2)} (+{count-1})</Text>;
      }
    } 
    // Fallback for legacy data
    else if (product.wholesaleThreshold && product.wholesalePrice) {
      return (
        <Text style={styles.wholesale}>Mayoreo: {product.wholesaleThreshold}u → C${(product.wholesalePrice ?? 0).toFixed(2)}</Text>
      );
    }
    return null;
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
          {renderWholesaleInfo()}
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
