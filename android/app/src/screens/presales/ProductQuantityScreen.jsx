import React, { useState, useMemo } from "react";
import {
  View, Text, TouchableOpacity, Alert, SafeAreaView,
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
} from "react-native";
import NumericKeyboard from "../../components/common/NumericKeyboard";
import globalStyles from "../../styles/globalStyles";
import Icon from "react-native-vector-icons/Ionicons";
import { useProductCategories } from "../productsNew1/hooks/useProductCategories";
import { normalizeCategory } from "../productsNew1/constants/productCategories";
import { calcPriceForProduct } from "../sales/hooks/useSalePricing";
import { useRoute as useRouteContext } from "../../context/RouteContext";

export default function ProductQuantityScreen({ navigation, route }) {
  const { product, onConfirm } = route.params;

  const [qty, setQty] = useState("");
  const { categoryRows } = useProductCategories();
  const { selectedRoute } = useRouteContext();
  const activeRouteId = selectedRoute?.id || null;

  // Tiers activos de la categoría del producto
  const categoryTiers = useMemo(() => {
    if (!product?.category || !categoryRows?.length) return [];
    const productCat = normalizeCategory(product.category).toLowerCase();
    const catRow = categoryRows.find(
      (r) => normalizeCategory(r?.name).toLowerCase() === productCat
    );
    if (!catRow || !Array.isArray(catRow.discountTiers)) return [];
    return catRow.discountTiers
      .filter((t) => t.active !== false && Number(t.minQty) > 0 && Number(t.discountValue) > 0)
      .sort((a, b) => a.minQty - b.minQty);
  }, [categoryRows, product?.category]);

  // Preview de precio en tiempo real
  const pricePreview = useMemo(() => {
    const n = Number(qty);
    const categoryActivation = categoryTiers.length > 0 ? { discountTiers: categoryTiers } : null;

    if (!n || n <= 0) {
      const base = calcPriceForProduct({
        product, qty: 1, activeRouteId,
        enableCategoryDiscount: !!categoryActivation,
        categoryActivation,
        categoryQty: 1,
      });
      return { qty: 0, unitPrice: base.priceToUse, total: 0, source: base.pricingSource, saved: 0 };
    }
    const pricing = calcPriceForProduct({
      product, qty: n, activeRouteId,
      enableCategoryDiscount: !!categoryActivation,
      categoryActivation,
      categoryQty: n,
    });
    const effectiveBase = pricing.basePrice || Number(product?.salePrice ?? product?.price ?? 0);
    const saved = Math.max(0, (effectiveBase - pricing.priceToUse) * n + Number(pricing.autoDiscountTotal || 0));
    return {
      qty: n,
      unitPrice: pricing.priceToUse,
      total: pricing.priceToUse * n,
      source: pricing.pricingSource,
      saved: Number(saved.toFixed(2)),
    };
  }, [qty, product, activeRouteId, categoryTiers]);

  const sourceLabel = {
    wholesale:       { label: 'Precio mayorista', color: '#F57F17', bg: '#FFF8E1', icon: 'pricetag' },
    category:        { label: 'Desc. categoría',  color: '#6D28D9', bg: '#EDE9FE', icon: 'layers-outline' },
    customer:        { label: 'Desc. cliente',    color: '#0369A1', bg: '#E0F2FE', icon: 'person' },
    route:           { label: 'Precio de ruta',   color: '#7C3AED', bg: '#F5F3FF', icon: 'navigate' },
    'route+customer':{ label: 'Ruta + cliente',   color: '#7C3AED', bg: '#F5F3FF', icon: 'navigate' },
    regular:         { label: null, color: null, bg: null, icon: null },
  }[pricePreview.source] || { label: null };

  const saveQuantity = () => {
    const n = Number(qty);
    if (!qty || isNaN(n) || n <= 0) {
      Alert.alert("Cantidad inválida", "Ingresa una cantidad mayor a 0.");
      return;
    }
    onConfirm(n);
    navigation.goBack();
  };

  const clearQty = () => setQty("");

  const renderInfoCarrusel = () => {
    const wholesale = product.wholesalePrices || [];
    const bonuses = Array.isArray(product.bonuses)
      ? product.bonuses
      : (product.bonus?.enabled ? [product.bonus] : []);
    const activeBonuses = bonuses.filter(b => b.enabled && Number(b.threshold) > 0);
    const routePrices = Array.isArray(product.routePrices) ? product.routePrices : [];

    if (wholesale.length === 0 && activeBonuses.length === 0 && categoryTiers.length === 0 && routePrices.length === 0) return null;

    return (
      <View style={{ width: '100%', marginBottom: 4 }}>

        {/* Tags de descuentos por categoría */}
        {categoryTiers.length > 0 && (
          <View style={{ marginBottom: (wholesale.length > 0 || activeBonuses.length > 0) ? 4 : 0 }}>
            <Text style={localStyles.chipSectionLabel}>
              Desc. {normalizeCategory(product.category)}:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 10, alignItems: 'center' }}
              keyboardShouldPersistTaps="handled" style={{ maxHeight: 36 }}>
              {categoryTiers.map((tier, i) => {
                const isPct = tier.discountType === 'percent';
                const tc = isPct ? '#6D28D9' : '#047857';
                const valueLabel = isPct ? `${Number(tier.discountValue)}%` : `C$${Number(tier.discountValue).toFixed(2)}`;
                return (
                  <View key={`ct-${i}`} style={[localStyles.chip, { backgroundColor: isPct ? '#EDE9FE' : '#ECFDF5', borderColor: isPct ? '#8B5CF6' : '#059669' }]}>
                    <Icon name="layers-outline" size={11} color={tc} style={{ marginRight: 3 }} />
                    <Text style={[localStyles.chipText, { color: tc }]}>{`≥${tier.minQty}u → ${valueLabel} off`}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Precios mayoristas */}
        {wholesale.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 10, alignItems: 'center' }}
            keyboardShouldPersistTaps="handled"
            style={{ marginBottom: activeBonuses.length > 0 ? 4 : 0, maxHeight: 36 }}>
            {wholesale.map((wp, i) => (
              <View key={`ws-${i}`} style={[localStyles.chip, { backgroundColor: '#FFF8E1', borderColor: '#FFC107' }]}>
                <Icon name="pricetag" size={11} color="#F57F17" style={{ marginRight: 3 }} />
                <Text style={[localStyles.chipText, { color: '#F57F17' }]}>Min {wp.quantity}: C${Number(wp.price).toFixed(2)}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Bonificaciones */}
        {activeBonuses.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 10, alignItems: 'center' }}
            keyboardShouldPersistTaps="handled" style={{ maxHeight: 36 }}>
            {activeBonuses.map((b, i) => (
              <View key={`b-${i}`} style={[localStyles.chip, { backgroundColor: '#E3F2FD', borderColor: '#2196F3' }]}>
                <Icon name="gift" size={11} color="#1565C0" style={{ marginRight: 3 }} />
                <Text style={[localStyles.chipText, { color: '#0D47A1' }]}>{b.threshold} → {b.bonusQuantity} Gratis</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6FA' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1 }}>

          {/* HEADER */}
          <View style={globalStyles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Icon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={[globalStyles.title, { flex: 1, marginHorizontal: 10 }]} numberOfLines={1}>
              {product.name}
            </Text>
          </View>

          {/* DISPLAY PRINCIPAL */}
          <View style={localStyles.displayCard}>
            {/* Precio unitario */}
            <View style={localStyles.displayRow}>
              <Text style={localStyles.displayUnitLabel}>Precio unit.</Text>
              <Text style={localStyles.displayUnitPrice}>
                C${(pricePreview.unitPrice || 0).toFixed(2)}
              </Text>
              {sourceLabel.label && (
                <View style={[localStyles.sourceChip, { backgroundColor: sourceLabel.bg, borderColor: sourceLabel.color }]}>
                  <Icon name={sourceLabel.icon} size={10} color={sourceLabel.color} style={{ marginRight: 3 }} />
                  <Text style={[localStyles.sourceChipText, { color: sourceLabel.color }]}>{sourceLabel.label}</Text>
                </View>
              )}
            </View>

            {/* Cantidad grande + total */}
            <View style={localStyles.qtyRow}>
              <View style={localStyles.qtyBox}>
                <Text style={localStyles.qtyText}>{qty || "0"}</Text>
                <Text style={localStyles.qtyUnit}>uds.</Text>
              </View>
              <View style={localStyles.totalBox}>
                {pricePreview.qty > 0 ? (
                  <>
                    <Text style={localStyles.totalLabel}>Total</Text>
                    <Text style={localStyles.totalValue}>C${pricePreview.total.toFixed(2)}</Text>
                    {pricePreview.saved > 0 && (
                      <Text style={localStyles.savedText}>Ahorro C${pricePreview.saved.toFixed(2)}</Text>
                    )}
                  </>
                ) : (
                  <Text style={localStyles.totalPlaceholder}>— Ingresa cantidad</Text>
                )}
              </View>
            </View>
          </View>

          {/* TECLADO */}
          <View style={localStyles.keyboardArea}>
            <NumericKeyboard
              value={qty}
              onChange={setQty}
              onSubmit={saveQuantity}
              infoComponent={renderInfoCarrusel()}
            />
          </View>

          {/* BOTÓN CONFIRMAR */}
          <View style={localStyles.footer}>
            <TouchableOpacity
              style={[localStyles.confirmBtn, (!qty || Number(qty) <= 0) && localStyles.confirmBtnDisabled]}
              onPress={saveQuantity}
              activeOpacity={0.85}
            >
              <Icon name="checkmark-circle" size={20} color="#fff" />
              <Text style={localStyles.confirmBtnText}>
                {pricePreview.qty > 0
                  ? `Agregar ${pricePreview.qty} ud${pricePreview.qty !== 1 ? 's' : ''}  ·  C$${pricePreview.total.toFixed(2)}`
                  : 'Agregar al carrito'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  // Display
  displayCard: {
    backgroundColor: '#fff',
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  displayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  displayUnitLabel: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  displayUnitPrice: { fontSize: 15, color: '#111827', fontWeight: '700' },
  sourceChip: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  sourceChipText: { fontSize: 10, fontWeight: '700' },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qtyBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  qtyText: {
    fontSize: 52,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 58,
  },
  qtyUnit: { fontSize: 16, color: '#9CA3AF', marginBottom: 8, fontWeight: '500' },
  totalBox: { alignItems: 'flex-end' },
  totalLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  totalValue: { fontSize: 24, color: '#007AFF', fontWeight: '800' },
  totalPlaceholder: { fontSize: 13, color: '#D1D5DB', fontStyle: 'italic' },
  savedText: { fontSize: 11, color: '#16A34A', fontWeight: '700', marginTop: 2 },
  // Teclado
  keyboardArea: {
    flex: 1,
    backgroundColor: '#F5F6FA',
    paddingHorizontal: 4,
  },
  // Chips
  chipSectionLabel: {
    fontSize: 10, color: '#6D28D9', fontWeight: '700',
    paddingHorizontal: 12, marginBottom: 2,
  },
  chip: {
    marginRight: 6, paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center',
  },
  chipText: { fontSize: 10, fontWeight: '700' },
  // Footer
  footer: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingBottom: 20,
    borderRadius: 14,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 14,
    elevation: 3,
    shadowColor: '#007AFF',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  confirmBtnDisabled: { backgroundColor: '#93C5FD' },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

