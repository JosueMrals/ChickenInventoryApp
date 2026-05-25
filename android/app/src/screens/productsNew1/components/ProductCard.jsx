import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { getCategoryLabel } from '../constants/productCategories';

/**
 * @param {Object}  product
 * @param {Function} onEdit
 * @param {Function} onAddStock
 * @param {Function} onPress
 * @param {boolean}  hideActions
 * @param {number|string|undefined} routePrice  - precio de ruta activa (anula salePrice en la tarjeta)
 * @param {string|undefined}        routeLabel  - nombre de la ruta activa
 */
export default function ProductCard({ product, onEdit, onAddStock, onPress, hideActions = false, routePrice, routeLabel }) {
  const isLowStock = (product?.stock ?? 0) < 5;

  // Si hay precio de ruta disponible se muestra ese, de lo contrario el precio base
  const displayPrice = routePrice !== undefined ? routePrice : (product?.salePrice ?? '0.00');
  const hasRoutePrice = routePrice !== undefined && String(routePrice) !== String(product?.salePrice ?? '');

  return (
    <TouchableOpacity 
      onPress={onPress} 
      activeOpacity={onPress ? 0.7 : 1}
      style={styles.card}
    >
      {/* Icono / Avatar del producto */}
      <View style={[styles.iconContainer, isLowStock ? styles.iconLowStock : styles.iconNormal]}>
        <Icon name="cube-outline" size={24} color={isLowStock ? '#D32F2F' : '#007AFF'} />
      </View>

      {/* Información Central */}
      <View style={styles.infoContainer}>
        <Text style={styles.name} numberOfLines={1}>{product?.name}</Text>
        <Text style={styles.code} numberOfLines={1}>Cat: {getCategoryLabel(product)} | Cod: {product?.barcode ?? '---'}</Text>
        <View style={styles.rowInfo}>
            <Text style={styles.price}>${displayPrice}</Text>
            {/* Badge de ruta activa */}
            {hasRoutePrice && routeLabel && (
              <View style={styles.routeLabelBadge}>
                <Icon name="navigate" size={9} color="#7C3AED" />
                <Text style={styles.routeLabelText} numberOfLines={1}>{routeLabel}</Text>
              </View>
            )}
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
          
{/*           <TouchableOpacity onPress={() => onEdit && onEdit(product)} style={[styles.actionBtn, styles.editBtn]}> */}
{/*              <Icon name="create-outline" size={20} color="#fff" /> */}
{/*           </TouchableOpacity> */}
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

  routeLabelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F5F3FF',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    maxWidth: 100,
  },
  routeLabelText: { fontSize: 9, fontWeight: '700', color: '#7C3AED', flexShrink: 1 },

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
