import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

export default function ProductCard({ product, onEdit, onAddStock, onPress, hideActions = false }) {
  const isLowStock = (product?.stock ?? 0) < 5;

  return (
    <TouchableOpacity 
      onPress={onPress} 
      activeOpacity={onPress ? 0.7 : 1} // Solo efecto visual si tiene onPress
      style={styles.card}
    >
      {/* Icono / Avatar del producto */}
      <View style={[styles.iconContainer, isLowStock ? styles.iconLowStock : styles.iconNormal]}>
        <Icon name="cube-outline" size={24} color={isLowStock ? '#D32F2F' : '#007AFF'} />
      </View>

      {/* Información Central */}
      <View style={styles.infoContainer}>
        <Text style={styles.name} numberOfLines={1}>{product?.name}</Text>
        <Text style={styles.code}>Cod: {product?.barcode ?? '---'}</Text>
        <View style={styles.rowInfo}>
            <Text style={styles.price}>${product?.salePrice ?? '0.00'}</Text>
            <View style={[styles.badge, isLowStock ? styles.badgeLow : styles.badgeNormal]}>
                <Text style={[styles.badgeText, isLowStock ? styles.textLow : styles.textNormal]}>
                    Stock: {product?.stock ?? 0}
                </Text>
            </View>
        </View>
      </View>

      {/* Botones de Acción (Solo Admin) */}
      {!hideActions && (
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => onAddStock && onAddStock(product)} style={[styles.actionBtn, styles.stockBtn]}>
             <Icon name="layers-outline" size={20} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => onEdit && onEdit(product)} style={[styles.actionBtn, styles.editBtn]}>
             <Icon name="create-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Flecha indicativa (Solo User) */}
      {hideActions && onPress && (
          <View style={{ justifyContent: 'center', paddingLeft: 8 }}>
              <Icon name="chevron-forward" size={20} color="#ccc" />
          </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    // Sombra suave
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconNormal: { backgroundColor: '#E3F2FD' },
  iconLowStock: { backgroundColor: '#FFEBEE' },
  
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  code: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  rowInfo: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  price: {
      fontSize: 15,
      fontWeight: 'bold',
      color: '#2E7D32',
      marginRight: 10,
  },
  badge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
  },
  badgeNormal: { backgroundColor: '#E8F5E9' },
  badgeLow: { backgroundColor: '#FFEBEE' },
  textNormal: { fontSize: 11, fontWeight: '700', color: '#2E7D32' },
  textLow: { fontSize: 11, fontWeight: '700', color: '#D32F2F' },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // Espacio entre botones
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  stockBtn: { backgroundColor: '#007AFF' }, // Azul
  editBtn: { backgroundColor: '#FF9800' }, // Naranja
});
