import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import styles from '../styles/quickProductsStyles';

export default function ProductCard({ product, onAdd }) {
  const [visible, setVisible] = useState(false);
  const [qty, setQty] = useState('1');

  const addWithQty = () => {
    const q = parseInt(qty) || 1;
    onAdd(product, q);
    setVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.card}
        onPress={() => onAdd(product, 1)}
        onLongPress={() => setVisible(true)}
      >
        <View>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.price}>
            C${(product.salePrice ?? product.price).toFixed(2)}
          </Text>
        </View>

        <Icon name="plus-circle" size={28} color="#007AFF" />
      </TouchableOpacity>

      {/* MODAL DE CANTIDAD */}
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.qtyOverlay}>
          <View style={styles.qtyModal}>
            <Text style={styles.qtyTitle}>Cantidad</Text>

            <TextInput
              value={qty}
              onChangeText={setQty}
              keyboardType="numeric"
              style={styles.qtyInput}
            />

            <View style={styles.qtyButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setVisible(false)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.addBtn} onPress={addWithQty}>
                <Text style={styles.addText}>Agregar</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>
    </>
  );
}
