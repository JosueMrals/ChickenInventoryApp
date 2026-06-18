import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import Icon from 'react-native-vector-icons/Ionicons';
import globalStyles from '../../../styles/globalStyles';
import productsService from '../services/productsService';
import { createProductOperation } from '../../../services/operations/productOperations';
import { useAdaptiveBottom } from '../../../hooks/useAdaptiveBottom';
import BonusSetup from '../components/BonusSetup';
import { normalizeCategory } from '../constants/productCategories';
import { useProductCategories } from '../hooks/useProductCategories';
import { useRoutes } from '../hooks/useRoutes';
import { buildUpdateChanges } from '../utils/operationChanges';

const PLACEHOLDER_COLOR = '#9CA3AF';

const TABS = [
  { key: 'info',      label: 'Info & Precios', icon: 'document-text-outline' },
  { key: 'category',  label: 'Categoría',       icon: 'pricetag-outline'      },
  { key: 'bonuses',   label: 'Bonificaciones', icon: 'gift-outline'          },
  { key: 'wholesale', label: 'Mayoristas',      icon: 'people-outline'        },
  { key: 'routes',    label: 'P. x Ruta',       icon: 'navigate-outline'      },
];

function isPermissionDeniedError(err) {
  const code = String(err?.code || '').toLowerCase();
  const message = String(err?.message || '').toLowerCase();
  return code.includes('permission-denied') || message.includes('permission-denied');
}

export default function EditProductScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { product: initialProduct } = route.params;

  const [saving, setSaving]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [values, setValues]   = useState(null);
  const [activeTab, setActiveTab] = useState('info');

  const initialRef = useRef(null);
  const scrollRef  = useRef(null);

  const { categoryRows, categories, loading: categoriesLoading } = useProductCategories();
  const { routes: availableRoutes, loading: routesLoading } = useRoutes();
  const { bottomPadding } = useAdaptiveBottom();
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [categorySearch, setCategorySearch]             = useState('');

  // ── Derived ──────────────────────────────────────────────────────────────────
  const selectedCategoryRow = useMemo(() => {
    const sel = normalizeCategory(values?.category).toLowerCase();
    if (!sel) return null;
    return categoryRows.find((r) => normalizeCategory(r?.name).toLowerCase() === sel) || null;
  }, [categoryRows, values?.category]);

  const discountTiers = useMemo(() => {
    if (!selectedCategoryRow) return [];
    return Array.isArray(selectedCategoryRow.discountTiers)
      ? [...selectedCategoryRow.discountTiers].sort((a, b) => a.minQty - b.minQty)
      : [];
  }, [selectedCategoryRow]);

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    return categoryRows
      .filter((r) => r.active !== false)
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categoryRows, categorySearch]);

  // Tab badge counts
  const enabledBonusesCount = useMemo(
    () => (values?.bonuses || []).filter((b) => b.enabled).length,
    [values?.bonuses],
  );
  const wholesaleCount = values?.wholesalePrices?.length ?? 0;
  const categorySet    = !!normalizeCategory(values?.category ?? '');
  const routePricesCount = (values?.routePrices || []).length;

  // ── Load ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadedValues = {
      ...initialProduct,
      purchasePrice: String(initialProduct?.purchasePrice ?? ''),
      profitMargin:  String(initialProduct?.profitMargin  ?? ''),
      salePrice:     String(initialProduct?.salePrice     ?? ''),
      wholesalePrices: initialProduct?.wholesalePrices?.map((p) => ({
        ...p,
        price:    String(p?.price    ?? ''),
        quantity: String(p?.quantity ?? ''),
        margin:   '',
      })) || [],
      bonuses: (initialProduct.bonuses && Array.isArray(initialProduct.bonuses))
        ? initialProduct.bonuses.map((b) => ({
            ...b,
            threshold:     String(b.threshold     || ''),
            bonusQuantity: String(b.bonusQuantity || ''),
          }))
        : (initialProduct.bonus
          ? [{
              enabled:        initialProduct.bonus.enabled || false,
              threshold:      String(initialProduct.bonus.threshold     || ''),
              bonusProductId: initialProduct.bonus.bonusProductId  || null,
              bonusProductName: initialProduct.bonus.bonusProductName || '',
              bonusQuantity:  String(initialProduct.bonus.bonusQuantity || ''),
            }]
          : []),
      routePrices: (initialProduct?.routePrices || []).map((rp) => ({
        ...rp,
        price: String(rp.price ?? ''),
      })),
    };
    loadedValues.wholesalePrices.forEach((wp) => {
      const wholesaleBase = Number(loadedValues.salePrice || loadedValues.purchasePrice || 0);
      if (wp.price && wholesaleBase)
        wp.margin = calculateMarginFromSalePrice(wholesaleBase, wp.price);
    });
    setValues(loadedValues);
    initialRef.current = JSON.stringify(loadedValues);
    setLoading(false);
  }, [initialProduct]);

  const getWholesaleBasePrice = useCallback((salePrice, purchasePrice = '') => {
    const sale = Number(salePrice);
    if (Number.isFinite(sale) && sale > 0) return sale;
    const cost = Number(purchasePrice);
    if (Number.isFinite(cost) && cost > 0) return cost;
    return null;
  }, []);

  // ── Price helpers ─────────────────────────────────────────────────────────────
  const calculateSalePriceFromMargin = (cost, margin) => {
    if (!cost || !margin || margin >= 100) return '';
    const c = Number(cost); const m = Number(margin);
    if (Number.isNaN(c) || Number.isNaN(m)) return '';
    return (c / (1 - m / 100)).toFixed(2);
  };
  const calculateMarginFromSalePrice = (cost, sale) => {
    if (!cost || !sale) return '';
    const c = Number(cost); const s = Number(sale);
    if (Number.isNaN(c) || Number.isNaN(s) || s === 0) return '';
    return ((1 - c / s) * 100).toFixed(2);
  };

  const handlePriceChange = (field, text) => {
    setValues((prev) => {
      const nv = { ...prev, [field]: text };
      const updateWholesaleMargins = (basePrice) => {
        nv.wholesalePrices = prev.wholesalePrices.map((wp) => (
          wp.price && basePrice ? { ...wp, margin: calculateMarginFromSalePrice(basePrice, wp.price) } : wp
        ));
      };
      if (field === 'purchasePrice') {
        if (nv.profitMargin) nv.salePrice = calculateSalePriceFromMargin(text, nv.profitMargin);
        updateWholesaleMargins(getWholesaleBasePrice(nv.salePrice, text));
      }
      if (field === 'profitMargin' && nv.purchasePrice)
        nv.salePrice = calculateSalePriceFromMargin(nv.purchasePrice, text);
      if (field === 'salePrice' && nv.purchasePrice)
        nv.profitMargin = calculateMarginFromSalePrice(nv.purchasePrice, text);
      if (field === 'profitMargin' || field === 'salePrice') {
        updateWholesaleMargins(getWholesaleBasePrice(field === 'salePrice' ? text : nv.salePrice, nv.purchasePrice));
      }
      return nv;
    });
  };

  // ── Route Prices ─────────────────────────────────────────────────────────────
  const [showRouteSelector, setShowRouteSelector] = useState(false);

  const routesAvailableToAdd = useMemo(() => {
    const usedIds = new Set((values?.routePrices || []).map((rp) => rp.routeId));
    return availableRoutes.filter((r) => !usedIds.has(r.id));
  }, [availableRoutes, values?.routePrices]);

  function addRoutePrice(route) {
    setValues((v) => ({
      ...v,
      routePrices: [...(v.routePrices || []), { routeId: route.id, routeName: route.name, price: '' }],
    }));
    setShowRouteSelector(false);
  }
  function removeRoutePrice(routeId) {
    setValues((v) => ({ ...v, routePrices: (v.routePrices || []).filter((rp) => rp.routeId !== routeId) }));
  }
  function updateRoutePriceValue(routeId, price) {
    setValues((v) => ({
      ...v,
      routePrices: (v.routePrices || []).map((rp) => rp.routeId === routeId ? { ...rp, price } : rp),
    }));
  }

  // ── Wholesale ─────────────────────────────────────────────────────────────────
  function addWholesalePrice() {
    if (values.wholesalePrices.length >= 5) return;
    setValues((v) => ({ ...v, wholesalePrices: [...v.wholesalePrices, { price: '', quantity: '', margin: '' }] }));
  }
  function removeWholesalePrice(index) {
    setValues((v) => { const p = [...v.wholesalePrices]; p.splice(index, 1); return { ...v, wholesalePrices: p }; });
  }
  function updateWholesalePrice(index, field, value) {
    setValues((v) => {
      const p = [...v.wholesalePrices];
      const item = { ...p[index], [field]: value };
      const wholesaleBase = getWholesaleBasePrice(v.salePrice, v.purchasePrice);
      if (field === 'price'  && wholesaleBase) item.margin = calculateMarginFromSalePrice(wholesaleBase, value);
      if (field === 'margin' && wholesaleBase) item.price  = calculateSalePriceFromMargin(wholesaleBase, value);
      p[index] = item;
      return { ...v, wholesalePrices: p };
    });
  }

  // ── Validation ────────────────────────────────────────────────────────────────
  function validateValues() {
    if (!values.name || values.name.trim() === '') return { ok: false, msg: 'El nombre es obligatorio.' };
    if (values.purchasePrice && (Number.isNaN(Number(values.purchasePrice)) || Number(values.purchasePrice) < 0))
      return { ok: false, msg: 'Costo de compra inválido.' };
    if (values.salePrice && (Number.isNaN(Number(values.salePrice)) || Number(values.salePrice) < 0))
      return { ok: false, msg: 'Precio de venta inválido.' };
    if (values.bonuses && values.bonuses.length > 0) {
      if (values.bonuses.length > 5) return { ok: false, msg: 'Máximo 5 bonificaciones permitidas.' };
      const enabled = values.bonuses.map((b, i) => ({ ...b, _idx: i })).filter((b) => b.enabled);
      for (const b of enabled) {
        const n = b._idx + 1;
        if (!b.threshold || Number(b.threshold) <= 0) return { ok: false, msg: `Bonificación ${n}: la cantidad mínima debe ser mayor a 0.` };
        if (!b.bonusProductId) return { ok: false, msg: `Bonificación ${n}: selecciona un producto para la bonificación.` };
        if (!b.bonusQuantity || Number(b.bonusQuantity) <= 0) return { ok: false, msg: `Bonificación ${n}: la cantidad a regalar debe ser mayor a 0.` };
      }
    }
    return { ok: true };
  }

  // ── Save ──────────────────────────────────────────────────────────────────────
  async function handleSave() {
    const valCheck = validateValues();
    if (!valCheck.ok) { Alert.alert('Validación', valCheck.msg); return; }
    const currentUser = auth().currentUser;
    if (!currentUser?.email) { Alert.alert('Error', 'No se pudo obtener la información del usuario.'); return; }
    setSaving(true);
    try {
      const processedWholesale = values.wholesalePrices.map((wp) => ({ price: Number(wp.price), quantity: Number(wp.quantity) }));
      const bonusesPayload = (values.bonuses || [])
        .filter((b) => b && b.bonusProductId && Number(b.threshold) > 0 && Number(b.bonusQuantity) > 0)
        .map((b) => ({
          enabled: !!b.enabled,
          threshold: Number(b.threshold),
          bonusProductId: b.bonusProductId,
          bonusProductName: b.bonusProductName || '',
          bonusQuantity: Number(b.bonusQuantity),
        }));
      const payload = {
        name: values.name, barcode: values.barcode, category: normalizeCategory(values.category),
        description: values.description || '',
        purchasePrice: values.purchasePrice ? Number(values.purchasePrice) : 0,
        profitMargin:  values.profitMargin  ? Number(values.profitMargin)  : 0,
        salePrice:     values.salePrice     ? Number(values.salePrice)     : 0,
        measureType: values.measureType, wholesalePrices: processedWholesale, bonuses: bonusesPayload,
        routePrices: (values.routePrices || [])
          .filter((rp) => rp.routeId && Number(rp.price) > 0)
          .map((rp) => ({ routeId: rp.routeId, routeName: rp.routeName, price: Number(rp.price) })),
      };
      const firstActive = bonusesPayload.find((b) => b.enabled);
      if (firstActive) payload.bonus = firstActive;
      else if (bonusesPayload.length > 0) payload.bonus = bonusesPayload[0];

      await productsService.updateProduct(initialProduct.id, payload);
      const changes = buildUpdateChanges(initialProduct, payload);
      if (Object.keys(changes).length > 0) {
        await createProductOperation({ productId: initialProduct.id, productName: values.name, operationType: 'update', userEmail: currentUser.email, category: normalizeCategory(values.category), details: { description: 'Se actualizaron campos del producto.', changes } });
      }
      initialRef.current = JSON.stringify(values);
      Alert.alert('Éxito', 'Producto actualizado.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err) {
      console.error('Error actualizando producto:', err);
      if (isPermissionDeniedError(err)) Alert.alert('Permisos', 'No tienes permisos para actualizar este producto.');
      else Alert.alert('Error', 'No se pudo actualizar el producto.');
    } finally {
      setTimeout(() => { if (navigation.isFocused()) setSaving(false); }, 500);
    }
  }

  const hasChanges = useCallback(() => initialRef.current !== JSON.stringify(values), [values]);

  useFocusEffect(
    useCallback(() => {
      const onBeforeRemove = (e) => {
        if (!hasChanges() || saving) return;
        e.preventDefault();
        Alert.alert('Descartar cambios', '¿Deseas salir sin guardar?', [
          { text: 'Seguir editando', style: 'cancel' },
          { text: 'Salir', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ]);
      };
      navigation.addListener('beforeRemove', onBeforeRemove);
      return () => navigation.removeListener('beforeRemove', onBeforeRemove);
    }, [navigation, hasChanges, saving]),
  );

  function setField(field, value) { setValues((v) => ({ ...v, [field]: value })); }
  const handleBonusesChange = (data) => { setValues((prev) => ({ ...prev, bonuses: data })); };

  const goToManageCategories  = () => navigation.navigate('ManageCategories');
  const goToEditCategoryDiscounts = () => {
    if (selectedCategoryRow) navigation.navigate('CategoryForm', { category: selectedCategoryRow });
    else navigation.navigate('ManageCategories');
  };

  function handleTabChange(key) {
    setActiveTab(key);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#007AFF" /></View>;
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>

      {/* Header */}
      <View style={globalStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={globalStyles.title} numberOfLines={1}>{values.name}</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const badge =
            tab.key === 'bonuses'   ? enabledBonusesCount :
            tab.key === 'wholesale' ? wholesaleCount :
            tab.key === 'category'  ? (categorySet ? 1 : 0) :
            tab.key === 'routes'    ? routePricesCount : 0;
          return (
            <TouchableOpacity key={tab.key} style={[styles.tabItem, isActive && styles.tabItemActive]} onPress={() => handleTabChange(tab.key)}>
              <Icon name={tab.icon} size={17} color={isActive ? '#007AFF' : '#9CA3AF'} />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
              {badge > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{badge}</Text>
                </View>
              )}
              {isActive && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Panel Content */}
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* ━━━ Panel 1: Info & Precios ━━━ */}
        {activeTab === 'info' && (
          <>
            {/* Información Básica */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIconWrap}>
                  <Icon name="information-circle-outline" size={18} color="#007AFF" />
                </View>
                <Text style={styles.sectionTitle}>Información Básica</Text>
              </View>

              <Text style={styles.label}>Nombre del producto *</Text>
              <TextInput style={styles.input} value={values.name} onChangeText={(t) => setField('name', t)} placeholderTextColor={PLACEHOLDER_COLOR} />


              {/* Código + Unidad */}
              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>Código de barras</Text>
                  <View style={styles.inputWithIconContainer}>
                    <TextInput
                      style={[styles.inputNoBorder, { flex: 1 }]}
                      value={values.barcode}
                      onChangeText={(t) => setField('barcode', t)}
                      placeholderTextColor={PLACEHOLDER_COLOR}
                    />
                    <TouchableOpacity
                      onPress={() => navigation.navigate('BarcodeScanner', { onScanned: (code) => setField('barcode', code) })}
                      style={styles.iconButton}>
                      <Icon name="scan" size={20} color="#666" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.label}>Unidad</Text>
                  <View style={styles.toggleContainer}>
                    <TouchableOpacity style={[styles.toggleBtn, values.measureType === 'unit' && styles.toggleBtnActive]} onPress={() => setField('measureType', 'unit')}>
                      <Text style={[styles.toggleText, values.measureType === 'unit' && styles.toggleTextActive]}>Unid.</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.toggleBtn, values.measureType === 'weight' && styles.toggleBtnActive]} onPress={() => setField('measureType', 'weight')}>
                      <Text style={[styles.toggleText, values.measureType === 'weight' && styles.toggleTextActive]}>Peso</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <Text style={styles.label}>Descripción</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top', marginBottom: 0 }]}
                multiline
                value={values.description}
                onChangeText={(t) => setField('description', t)}
                placeholderTextColor={PLACEHOLDER_COLOR}
              />
            </View>

            {/* Precios y Costos */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconWrap, { backgroundColor: '#ECFDF5' }]}
                  >
                  <Icon name="cash-outline" size={18} color="#059669" />
                </View>
                <Text style={styles.sectionTitle}>Precios y Costos</Text>
              </View>

              {/* Summary card */}
              {(values.purchasePrice || values.salePrice) ? (
                <View style={styles.priceSummaryCard}>
                  <View style={styles.priceSummaryItem}>
                    <Icon name="arrow-down-circle-outline" size={14} color="#64748B" />
                    <Text style={styles.priceSummaryLabel}>Costo</Text>
                    <Text style={styles.priceSummaryCost}>C${values.purchasePrice || '—'}</Text>
                  </View>
                  <Icon name="arrow-forward" size={14} color="#CBD5E1" />
                  <View style={styles.priceSummaryItem}>
                    <Icon name="trending-up-outline" size={14} color="#64748B" />
                    <Text style={styles.priceSummaryLabel}>Margen</Text>
                    <Text style={styles.priceSummaryMargin}>{values.profitMargin ? `${values.profitMargin}%` : '—'}</Text>
                  </View>
                  <Icon name="arrow-forward" size={14} color="#CBD5E1" />
                  <View style={styles.priceSummaryItem}>
                    <Icon name="pricetag-outline" size={14} color="#64748B" />
                    <Text style={styles.priceSummaryLabel}>Venta</Text>
                    <Text style={styles.priceSummaryPrice}>C${values.salePrice || '—'}</Text>
                  </View>
                </View>
              ) : null}

              <Text style={styles.label}>Costo de Compra (C$)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={values.purchasePrice}
                onChangeText={(t) => handlePriceChange('purchasePrice', t)}
                placeholderTextColor={PLACEHOLDER_COLOR}
              />
              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>Margen (%)</Text>
                  <View style={styles.percentInputContainer}>
                    <TextInput
                      style={styles.percentInput}
                      keyboardType="numeric"
                      value={values.profitMargin}
                      onChangeText={(t) => handlePriceChange('profitMargin', t)}
                      placeholderTextColor={PLACEHOLDER_COLOR}
                    />
                    <Text style={styles.percentSymbol}>%</Text>
                  </View>
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.label}>Precio Venta (C$)</Text>
                  <TextInput
                    style={[styles.input, { fontWeight: 'bold', color: '#007AFF', marginBottom: 0 }]
                    }
                    keyboardType="numeric"
                    value={values.salePrice}
                    onChangeText={(t) => handlePriceChange('salePrice', t)}
                    placeholderTextColor={PLACEHOLDER_COLOR}
                  />
                </View>
              </View>
            </View>

            {/* Descuentos por Categoría — movido al tab Categoría */}
          </>
        )}

        {/* ━━━ Panel 2: Categoría ━━━ */}
        {activeTab === 'category' && (
          <>
            <View style={styles.panelHeaderCard}>
              <View style={[styles.panelHeaderIconWrap, { backgroundColor: '#F5F3FF' }]}>
                <Icon name="pricetag" size={26} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.panelHeaderTitle}>Categoría del Producto</Text>
                <Text style={styles.panelHeaderDesc}>
                  Asigna una categoría y revisa los descuentos automáticos que aplican por volumen en el carrito.
                </Text>
              </View>
            </View>

            {/* Selector */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconWrap, { backgroundColor: '#F5F3FF' }]}>
                  <Icon name="folder-outline" size={18} color="#7C3AED" />
                </View>
                <Text style={styles.sectionTitle}>Categoría Asignada</Text>
                <TouchableOpacity onPress={goToManageCategories} style={[styles.editDiscountsBtn, { borderColor: '#DDD6FE' }]}>
                  <Icon name="settings-outline" size={13} color="#7C3AED" />
                  <Text style={[styles.editDiscountsBtnText, { color: '#7C3AED' }]}>Gestionar</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.helperText}>
                Las categorías permiten agrupar productos y aplicar descuentos automáticos por volumen en el punto de venta.
              </Text>

              <TouchableOpacity
                style={[styles.categorySelector, values.category && { borderColor: '#7C3AED', borderWidth: 1.5 }]}
                onPress={() => { setCategorySearch(''); setCategoryModalVisible(true); }}>
                <Icon name="pricetag-outline" size={15} color={values.category ? '#7C3AED' : '#9CA3AF'} />
                <Text style={[styles.categorySelectorText, !values.category && styles.categorySelectorPlaceholder]}>
                  {values.category || 'Seleccionar categoría...'}
                </Text>
                <Icon name="chevron-down" size={15} color="#9CA3AF" />
              </TouchableOpacity>

              {values.category ? (
                <View style={styles.categoryChip}>
                  <Icon name="pricetag" size={13} color="#7C3AED" />
                  <Text style={styles.categoryChipText}>{values.category}</Text>
                </View>
              ) : (
                <View style={styles.categoryEmptyHint}>
                  <Icon name="information-circle-outline" size={14} color="#9CA3AF" />
                  <Text style={styles.categoryEmptyHintText}>Sin categoría asignada. Selecciona una o crea una desde "Gestionar".</Text>
                </View>
              )}
            </View>

            {/* Descuentos de categoría */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconWrap, { backgroundColor: '#EFF6FF' }]}>
                  <Icon name="pricetags-outline" size={18} color="#1D4ED8" />
                </View>
                <Text style={styles.sectionTitle}>Descuentos Automáticos</Text>
                {values.category && (
                  <TouchableOpacity style={styles.editDiscountsBtn} onPress={goToEditCategoryDiscounts}>
                    <Icon name="settings-outline" size={13} color="#1D4ED8" />
                    <Text style={styles.editDiscountsBtnText}>Editar</Text>
                  </TouchableOpacity>
                )}
              </View>

              {!values.category ? (
                <View style={styles.noDiscountsBox}>
                  <Icon name="pricetag-outline" size={32} color="#D1D5DB" />
                  <Text style={styles.noDiscountsText}>Asigna una categoría para ver sus descuentos automáticos.</Text>
                </View>
              ) : categoriesLoading ? (
                <ActivityIndicator size="small" color="#007AFF" style={{ marginVertical: 16 }} />
              ) : discountTiers.length > 0 ? (
                <>
                  <Text style={styles.helperText}>
                    Se aplican automáticamente según las unidades totales de "{values.category}" en el carrito.
                  </Text>
                  {discountTiers.map((tier) => {
                    const isPercent = tier.discountType === 'percent';
                    const hasValue  = Number(tier.discountValue || 0) > 0;
                    return (
                      <View key={tier.minQty} style={styles.tierRow}>
                        <View style={styles.tierRowLeft}>
                          <Icon name="pricetag-outline" size={13} color={hasValue ? '#1D4ED8' : '#9CA3AF'} />
                          <Text style={styles.tierRowLabel}>
                            A partir de <Text style={{ fontWeight: '800' }}>{tier.minQty}</Text> unid.
                          </Text>
                        </View>
                        {hasValue ? (
                          <View style={[styles.tierBadge, isPercent ? styles.tierBadgePercent : styles.tierBadgeAmount]}>
                            <Text style={[styles.tierBadgeText, isPercent ? styles.tierBadgePercentText : styles.tierBadgeAmountText]}>
                              {isPercent ? `-${tier.discountValue}%` : `-C$${tier.discountValue}`}
                            </Text>
                          </View>
                        ) : (
                          <Text style={styles.tierNoValue}>Sin valor</Text>
                        )}
                      </View>
                    );
                  })}
                </>
              ) : selectedCategoryRow ? (
                <View style={styles.noDiscountsBox}>
                  <Icon name="pricetags-outline" size={32} color="#D1D5DB" />
                  <Text style={styles.noDiscountsText}>
                    La categoría "{values.category}" no tiene descuentos configurados.
                  </Text>
                  <TouchableOpacity style={styles.addDiscountsBtn} onPress={goToEditCategoryDiscounts}>
                    <Icon name="add-circle-outline" size={14} color="#2563EB" />
                    <Text style={styles.addDiscountsBtnText}>Configurar descuentos</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.noDiscountsBox}>
                  <Icon name="alert-circle-outline" size={32} color="#FCD34D" />
                  <Text style={styles.noDiscountsText}>
                    La categoría "{values.category}" no está en el catálogo. Selecciónala o créala en Gestionar.
                  </Text>
                  <TouchableOpacity style={styles.addDiscountsBtn} onPress={goToManageCategories}>
                    <Icon name="settings-outline" size={14} color="#2563EB" />
                    <Text style={styles.addDiscountsBtnText}>Ir a Gestionar categorías</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </>
        )}

        {/* ━━━ Panel 3: Bonificaciones ━━━ */}
        {activeTab === 'bonuses' && (
          <>
            <View style={styles.panelHeaderCard}>
              <View style={[styles.panelHeaderIconWrap, { backgroundColor: '#FFF7ED' }]}
                >
                <Icon name="gift" size={26} color="#EA580C" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.panelHeaderTitle}>Bonificaciones</Text>
                <Text style={styles.panelHeaderDesc}>
                  Configura productos que se regalan al alcanzar una cantidad mínima de compra.
                </Text>
              </View>
            </View>
            <BonusSetup bonuses={values.bonuses} onChange={handleBonusesChange} />
            {values.bonuses.length === 0 && (
              <View style={styles.emptyStateCard}>
                <Icon name="gift-outline" size={44} color="#D1D5DB" />
                <Text style={styles.emptyStateTitle}>Sin bonificaciones</Text>
                <Text style={styles.emptyStateDesc}>Usa el botón "+" arriba para agregar una bonificación a este producto.</Text>
              </View>
            )}
          </>
        )}

        {/* ━━━ Panel 3: Mayoristas ━━━ */}
        {activeTab === 'wholesale' && (
          <>
            <View style={styles.panelHeaderCard}>
              <View style={[styles.panelHeaderIconWrap, { backgroundColor: '#F0FDF4' }]}
                >
                <Icon name="people" size={26} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.panelHeaderTitle}>Precios Mayorista</Text>
                <Text style={styles.panelHeaderDesc}>
                  Define precios especiales al comprar por volumen. Se aplican automáticamente en el punto de venta.
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconWrap, { backgroundColor: '#F0FDF4' }]}
                  >
                  <Icon name="layers-outline" size={18} color="#16A34A" />
                </View>
                <Text style={styles.sectionTitle}>Niveles de Precio</Text>
                {values.wholesalePrices.length < 5 && (
                  <TouchableOpacity onPress={addWholesalePrice} style={styles.addBtn}>
                    <Icon name="add" size={16} color="#fff" />
                    <Text style={styles.addBtnText}>Agregar</Text>
                  </TouchableOpacity>
                )}
              </View>

              {values.wholesalePrices.length > 0 ? (
                values.wholesalePrices.map((wp, index) => (
                  <View key={index} style={styles.wholesaleCard}>
                    <View style={styles.wholesaleCardHeader}>
                      <View style={styles.wholesaleCardBadge}>
                        <Text style={styles.wholesaleCardBadgeText}>Nivel {index + 1}</Text>
                      </View>
                      <TouchableOpacity onPress={() => removeWholesalePrice(index)} style={styles.deleteButton}>
                        <Icon name="trash-outline" size={18} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: 'row', marginTop: 8 }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.subLabel}>Cant. Mín.</Text>
                        <TextInput style={styles.inputSmall} keyboardType="numeric" value={String(wp.quantity)} onChangeText={(t) => updateWholesalePrice(index, 'quantity', t)} placeholderTextColor={PLACEHOLDER_COLOR} />
                      </View>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.subLabel}>Margen %</Text>
                        <TextInput style={styles.inputSmall} keyboardType="numeric" value={String(wp.margin)} onChangeText={(t) => updateWholesalePrice(index, 'margin', t)} placeholderTextColor={PLACEHOLDER_COLOR} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.subLabel}>Precio C$</Text>
                        <TextInput style={[styles.inputSmall, { color: '#007AFF', fontWeight: '700' }]} keyboardType="numeric" value={String(wp.price)} onChangeText={(t) => updateWholesalePrice(index, 'price', t)} placeholderTextColor={PLACEHOLDER_COLOR} />
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyStateCard}>
                  <Icon name="layers-outline" size={44} color="#D1D5DB" />
                  <Text style={styles.emptyStateTitle}>Sin precios mayorista</Text>
                  <Text style={styles.emptyStateDesc}>Toca "Agregar" para añadir un nivel de precio por volumen.</Text>
                </View>
              )}

              {values.wholesalePrices.length > 0 && (
                <View style={styles.wholesaleTip}>
                  <Icon name="information-circle-outline" size={14} color="#64748B" />
                  <Text style={styles.wholesaleTipText}>Los precios se ordenan por cantidad mínima automáticamente en las ventas.</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* ━━━ Panel 5: Precios por Ruta ━━━ */}
        {activeTab === 'routes' && (
          <>
            <View style={styles.panelHeaderCard}>
              <View style={[styles.panelHeaderIconWrap, { backgroundColor: '#F0FDF4' }]}>
                <Icon name="navigate" size={26} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.panelHeaderTitle}>Precios por Ruta</Text>
                <Text style={styles.panelHeaderDesc}>
                  Define un precio especial para cada ruta de ventas. Se aplica automáticamente cuando el vendedor tiene esa ruta activa.
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconWrap, { backgroundColor: '#F5F3FF' }]}>
                  <Icon name="navigate-outline" size={18} color="#7C3AED" />
                </View>
                <Text style={styles.sectionTitle}>Rutas Configuradas</Text>
                {routesAvailableToAdd.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setShowRouteSelector((v) => !v)}
                    style={[styles.addBtn, { backgroundColor: '#7C3AED' }]}>
                    <Icon name={showRouteSelector ? 'close' : 'add'} size={16} color="#fff" />
                    <Text style={styles.addBtnText}>{showRouteSelector ? 'Cerrar' : 'Agregar'}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {showRouteSelector && (
                <View style={styles.routeSelectorBox}>
                  <Text style={styles.routeSelectorTitle}>Selecciona una ruta:</Text>
                  {routesLoading ? (
                    <ActivityIndicator size="small" color="#7C3AED" style={{ marginVertical: 8 }} />
                  ) : routesAvailableToAdd.length === 0 ? (
                    <Text style={styles.emptyText}>Todas las rutas ya están configuradas.</Text>
                  ) : (
                    routesAvailableToAdd.map((r) => (
                      <TouchableOpacity
                        key={r.id}
                        style={styles.routeSelectorItem}
                        onPress={() => addRoutePrice(r)}>
                        <View style={styles.routeSelectorItemLeft}>
                          <Icon name="location" size={15} color="#7C3AED" />
                          <View>
                            <Text style={styles.routeSelectorName}>{r.name}</Text>
                            {(r.start || r.end) && (
                              <Text style={styles.routeSelectorSub}>{r.start} → {r.end}</Text>
                            )}
                          </View>
                        </View>
                        <Icon name="add-circle-outline" size={20} color="#7C3AED" />
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}

              {(values.routePrices || []).length > 0 ? (
                (values.routePrices || []).map((rp) => (
                  <View key={rp.routeId} style={styles.routePriceCard}>
                    <View style={styles.routePriceCardHeader}>
                      <View style={styles.routePriceCardLeft}>
                        <View style={styles.routePriceIconBox}>
                          <Icon name="location" size={16} color="#7C3AED" />
                        </View>
                        <Text style={styles.routePriceRouteName} numberOfLines={1}>{rp.routeName}</Text>
                      </View>
                      <TouchableOpacity onPress={() => removeRoutePrice(rp.routeId)} style={styles.deleteButton}>
                        <Icon name="trash-outline" size={18} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.routePriceInputRow}>
                      <Text style={styles.subLabel}>Precio especial (C$)</Text>
                      <View style={styles.routePriceInputWrap}>
                        <Text style={styles.routePriceCurrencySymbol}>C$</Text>
                        <TextInput
                          style={styles.routePriceInput}
                          keyboardType="numeric"
                          placeholder="0.00"
                          placeholderTextColor={PLACEHOLDER_COLOR}
                          value={String(rp.price)}
                          onChangeText={(t) => updateRoutePriceValue(rp.routeId, t)}
                        />
                      </View>
                      {values.salePrice && Number(rp.price) > 0 && (
                        <Text style={styles.routePriceDiff}>
                          {Number(rp.price) < Number(values.salePrice)
                            ? `↓ C$${(Number(values.salePrice) - Number(rp.price)).toFixed(2)} menos que precio regular`
                            : Number(rp.price) > Number(values.salePrice)
                              ? `↑ C$${(Number(rp.price) - Number(values.salePrice)).toFixed(2)} más que precio regular`
                              : '= Igual al precio regular'}
                        </Text>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyStateCard}>
                  <Icon name="navigate-outline" size={44} color="#D1D5DB" />
                  <Text style={styles.emptyStateTitle}>Sin precios por ruta</Text>
                  <Text style={styles.emptyStateDesc}>
                    Toca "Agregar" para asignar un precio especial a una ruta de ventas.
                  </Text>
                </View>
              )}

              {(values.routePrices || []).length > 0 && (
                <View style={styles.wholesaleTip}>
                  <Icon name="information-circle-outline" size={14} color="#7C3AED" />
                  <Text style={[styles.wholesaleTipText, { color: '#7C3AED' }]}>
                    El precio de ruta reemplaza el precio regular cuando el vendedor tiene esa ruta activa. Descuentos de mayoreo y categoría siguen aplicando sobre él.
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Bottom Save Button — siempre fijo */}
      <View style={[styles.bottomContainer, { paddingBottom: bottomPadding }]}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : (
              <>
                <Icon name="save-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.saveBtnText}>Actualizar Producto</Text>
              </>
            )}
        </TouchableOpacity>
      </View>

      {/* Modal de selección de categoría */}
      <Modal
        animationType="slide"
        transparent
        visible={categoryModalVisible}
        onRequestClose={() => setCategoryModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCategoryModalVisible(false)}>
          <TouchableOpacity style={styles.categoryModal} activeOpacity={1} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.categoryModalTitle}>Seleccionar Categoría</Text>
              <TouchableOpacity onPress={() => setCategoryModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="close" size={22} color="#374151" />
              </TouchableOpacity>
            </View>
            <View style={styles.searchBox}>
              <Icon name="search-outline" size={16} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                value={categorySearch}
                onChangeText={setCategorySearch}
                placeholder="Buscar categoría..."
                placeholderTextColor="#9CA3AF"
                autoFocus
              />
              {categorySearch ? (
                <TouchableOpacity onPress={() => setCategorySearch('')}>
                  <Icon name="close-circle" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              ) : null}
            </View>
            <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
              {categoriesLoading ? (
                <ActivityIndicator style={{ marginTop: 16 }} color="#007AFF" />
              ) : filteredCategories.length === 0 ? (
                <Text style={styles.emptyText}>No se encontraron categorías.</Text>
              ) : (
                filteredCategories.map((row) => {
                  const isSelected = normalizeCategory(values?.category).toLowerCase() === normalizeCategory(row.name).toLowerCase();
                  const tiers = Array.isArray(row.discountTiers) ? row.discountTiers : [];
                  return (
                    <TouchableOpacity
                      key={row.id}
                      style={[styles.categoryListItem, isSelected && styles.categoryListItemActive]}
                      onPress={() => { setField('category', row.name); setCategoryModalVisible(false); }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.categoryListText, isSelected && styles.categoryListTextActive]}>{row.name}</Text>
                        {tiers.length > 0 && (
                          <Text style={styles.categoryListSub}>{tiers.length} nivel{tiers.length !== 1 ? 'es' : ''} de descuento</Text>
                        )}
                      </View>
                      {isSelected && <Icon name="checkmark-circle" size={18} color="#007AFF" />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.manageFromModalBtn}
              onPress={() => { setCategoryModalVisible(false); goToManageCategories(); }}>
              <Icon name="settings-outline" size={14} color="#1D4ED8" />
              <Text style={styles.manageFromModalText}>Gestionar categorías y descuentos</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F5F6FA' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // ── Tab Bar ──────────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3, position: 'relative' },
  tabItemActive: { backgroundColor: '#F0F7FF' },
  tabLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', textAlign: 'center' },
  tabLabelActive: { color: '#007AFF', fontWeight: '700' },
  tabBadge: {
    position: 'absolute', top: 6, right: 10,
    backgroundColor: '#FF3B30', borderRadius: 8, minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  tabBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  tabIndicator: { position: 'absolute', bottom: 0, left: '15%', right: '15%', height: 3, backgroundColor: '#007AFF', borderRadius: 2 },

  // ── Scroll & Sections ────────────────────────────────────────────────────────
  scrollContent: { padding: 16, paddingBottom: 16 },
  section: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  sectionIconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A2E', flex: 1 },

  // ── Panel Header Cards ───────────────────────────────────────────────────────
  panelHeaderCard: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff',
    borderRadius: 16, padding: 16, marginBottom: 12, gap: 12,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  panelHeaderIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  panelHeaderTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A2E', marginBottom: 4 },
  panelHeaderDesc: { fontSize: 12, color: '#64748B', lineHeight: 17 },

  // ── Price Summary Card ───────────────────────────────────────────────────────
  priceSummaryCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  priceSummaryItem: { flex: 1, alignItems: 'center', gap: 3 },
  priceSummaryLabel: { fontSize: 10, color: '#64748B', fontWeight: '600', textTransform: 'uppercase' },
  priceSummaryCost:   { fontSize: 14, fontWeight: '700', color: '#334155' },
  priceSummaryMargin: { fontSize: 14, fontWeight: '700', color: '#7C3AED' },
  priceSummaryPrice:  { fontSize: 14, fontWeight: '800', color: '#059669' },

  // ── Inputs ───────────────────────────────────────────────────────────────────
  label: { fontSize: 11, color: '#666', marginBottom: 6, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  subLabel: { fontSize: 11, color: '#888', marginBottom: 4, fontWeight: '600' },
  helperText: { fontSize: 12, color: '#64748B', marginBottom: 12, lineHeight: 17 },
  input: { backgroundColor: '#F5F6FA', padding: 12, borderRadius: 10, fontSize: 15, color: '#333', marginBottom: 14, borderWidth: 1, borderColor: '#F0F0F0' },
  inputWithIconContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F6FA', borderRadius: 10, borderWidth: 1, borderColor: '#F0F0F0', marginBottom: 14, paddingRight: 8 },
  inputNoBorder: { padding: 12, fontSize: 15, color: '#333' },
  iconButton: { padding: 8 },
  inputSmall: { backgroundColor: '#F5F6FA', padding: 10, borderRadius: 8, fontSize: 14, color: '#333', borderWidth: 1, borderColor: '#eee' },
  rowInputs: { flexDirection: 'row', marginBottom: 0 },
  percentInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F6FA', borderRadius: 10, borderWidth: 1, borderColor: '#F0F0F0', paddingRight: 12, marginBottom: 14 },
  percentInput: { flex: 1, padding: 12, fontSize: 15, color: '#333' },
  percentSymbol: { fontSize: 15, color: '#999', fontWeight: 'bold' },
  toggleContainer: { flexDirection: 'row', backgroundColor: '#F0F0F0', borderRadius: 10, padding: 3, marginBottom: 14, height: 46 },
  toggleBtn: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  toggleBtnActive: { backgroundColor: '#fff', elevation: 2 },
  toggleText: { fontSize: 13, color: '#888', fontWeight: '600' },
  toggleTextActive: { color: '#007AFF', fontWeight: '700' },

  // ── Categoría ────────────────────────────────────────────────────────────────
  categoryHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linkText: { color: '#007AFF', fontWeight: '700', fontSize: 12, marginBottom: 8 },
  categorySelector: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F6FA',
    borderRadius: 10, borderWidth: 1, borderColor: '#F0F0F0', paddingHorizontal: 12, paddingVertical: 13, marginBottom: 14, gap: 8,
  },
  categorySelectorText: { flex: 1, fontSize: 15, color: '#333', fontWeight: '600' },
  categorySelectorPlaceholder: { color: '#9CA3AF', fontWeight: '400' },

  // ── Descuentos de categoría ──────────────────────────────────────────────────
  editDiscountsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#BFDBFE' },
  editDiscountsBtnText: { color: '#1D4ED8', fontSize: 12, fontWeight: '700' },
  tierRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tierRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  tierRowLabel: { fontSize: 13, color: '#374151' },
  tierBadge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 },
  tierBadgePercent: { backgroundColor: '#EFF6FF' },
  tierBadgeAmount: { backgroundColor: '#ECFDF5' },
  tierBadgeText: { fontSize: 12, fontWeight: '800' },
  tierBadgePercentText: { color: '#1D4ED8' },
  tierBadgeAmountText: { color: '#059669' },
  tierNoValue: { fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' },
  noDiscountsBox: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  noDiscountsText: { fontSize: 12, color: '#6B7280', textAlign: 'center', lineHeight: 17 },
  addDiscountsBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#BFDBFE', marginTop: 4 },
  addDiscountsBtnText: { color: '#2563EB', fontSize: 12, fontWeight: '700' },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#F5F3FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#DDD6FE', marginBottom: 4 },
  categoryChipText: { fontSize: 13, fontWeight: '700', color: '#7C3AED' },
  categoryEmptyHint: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  categoryEmptyHintText: { flex: 1, fontSize: 12, color: '#6B7280', lineHeight: 17 },

  // ── Wholesale Cards ──────────────────────────────────────────────────────────
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#007AFF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, gap: 3 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  wholesaleCard: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  wholesaleCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wholesaleCardBadge: { backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  wholesaleCardBadgeText: { color: '#16A34A', fontSize: 11, fontWeight: '800' },
  deleteButton: { padding: 4 },
  wholesaleTip: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  wholesaleTipText: { flex: 1, fontSize: 11, color: '#64748B', lineHeight: 16 },

  // ── Empty States ─────────────────────────────────────────────────────────────
  emptyStateCard: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyStateTitle: { fontSize: 15, fontWeight: '700', color: '#9CA3AF' },
  emptyStateDesc: { fontSize: 12, color: '#C4C9D4', textAlign: 'center', lineHeight: 18, maxWidth: 240 },
  emptyText: { fontSize: 13, color: '#999', fontStyle: 'italic', textAlign: 'center', marginTop: 10 },

  // ── Bottom save ──────────────────────────────────────────────────────────────
  bottomContainer: {
    padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee',
    elevation: 8, shadowColor: '#000',
    shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: -3 },
  },
  saveBtn: {
    backgroundColor: '#007AFF', borderRadius: 14, paddingVertical: 16, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', elevation: 4,
    shadowColor: '#007AFF', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 3 },
  },
  saveBtnDisabled: { backgroundColor: '#A0A0A0', elevation: 0 },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },

  // ── Route Prices ──────────────────────────────────────────────────────────────
  routeSelectorBox: {
    backgroundColor: '#F5F3FF', borderRadius: 12, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#DDD6FE',
  },
  routeSelectorTitle: { fontSize: 12, fontWeight: '700', color: '#7C3AED', marginBottom: 8 },
  routeSelectorItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#EDE9FE',
  },
  routeSelectorItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  routeSelectorName: { fontSize: 14, fontWeight: '600', color: '#374151' },
  routeSelectorSub: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  routePriceCard: {
    backgroundColor: '#F5F3FF', borderRadius: 12, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: '#DDD6FE',
  },
  routePriceCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  routePriceCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  routePriceIconBox: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' },
  routePriceRouteName: { fontSize: 14, fontWeight: '700', color: '#4C1D95', flex: 1 },
  routePriceInputRow: { gap: 4 },
  routePriceInputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 8, borderWidth: 1.5, borderColor: '#7C3AED',
    paddingHorizontal: 10, height: 44, gap: 6,
  },
  routePriceCurrencySymbol: { fontSize: 14, fontWeight: '700', color: '#7C3AED' },
  routePriceInput: { flex: 1, fontSize: 16, fontWeight: '700', color: '#4C1D95' },
  routePriceDiff: { fontSize: 11, color: '#6B7280', marginTop: 4, fontStyle: 'italic' },

  // ── Modal ────────────────────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.40)', justifyContent: 'flex-end' },
  categoryModal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  categoryModalTitle: { fontSize: 16, fontWeight: '800', color: '#111' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F5F6FA', borderRadius: 10, borderWidth: 1, borderColor: '#E8E8E8', paddingHorizontal: 12, paddingVertical: 9, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, color: '#333' },
  categoryListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', borderRadius: 8, gap: 8 },
  categoryListItemActive: { backgroundColor: '#EFF6FF' },
  categoryListText: { fontSize: 14, color: '#263238', fontWeight: '600' },
  categoryListTextActive: { color: '#007AFF' },
  categoryListSub: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  manageFromModalBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F0F0F0', marginTop: 4 },
  manageFromModalText: { color: '#1D4ED8', fontSize: 13, fontWeight: '700' },
});
