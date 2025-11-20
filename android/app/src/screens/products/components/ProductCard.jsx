import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import styles from '../styles/productsStyles';

export default function ProductCard({ product, role, onEdit }) {
  const {
    name,
    salePrice,
    purchasePrice,
    stock,
    wholesaleThreshold,
    wholesalePrice,
  } = product;

  return (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.info}>Precio venta: ${Number(salePrice || 0).toFixed(2)}</Text>

        {/* compra solo para admin */}
        {role === 'admin' && (
          <Text style={styles.subInfo}>Precio compra: ${Number(purchasePrice || 0).toFixed(2)}</Text>
        )}

        <Text style={styles.info}>Stock: {stock ?? 0}</Text>

        {wholesaleThreshold > 0 && wholesalePrice != null && (
          <Text style={styles.subInfo}>
            Mayoreo: {wholesaleThreshold} unidades → ${Number(wholesalePrice).toFixed(2)} c/u
          </Text>
        )}
      </View>

      {role === 'admin' ? (
        <TouchableOpacity onPress={onEdit} style={styles.editBtn}>
          <Text style={styles.editBtnText}>Editar</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
