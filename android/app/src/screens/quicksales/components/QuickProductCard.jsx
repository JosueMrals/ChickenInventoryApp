import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import styles from '../styles/quickProductStyles';

export default function QuickProductCard({ product, onAddOne, onAddWithQty }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [qty, setQty] = useState('1');

  const submitQty = () => {
    const q = parseInt(qty) || 1;
    onAddWithQty(product, q);
    setModalVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.card}
        onPress={() => onAddOne(product)}
        onLongPress={() => setModalVisible(true)}
      >
        <View>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.price}>
            C${(product.salePrice ?? product.price).toFixed(2)}
          </Text>
        </View>
        <Icon name="plus-circle" size={28} color="#007AFF" />
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.qtyOverlay}>
          <View style={styles.qtyModal}>
            <Text style={styles.qtyTitle}>Cantidad</Text>

            <TextInput
              style={styles.qtyInput}
              keyboardType="numeric"
              value={qty}
              onChangeText={setQty}
            />

            <View style={styles.qtyButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.addBtn} onPress={submitQty}>
                <Text style={styles.addText}>Agregar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
