import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import globalStyles from '../../../styles/globalStyles';
import { getCategoryLabel } from '../constants/productCategories';
import { useRoute as useRouteContext } from '../../../context/RouteContext';
import { useAdaptiveBottom } from '../../../hooks/useAdaptiveBottom';

export default function ProductDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { product, role } = route.params ?? {};
  const { selectedRoute } = useRouteContext();
  const { bottomPadding } = useAdaptiveBottom();

  const isAdmin = role === 'admin';
  const routePrices = product?.routePrices || [];

  // Precio de la ruta del usuario (solo no-admin)
  const userRoutePrice = !isAdmin && selectedRoute
    ? routePrices.find((rp) => rp.routeId === selectedRoute.id)
    : null;

  // Precio principal a mostrar
  const displayPrice = userRoutePrice ? userRoutePrice.price : (product?.salePrice ?? 0);
  const hasCustomRoutePrice = !!userRoutePrice && Number(userRoutePrice.price) !== Number(product?.salePrice);

  const isLowStock = (product?.stock ?? 0) < 5;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={globalStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Icon name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={[globalStyles.title, styles.headerTitle]} numberOfLines={1}>
          Detalle del Producto
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, isAdmin && styles.scrollContentWithFooter]}
        showsVerticalScrollIndicator={false}>

        {/* ── Hero Card ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <Icon name="cube-outline" size={32} color={isLowStock ? '#D32F2F' : '#007AFF'} />
          </View>
          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>{product?.name}</Text>

            {/* Badge de ruta activa (no-admin) */}
            {!isAdmin && selectedRoute && (
              <View style={styles.routeBadge}>
                <Icon name="navigate" size={11} color="#7C3AED" />
                <Text style={styles.routeBadgeText}>{selectedRoute.name}</Text>
              </View>
            )}

            <Text style={styles.heroPrice}>${displayPrice}</Text>

            {/* Indicador de precio especial de ruta */}
            {!isAdmin && hasCustomRoutePrice && (
              <View style={styles.specialPriceNote}>
                <Icon name="pricetag" size={11} color="#059669" />
                <Text style={styles.specialPriceNoteText}>Precio especial para tu ruta</Text>
              </View>
            )}

            {/* Admin: etiqueta de precio base */}
            {isAdmin && (
              <Text style={styles.heroPriceLabel}>Precio base de venta</Text>
            )}
          </View>
        </View>

        {/* ── Info General ── */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionIconWrap}>
              <Icon name="information-circle-outline" size={18} color="#007AFF" />
            </View>
            <Text style={styles.sectionTitle}>Información</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Categoría</Text>
            <Text style={styles.detailValue}>{getCategoryLabel(product)}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Código de Barras</Text>
            <Text style={styles.detailValue}>{product?.barcode || '---'}</Text>
          </View>

          <View style={[styles.detailRow, { marginBottom: 0, borderBottomWidth: 0 }]}>
            <Text style={styles.detailLabel}>Stock Disponible</Text>
            <View style={[styles.stockBadge, isLowStock ? styles.stockBadgeLow : styles.stockBadgeOk]}>
              <Text style={[styles.stockBadgeText, isLowStock ? styles.stockTextLow : styles.stockTextOk]}>
                {product?.stock ?? 0} {product?.measureType === 'weight' ? 'kg/lb' : 'unid.'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Costos (solo admin) ── */}
        {isAdmin && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIconWrap, { backgroundColor: '#ECFDF5' }]}>
                <Icon name="cash-outline" size={18} color="#059669" />
              </View>
              <Text style={styles.sectionTitle}>Costos y Márgenes</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Costo de Compra</Text>
              <Text style={styles.detailValue}>${product?.purchasePrice ?? '---'}</Text>
            </View>

            <View style={[styles.detailRow, { marginBottom: 0, borderBottomWidth: 0 }]}>
              <Text style={styles.detailLabel}>Margen</Text>
              <Text style={[styles.detailValue, { color: '#7C3AED' }]}>
                {product?.profitMargin ? `${product.profitMargin}%` : '---'}
              </Text>
            </View>
          </View>
        )}

        {/* ── Precios por Ruta ─ Admin: todas las rutas / No-admin: solo la suya ── */}
        {isAdmin && routePrices.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIconWrap, { backgroundColor: '#F5F3FF' }]}>
                <Icon name="navigate-outline" size={18} color="#7C3AED" />
              </View>
              <Text style={styles.sectionTitle}>Precios por Ruta</Text>
              <View style={styles.routeCountBadge}>
                <Text style={styles.routeCountText}>{routePrices.length}</Text>
              </View>
            </View>

            {routePrices.map((rp, idx) => {
              const diff = Number(rp.price) - Number(product?.salePrice ?? 0);
              return (
                <View
                  key={rp.routeId || idx}
                  style={[styles.routePriceRow, idx === routePrices.length - 1 && { borderBottomWidth: 0, marginBottom: 0 }]}>
                  <View style={styles.routePriceLeft}>
                    <View style={styles.routeDot} />
                    <Text style={styles.routePriceName}>{rp.routeName}</Text>
                  </View>
                  <View style={styles.routePriceRight}>
                    <Text style={styles.routePriceValue}>${rp.price}</Text>
                    {diff !== 0 && (
                      <Text style={[styles.routePriceDiff, diff < 0 ? styles.diffDown : styles.diffUp]}>
                        {diff < 0 ? `↓ $${Math.abs(diff).toFixed(2)}` : `↑ $${diff.toFixed(2)}`}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}

            {/* Precio base de referencia */}
            <View style={styles.routeBasePriceNote}>
              <Icon name="information-circle-outline" size={12} color="#64748B" />
              <Text style={styles.routeBasePriceNoteText}>
                Precio base de venta: ${product?.salePrice ?? 0}
              </Text>
            </View>
          </View>
        ) : !isAdmin && userRoutePrice && hasCustomRoutePrice ? (
          // No-admin: mostrar comparación si el precio de ruta difiere del base
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIconWrap, { backgroundColor: '#F5F3FF' }]}>
                <Icon name="pricetag-outline" size={18} color="#7C3AED" />
              </View>
              <Text style={styles.sectionTitle}>Tu Precio</Text>
            </View>
            <View style={styles.userRoutePriceCard}>
              <Icon name="navigate" size={20} color="#7C3AED" />
              <View style={styles.userRoutePriceInfo}>
                <Text style={styles.userRoutePriceRoute}>{userRoutePrice.routeName}</Text>
                <Text style={styles.userRoutePriceValue}>${userRoutePrice.price}</Text>
              </View>
              <View style={styles.specialPriceBadge}>
                <Text style={styles.specialPriceBadgeText}>Precio especial</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* ── Precios Mayorista ── */}
        {(product?.wholesalePrices || []).length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIconWrap, { backgroundColor: '#F0FDF4' }]}>
                <Icon name="pricetags-outline" size={18} color="#16A34A" />
              </View>
              <Text style={styles.sectionTitle}>Precios Mayorista</Text>
            </View>
            {product.wholesalePrices.map((wp, idx) => (
              <View
                key={idx}
                style={[styles.wholesaleRow, idx === product.wholesalePrices.length - 1 && { borderBottomWidth: 0, marginBottom: 0 }]}>
                <View style={styles.wholesaleRowLeft}>
                  <Icon name="layers-outline" size={13} color="#16A34A" />
                  <Text style={styles.wholesaleQty}>Más de {wp.quantity} unid.</Text>
                </View>
                <Text style={styles.wholesalePrice}>${wp.price}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Descripción ── */}
        {product?.description ? (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIconWrap, { backgroundColor: '#F1F5F9' }]}>
                <Icon name="document-text-outline" size={18} color="#64748B" />
              </View>
              <Text style={styles.sectionTitle}>Descripción</Text>
            </View>
            <Text style={styles.descriptionText}>{product.description}</Text>
          </View>
        ) : null}

      </ScrollView>

      {/* ── Botones de Acción fijos (Admin) ── */}
      {isAdmin && (
        <View style={[styles.adminActionsBar, { paddingBottom: bottomPadding }]}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('EditProduct', { product })}>
            <Icon name="create-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.editBtnText}>Editar Producto</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.stockBtn}
            onPress={() => navigation.navigate('AddStock', { productId: product?.id })}>
            <Icon name="layers-outline" size={18} color="#007AFF" style={{ marginRight: 8 }} />
            <Text style={styles.stockBtnText}>Agregar Stock</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },

  /* Header */
  headerBack: { padding: 4 },
  headerTitle: { flex: 1 },
  headerEditBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollContent: { padding: 16, paddingBottom: 32 },
  scrollContentWithFooter: { paddingBottom: 140 },

  /* Hero Card */
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  heroIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroInfo: { flex: 1 },
  heroName: { fontSize: 20, fontWeight: '800', color: '#1A1A2E', marginBottom: 6, lineHeight: 26 },
  heroPrice: { fontSize: 30, fontWeight: '900', color: '#007AFF', marginBottom: 4 },
  heroPriceLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },

  routeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#F5F3FF',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  routeBadgeText: { fontSize: 11, fontWeight: '700', color: '#7C3AED' },

  specialPriceNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  specialPriceNoteText: { fontSize: 11, color: '#059669', fontWeight: '600' },

  /* Sections */
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A2E', flex: 1 },

  /* Detail rows */
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailLabel: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  detailValue: { fontSize: 14, color: '#1A1A2E', fontWeight: '600', maxWidth: '55%', textAlign: 'right' },

  /* Stock badge */
  stockBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  stockBadgeOk: { backgroundColor: '#DCFCE7' },
  stockBadgeLow: { backgroundColor: '#FEE2E2' },
  stockBadgeText: { fontSize: 13, fontWeight: '700' },
  stockTextOk: { color: '#16A34A' },
  stockTextLow: { color: '#DC2626' },

  /* Route prices - admin */
  routeCountBadge: {
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  routeCountText: { fontSize: 11, fontWeight: '800', color: '#7C3AED' },
  routePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F3FF',
  },
  routePriceLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  routeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7C3AED' },
  routePriceName: { fontSize: 14, fontWeight: '600', color: '#374151' },
  routePriceRight: { alignItems: 'flex-end' },
  routePriceValue: { fontSize: 16, fontWeight: '800', color: '#4C1D95' },
  routePriceDiff: { fontSize: 10, fontWeight: '600', marginTop: 1 },
  diffDown: { color: '#059669' },
  diffUp: { color: '#DC2626' },
  routeBasePriceNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  routeBasePriceNoteText: { fontSize: 11, color: '#64748B', fontStyle: 'italic' },

  /* Route price - non-admin */
  userRoutePriceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  userRoutePriceInfo: { flex: 1 },
  userRoutePriceRoute: { fontSize: 12, color: '#6B7280', fontWeight: '600', marginBottom: 2 },
  userRoutePriceValue: { fontSize: 22, fontWeight: '900', color: '#4C1D95' },
  specialPriceBadge: { backgroundColor: '#ECFDF5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#A7F3D0' },
  specialPriceBadgeText: { fontSize: 11, fontWeight: '700', color: '#059669' },

  /* Wholesale */
  wholesaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0FDF4',
  },
  wholesaleRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  wholesaleQty: { fontSize: 13, color: '#374151', fontWeight: '500' },
  wholesalePrice: { fontSize: 15, fontWeight: '800', color: '#16A34A' },

  /* Description */
  descriptionText: { fontSize: 14, color: '#4B5563', lineHeight: 22 },

  /* Admin actions - fixed bottom bar */
  adminActionsBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -3 },
  },
  editBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#007AFF',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  editBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  stockBtn: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#007AFF',
  },
  stockBtnText: { color: '#007AFF', fontSize: 16, fontWeight: '700' },
});

