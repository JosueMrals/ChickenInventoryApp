import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import Icon from 'react-native-vector-icons/Ionicons';

import globalStyles from '../../../styles/globalStyles';
import productsService from '../services/productsService';
import { createProductOperation } from '../../../services/operations/productOperations';
import BonusSetup from '../components/BonusSetup';
import { normalizeCategory } from '../constants/productCategories';
import { useProductCategories } from '../hooks/useProductCategories';
import { useRoutes } from '../hooks/useRoutes';
import { buildCreateChanges } from '../utils/operationChanges';
import { useAdaptiveBottom } from '../../../hooks/useAdaptiveBottom';

const PLACEHOLDER_COLOR = '#9CA3AF';
const PRODUCT_DISCOUNT_TYPES = [
  { key: 'percent', label: '%', placeholder: '%' },
  { key: 'amount', label: 'C$', placeholder: 'C$' },
];

const TABS = [
  { key: 'info',      label: 'Info & Precios',  icon: 'document-text-outline' },
  { key: 'category',  label: 'Categoría',        icon: 'pricetag-outline'      },
  { key: 'bonuses',   label: 'Bonificaciones',  icon: 'gift-outline'          },
  { key: 'wholesale', label: 'Mayoristas',       icon: 'people-outline'        },
  { key: 'routes',    label: 'P. x Ruta',        icon: 'navigate-outline'      },
];

function buildProductCategoryDiscountRule(minQty, source = null) {
  return {
    minQty,
    discountType: source?.discountType || 'percent',
    discountValue: source?.discountValue ? String(source.discountValue) : '',
    active: true,
  };
}

export default function AddProductScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { scannedCode } = route.params || {};

  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('info');

  const [values, setValues] = useState({
    name: '',
    barcode: '',
    category: '',
    description: '',
    purchasePrice: '',
    profitMargin: '',
    autoSalePrice: true,
    salePrice: '',
    measureType: 'unit',
    wholesalePrices: [],
    initialStock: '',
    bonuses: [],
    categoryDiscountRules: [],
    routePrices: [],
  });

  const initialRef   = useRef(JSON.stringify(values));
  const scrollRef    = useRef(null);
  const inputsRef    = useRef({});
  const assignRef    = (field) => (r) => { inputsRef.current[field] = r; };

  const { categoryRows, categories } = useProductCategories();
  const { routes: availableRoutes, loading: routesLoading } = useRoutes();
  const { bottomPadding } = useAdaptiveBottom();

  // ── Derived ──────────────────────────────────────────────────────────────────
  const categoryOptions = useMemo(() => {
    const merged = new Set(categories);
    const current = normalizeCategory(values.category);
    if (current) merged.add(current);
    return Array.from(merged).sort((a, b) => a.localeCompare(b));
  }, [categories, values.category]);

  const categoryActivationRules = useMemo(() => {
    const selectedCategory = normalizeCategory(values.category).toLowerCase();
    if (!selectedCategory) return [];
    const row = categoryRows.find((item) => normalizeCategory(item?.name).toLowerCase() === selectedCategory);
    const rules = Array.isArray(row?.activationRules) ? row.activationRules : [];
    return rules
      .map((rule) => Math.max(1, Math.floor(Number(rule?.minQty || 0))))
      .filter((qty) => qty > 0)
      .sort((a, b) => a - b);
  }, [categoryRows, values.category]);

  // Tab badge counts
  const enabledBonusesCount = useMemo(
    () => (values.bonuses || []).filter((b) => b.enabled).length,
    [values.bonuses],
  );
  const wholesaleCount = values.wholesalePrices.length;
  const categorySet    = !!normalizeCategory(values.category);
  const routePricesCount = values.routePrices.length;

  // ── Category autocomplete ─────────────────────────────────────────────────────
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);

  const categorySuggestions = useMemo(() => {
    const q = (values.category || '').trim().toLowerCase();
    // Usar las categorías del catálogo (excluyendo la que ya está exactamente escrita)
    const allCats = categoryRows
      .filter((r) => r.active !== false)
      .map((r) => r.name)
      .sort((a, b) => a.localeCompare(b));
    if (!q) return allCats.slice(0, 8);
    return allCats
      .filter((c) => c.toLowerCase().includes(q) && c.toLowerCase() !== q)
      .slice(0, 8);
  }, [categoryRows, values.category]);

  // ── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    setValues((prev) => {
      const activationSet = new Set(categoryActivationRules);
      const currentRules = Array.isArray(prev.categoryDiscountRules) ? prev.categoryDiscountRules : [];
      if (activationSet.size === 0) {
        if (currentRules.length === 0) return prev;
        return { ...prev, categoryDiscountRules: [] };
      }
      const byQty = currentRules.reduce((acc, rule) => {
        const qty = Math.max(1, Math.floor(Number(rule?.minQty || 0)));
        if (!qty) return acc;
        acc[qty] = rule;
        return acc;
      }, {});
      const nextRules = categoryActivationRules.map((minQty) => buildProductCategoryDiscountRule(minQty, byQty[minQty]));
      return { ...prev, categoryDiscountRules: nextRules };
    });
  }, [categoryActivationRules]);

  const getWholesaleBasePrice = useCallback((salePrice, purchasePrice = '') => {
    const sale = Number(salePrice);
    if (Number.isFinite(sale) && sale > 0) return sale;
    const cost = Number(purchasePrice);
    if (Number.isFinite(cost) && cost > 0) return cost;
    return null;
  }, []);

  useEffect(() => {
    if (scannedCode) setValues((prev) => ({ ...prev, barcode: scannedCode }));
  }, [scannedCode]);

  // ── Price helpers ─────────────────────────────────────────────────────────────
  const calculateSalePriceFromMargin = (cost, margin) => {
    if (!cost || !margin || margin >= 100) return '';
    const c = Number(cost); const m = Number(margin);
    if (Number.isNaN(c) || Number.isNaN(m)) return '';
    return (c / (1 - (m / 100))).toFixed(2);
  };

  const calculateMarginFromSalePrice = (cost, sale) => {
    if (!cost || !sale) return '';
    const c = Number(cost); const s = Number(sale);
    if (Number.isNaN(c) || Number.isNaN(s) || s === 0) return '';
    return (((1 - (c / s)) * 100)).toFixed(2);
  };

  const handlePriceChange = (field, text) => {
    setValues((prev) => {
      const newValues = { ...prev, [field]: text };
      if (field === 'purchasePrice') {
        if (newValues.autoSalePrice && newValues.profitMargin) {
          newValues.salePrice = calculateSalePriceFromMargin(text, newValues.profitMargin);
        } else if (!newValues.autoSalePrice && newValues.salePrice) {
          newValues.profitMargin = calculateMarginFromSalePrice(text, newValues.salePrice);
        }
        const wholesaleBase = getWholesaleBasePrice(newValues.salePrice, text);
        newValues.wholesalePrices = prev.wholesalePrices.map((wp) => {
          if (wp.price && wholesaleBase) return { ...wp, margin: calculateMarginFromSalePrice(wholesaleBase, wp.price) };
          return wp;
        });
      }
      if (field === 'profitMargin') {
        if (newValues.purchasePrice) newValues.salePrice = calculateSalePriceFromMargin(newValues.purchasePrice, text);
        const wholesaleBase = getWholesaleBasePrice(newValues.salePrice, newValues.purchasePrice);
        newValues.wholesalePrices = prev.wholesalePrices.map((wp) => {
          if (wp.price && wholesaleBase) return { ...wp, margin: calculateMarginFromSalePrice(wholesaleBase, wp.price) };
          return wp;
        });
      }
      if (field === 'salePrice') {
        if (newValues.purchasePrice) newValues.profitMargin = calculateMarginFromSalePrice(newValues.purchasePrice, text);
        const wholesaleBase = getWholesaleBasePrice(text, newValues.purchasePrice);
        newValues.wholesalePrices = prev.wholesalePrices.map((wp) => {
          if (wp.price && wholesaleBase) return { ...wp, margin: calculateMarginFromSalePrice(wholesaleBase, wp.price) };
          return wp;
        });
      }
      return newValues;
    });
  };

  // ── Route Prices helpers ──────────────────────────────────────────────────────
  const [showRouteSelector, setShowRouteSelector] = useState(false);

  const routesAvailableToAdd = useMemo(() => {
    const usedIds = new Set((values.routePrices || []).map((rp) => rp.routeId));
    return availableRoutes.filter((r) => !usedIds.has(r.id));
  }, [availableRoutes, values.routePrices]);

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

  // ── Wholesale helpers ─────────────────────────────────────────────────────────
  function addWholesalePrice() {
    if (values.wholesalePrices.length >= 5) { Alert.alert('Límite alcanzado', 'Máximo 5 precios de mayorista.'); return; }
    setValues((v) => ({ ...v, wholesalePrices: [...v.wholesalePrices, { price: '', quantity: '', margin: '' }] }));
  }
  function removeWholesalePrice(index) {
    setValues((v) => {
      const newPrices = [...v.wholesalePrices];
      newPrices.splice(index, 1);
      return { ...v, wholesalePrices: newPrices };
    });
  }
  function updateWholesalePrice(index, field, value) {
    setValues((v) => {
      const newPrices = [...v.wholesalePrices];
      const currentItem = { ...newPrices[index], [field]: value };
      const wholesaleBase = getWholesaleBasePrice(v.salePrice, v.purchasePrice);
      if (field === 'price' && wholesaleBase) {
        currentItem.margin = calculateMarginFromSalePrice(wholesaleBase, value);
      } else if (field === 'margin' && wholesaleBase) {
        currentItem.price = calculateSalePriceFromMargin(wholesaleBase, value);
      }
      newPrices[index] = currentItem;
      return { ...v, wholesalePrices: newPrices };
    });
  }

  function updateCategoryDiscountRule(minQty, patch) {
    setValues((prev) => {
      const currentRules = Array.isArray(prev.categoryDiscountRules) ? prev.categoryDiscountRules : [];
      const nextRules = currentRules.map((rule) => {
        const qty = Math.max(1, Math.floor(Number(rule?.minQty || 0)));
        if (qty !== minQty) return rule;
        return { ...rule, ...patch, minQty: qty };
      });
      return { ...prev, categoryDiscountRules: nextRules };
    });
  }

  // ── Validation ────────────────────────────────────────────────────────────────
  function validateValues() {
    if (!values.name || values.name.trim() === '') return { ok: false, msg: 'El nombre es obligatorio.' };
    if (values.purchasePrice && (Number.isNaN(Number(values.purchasePrice)) || Number(values.purchasePrice) < 0)) return { ok: false, msg: 'Costo de compra inválido.' };
    if (values.salePrice && (Number.isNaN(Number(values.salePrice)) || Number(values.salePrice) < 0)) return { ok: false, msg: 'Precio de venta inválido.' };
    if (values.initialStock && (Number.isNaN(Number(values.initialStock)) || Number(values.initialStock) < 0)) return { ok: false, msg: 'El stock inicial es inválido.' };
    if (Array.isArray(values.categoryDiscountRules)) {
      for (const rule of values.categoryDiscountRules) {
        const discountValue = Number(rule?.discountValue || 0);
        const discountType = String(rule?.discountType || '').toLowerCase();
        if (!discountValue) continue;
        if (!['percent', 'amount'].includes(discountType)) return { ok: false, msg: 'Tipo de descuento por categoria invalido.' };
        if (!Number.isFinite(discountValue) || discountValue <= 0) return { ok: false, msg: 'El descuento por categoria debe ser mayor a 0.' };
      }
    }
    if (values.bonuses && values.bonuses.length > 0) {
      if (values.bonuses.length > 5) return { ok: false, msg: 'Máximo 5 bonificaciones permitidas.' };
      const enabledBonuses = values.bonuses.map((b, i) => ({ ...b, _idx: i })).filter((b) => b.enabled);
      for (const b of enabledBonuses) {
        const idxDisplay = b._idx + 1;
        if (!b.threshold || Number(b.threshold) <= 0) return { ok: false, msg: `Bonificación ${idxDisplay}: la 'cantidad mínima' debe ser mayor a 0.` };
        if (!b.bonusProductId) return { ok: false, msg: `Bonificación ${idxDisplay}: debe seleccionar un producto a regalar.` };
        if (!b.bonusQuantity || Number(b.bonusQuantity) <= 0) return { ok: false, msg: `Bonificación ${idxDisplay}: la 'cantidad a regalar' debe ser mayor a 0.` };
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
      const checkRes = await productsService.validateNoDuplicates({ name: values.name, barcode: values.barcode || null });
      if (!checkRes.ok) { Alert.alert('Duplicado', checkRes.message || 'El producto ya existe.'); setSaving(false); return; }
      const processedWholesale = values.wholesalePrices.map((wp) => ({ price: Number(wp.price), quantity: Number(wp.quantity) }));
      const initialStock = Number(values.initialStock) || 0;
      const productCategoryDiscountRules = (values.categoryDiscountRules || [])
        .map((rule) => ({ minQty: Math.max(1, Math.floor(Number(rule?.minQty || 0))), discountType: String(rule?.discountType || '').toLowerCase(), discountValue: Number(rule?.discountValue || 0), active: rule?.active !== false }))
        .filter((rule) => rule.minQty > 0 && ['percent', 'amount'].includes(rule.discountType) && rule.discountValue > 0)
        .sort((a, b) => a.minQty - b.minQty);
      const bonusesPayload = (values.bonuses || [])
        .filter((b) => b && b.enabled && b.bonusProductId && Number(b.threshold) > 0 && Number(b.bonusQuantity) > 0)
        .map((b) => ({ enabled: true, threshold: Number(b.threshold), bonusProductId: b.bonusProductId, bonusProductName: b.bonusProductName || '', bonusQuantity: Number(b.bonusQuantity) }));
      const payload = {
        name: values.name, barcode: values.barcode, category: normalizeCategory(values.category),
        description: values.description || '', purchasePrice: values.purchasePrice ? Number(values.purchasePrice) : 0,
        profitMargin: values.profitMargin ? Number(values.profitMargin) : 0, autoSalePrice: Boolean(values.autoSalePrice),
        salePrice: values.salePrice ? Number(values.salePrice) : 0, measureType: values.measureType,
        wholesalePrices: processedWholesale, stock: initialStock, categoryDiscountRules: productCategoryDiscountRules, bonuses: bonusesPayload,
        routePrices: (values.routePrices || [])
          .filter((rp) => rp.routeId && Number(rp.price) > 0)
          .map((rp) => ({ routeId: rp.routeId, routeName: rp.routeName, price: Number(rp.price) })),
      };
      if (bonusesPayload.length === 1) payload.bonus = bonusesPayload[0];
      const newProductId = await productsService.createProduct(payload);
      const createChanges = buildCreateChanges(payload);
      await createProductOperation({ productId: newProductId, productName: values.name, operationType: 'create', userEmail: currentUser.email, category: normalizeCategory(values.category), details: { description: 'Producto creado correctamente.', changes: createChanges } });
      initialRef.current = JSON.stringify(values);
      Alert.alert('Éxito', 'Producto creado correctamente.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err) {
      console.error('Error creando producto:', err);
      Alert.alert('Error', 'No se pudo crear el producto.');
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
        Alert.alert('Descartar cambios?', 'Tienes datos sin guardar. ¿Deseas salir?',
          [{ text: 'Seguir editando', style: 'cancel' }, { text: 'Salir', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) }]
        );
      };
      navigation.addListener('beforeRemove', onBeforeRemove);
      return () => navigation.removeListener('beforeRemove', onBeforeRemove);
    }, [navigation, hasChanges, saving])
  );

  function setField(field, value) { setValues((v) => ({ ...v, [field]: value })); }
  const handleBonusesChange = (newBonusesArray) => { setValues((prev) => ({ ...prev, bonuses: newBonusesArray })); };

  function handleTabChange(key) {
    setActiveTab(key);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      {/* Header */}
      <View style={globalStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={globalStyles.title}>Nuevo Producto</Text>
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
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>

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
              <TextInput ref={assignRef('name')} style={styles.input} value={values.name} onChangeText={(t) => setField('name', t)} placeholder="Ej. Pechuga de Pollo" placeholderTextColor={PLACEHOLDER_COLOR} />


              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>Código de barras</Text>
                  <View style={styles.inputWithIconContainer}>
                    <TextInput ref={assignRef('barcode')} style={[styles.inputNoBorder, { flex: 1 }]} value={values.barcode} onChangeText={(t) => setField('barcode', t)} placeholder="Escanea o escribe" placeholderTextColor={PLACEHOLDER_COLOR} />
                    <TouchableOpacity onPress={() => navigation.navigate('BarcodeScanner', { onScanned: (code) => setField('barcode', code) })} style={styles.iconButton}>
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

              <Text style={styles.label}>Stock Inicial</Text>
              <TextInput ref={assignRef('initialStock')} style={styles.input} keyboardType="numeric" value={values.initialStock} onChangeText={(t) => setField('initialStock', t)} placeholder="Cantidad inicial (opcional)" placeholderTextColor={PLACEHOLDER_COLOR} />

              <Text style={styles.label}>Descripción</Text>
              <TextInput ref={assignRef('description')} style={[styles.input, { height: 80, textAlignVertical: 'top', marginBottom: 0 }]} multiline value={values.description} onChangeText={(t) => setField('description', t)} placeholder="Opcional" placeholderTextColor={PLACEHOLDER_COLOR} />
            </View>

            {/* Precios y Costos */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconWrap, { backgroundColor: '#ECFDF5' }]}>
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
              <TextInput ref={assignRef('purchasePrice')} style={styles.input} keyboardType="numeric" value={values.purchasePrice} onChangeText={(t) => handlePriceChange('purchasePrice', t)} placeholder="0.00" placeholderTextColor={PLACEHOLDER_COLOR} />

              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>Margen (%)</Text>
                  <View style={styles.percentInputContainer}>
                    <TextInput ref={assignRef('profitMargin')} style={styles.percentInput} keyboardType="numeric" value={values.profitMargin} onChangeText={(t) => handlePriceChange('profitMargin', t)} placeholder="0" placeholderTextColor={PLACEHOLDER_COLOR} />
                    <Text style={styles.percentSymbol}>%</Text>
                  </View>
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.label}>Precio Venta (C$)</Text>
                  <TextInput ref={assignRef('salePrice')} style={[styles.input, { fontWeight: 'bold', color: '#007AFF', marginBottom: 0 }]} keyboardType="numeric" value={values.salePrice} onChangeText={(t) => handlePriceChange('salePrice', t)} placeholder="0.00" placeholderTextColor={PLACEHOLDER_COLOR} />
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
                  Asigna una categoría y revisa los descuentos automáticos que aplican según las reglas configuradas.
                </Text>
              </View>
            </View>

            {/* Selector de categoría */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconWrap, { backgroundColor: '#F5F3FF' }]}>
                  <Icon name="folder-outline" size={18} color="#7C3AED" />
                </View>
                <Text style={styles.sectionTitle}>Asignar Categoría</Text>
                <TouchableOpacity onPress={() => navigation.navigate('ManageCategories')} style={styles.editDiscountsBtn}>
                  <Icon name="settings-outline" size={13} color="#7C3AED" />
                  <Text style={[styles.editDiscountsBtnText, { color: '#7C3AED' }]}>Gestionar</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.helperText}>
                Las categorías permiten agrupar productos y aplicar descuentos automáticos por volumen en el carrito.
              </Text>

              <Text style={styles.label}>Categoría</Text>
              <View style={{ zIndex: 20 }}>
                <TextInput
                  ref={assignRef('category')}
                  style={[
                    styles.input,
                    { marginBottom: 0 },
                    values.category && { borderColor: '#7C3AED', borderWidth: 1.5 },
                    showCategorySuggestions && categorySuggestions.length > 0 && {
                      borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0,
                    },
                  ]}
                  value={values.category}
                  onChangeText={(t) => { setField('category', t); setShowCategorySuggestions(true); }}
                  onFocus={() => setShowCategorySuggestions(true)}
                  onBlur={() => setTimeout(() => setShowCategorySuggestions(false), 180)}
                  placeholder="Escribe o elige una categoría"
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  autoCorrect={false}
                />

                {/* Dropdown de sugerencias */}
                {showCategorySuggestions && categorySuggestions.length > 0 && (
                  <View style={styles.suggestionsDropdown}>
                    {categorySuggestions.map((cat, idx) => (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.suggestionItem,
                          idx === categorySuggestions.length - 1 && { borderBottomWidth: 0 },
                        ]}
                        onPress={() => {
                          setField('category', cat);
                          setShowCategorySuggestions(false);
                        }}>
                        <Icon name="pricetag-outline" size={13} color="#7C3AED" />
                        <Text style={styles.suggestionText} numberOfLines={1}>{cat}</Text>
                        <Icon name="arrow-forward" size={12} color="#C4B5FD" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Espaciado solo cuando no hay dropdown */}
              {!(showCategorySuggestions && categorySuggestions.length > 0) && (
                <View style={{ height: 14 }} />
              )}

              {values.category ? (
                <View style={[styles.categoryChip, { marginTop: 10 }]}>
                  <Icon name="pricetag" size={13} color="#7C3AED" />
                  <Text style={styles.categoryChipText}>{values.category}</Text>
                  <TouchableOpacity onPress={() => setField('category', '')} style={{ marginLeft: 4 }}>
                    <Icon name="close-circle" size={14} color="#A78BFA" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.categoryEmptyHint}>
                  <Icon name="information-circle-outline" size={14} color="#9CA3AF" />
                  <Text style={styles.categoryEmptyHintText}>Escribe el nombre o elige de la lista. También puedes crear una nueva desde "Gestionar".</Text>
                </View>
              )}
            </View>

            {/* Descuentos de categoría */}
            {categoryActivationRules.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: '#EFF6FF' }]}>
                    <Icon name="pricetags-outline" size={18} color="#1D4ED8" />
                  </View>
                  <Text style={styles.sectionTitle}>Descuentos Automáticos</Text>
                </View>
                <Text style={styles.helperText}>
                  Descuentos configurados para "{values.category}". Se aplican según la cantidad total de la categoría en el carrito.
                </Text>
                {categoryActivationRules.map((minQty) => {
                  const selectedCategory = normalizeCategory(values.category).toLowerCase();
                  const row = categoryRows.find((r) => normalizeCategory(r?.name).toLowerCase() === selectedCategory);
                  const tier = (row?.discountTiers || []).find((t) => Math.max(1, Math.floor(Number(t?.minQty || 0))) === minQty);
                  const hasTier = tier && Number(tier.discountValue || 0) > 0;
                  const isPercent = tier?.discountType === 'percent';
                  return (
                    <View key={minQty} style={styles.discountInfoRow}>
                      <View style={styles.discountInfoLeft}>
                        <Icon name="pricetag-outline" size={14} color={hasTier ? '#1D4ED8' : '#9CA3AF'} />
                        <Text style={styles.discountInfoLabel}>
                          A partir de <Text style={{ fontWeight: '800' }}>{minQty}</Text> unid.
                        </Text>
                      </View>
                      {hasTier ? (
                        <View style={[styles.discountInfoBadge, isPercent ? styles.discountBadgePercent : styles.discountBadgeAmount]}>
                          <Text style={[styles.discountInfoBadgeText, isPercent ? styles.discountBadgePercentText : styles.discountBadgeAmountText]}>
                            {isPercent ? `-${tier.discountValue}%` : `-C$${tier.discountValue}`}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.discountInfoNone}>Sin descuento</Text>
                      )}
                    </View>
                  );
                })}
                <TouchableOpacity style={styles.manageCategoryBtn} onPress={() => navigation.navigate('ManageCategories')}>
                  <Icon name="settings-outline" size={14} color="#1D4ED8" />
                  <Text style={styles.manageCategoryBtnText}>Editar descuentos en Categorías</Text>
                </TouchableOpacity>
              </View>
            ) : values.category ? (
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: '#EFF6FF' }]}>
                    <Icon name="pricetags-outline" size={18} color="#1D4ED8" />
                  </View>
                  <Text style={styles.sectionTitle}>Descuentos Automáticos</Text>
                </View>
                <View style={styles.noDiscountsBox}>
                  <Icon name="pricetags-outline" size={32} color="#D1D5DB" />
                  <Text style={styles.noDiscountsText}>
                    La categoría "{values.category}" no tiene descuentos configurados o no está en el catálogo.
                  </Text>
                  <TouchableOpacity style={styles.addDiscountsBtn} onPress={() => navigation.navigate('ManageCategories')}>
                    <Icon name="add-circle-outline" size={14} color="#2563EB" />
                    <Text style={styles.addDiscountsBtnText}>Configurar descuentos</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </>
        )}

        {/* ━━━ Panel 2: Bonificaciones ━━━ */}
        {activeTab === 'bonuses' && (
          <>
            <View style={styles.panelHeaderCard}>
              <View style={[styles.panelHeaderIconWrap, { backgroundColor: '#FFF7ED' }]}>
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
              <View style={[styles.panelHeaderIconWrap, { backgroundColor: '#F0FDF4' }]}>
                <Icon name="people" size={26} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.panelHeaderTitle}>Precios Mayorista</Text>
                <Text style={styles.panelHeaderDesc}>
                  Define precios especiales al comprar por volumen. Los precios se aplican automáticamente en ventas.
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconWrap, { backgroundColor: '#F0FDF4' }]}>
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
                        <TextInput style={styles.inputSmall} keyboardType="numeric" placeholder="10" placeholderTextColor={PLACEHOLDER_COLOR} value={String(wp.quantity)} onChangeText={(t) => updateWholesalePrice(index, 'quantity', t)} />
                      </View>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.subLabel}>Margen %</Text>
                        <TextInput style={styles.inputSmall} keyboardType="numeric" placeholder="%" placeholderTextColor={PLACEHOLDER_COLOR} value={String(wp.margin)} onChangeText={(t) => updateWholesalePrice(index, 'margin', t)} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.subLabel}>Precio C$</Text>
                        <TextInput style={[styles.inputSmall, { color: '#007AFF', fontWeight: '700' }]} keyboardType="numeric" placeholder="$" placeholderTextColor={PLACEHOLDER_COLOR} value={String(wp.price)} onChangeText={(t) => updateWholesalePrice(index, 'price', t)} />
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

              {/* Selector de ruta */}
              {showRouteSelector && (
                <View style={styles.routeSelectorBox}>
                  <Text style={styles.routeSelectorTitle}>
                    <Icon name="location-outline" size={13} color="#7C3AED" /> Selecciona una ruta:
                  </Text>
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

              {/* Lista de precios configurados */}
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
        <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : (
              <>
                <Icon name="save-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.saveBtnText}>Guardar Producto</Text>
              </>
            )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F5F6FA' },

  // ── Tab Bar ─────────────────────────────────────────────────────────────────
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
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 3,
    position: 'relative',
  },
  tabItemActive: { backgroundColor: '#F0F7FF' },
  tabLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', textAlign: 'center' },
  tabLabelActive: { color: '#007AFF', fontWeight: '700' },
  tabBadge: {
    position: 'absolute',
    top: 6,
    right: 10,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '15%',
    right: '15%',
    height: 3,
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },

  // ── Scroll & Sections ────────────────────────────────────────────────────────
  scrollContent: { padding: 16, paddingBottom: 16 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  sectionIconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A2E', flex: 1 },

  // ── Panel Header Cards ───────────────────────────────────────────────────────
  panelHeaderCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  panelHeaderIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  panelHeaderTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A2E', marginBottom: 4 },
  panelHeaderDesc: { fontSize: 12, color: '#64748B', lineHeight: 17 },

  // ── Price Summary Card ───────────────────────────────────────────────────────
  priceSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  priceSummaryItem: { flex: 1, alignItems: 'center', gap: 3 },
  priceSummaryLabel: { fontSize: 10, color: '#64748B', fontWeight: '600', textTransform: 'uppercase' },
  priceSummaryCost: { fontSize: 14, fontWeight: '700', color: '#334155' },
  priceSummaryMargin: { fontSize: 14, fontWeight: '700', color: '#7C3AED' },
  priceSummaryPrice: { fontSize: 14, fontWeight: '800', color: '#059669' },

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
  categoryHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linkText: { color: '#007AFF', fontWeight: '700', fontSize: 12, marginBottom: 8 },

  // ── Category Discount ────────────────────────────────────────────────────────
  discountInfoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  discountInfoLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  discountInfoLabel: { fontSize: 13, color: '#374151' },
  discountInfoBadge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3, marginLeft: 8 },
  discountBadgePercent: { backgroundColor: '#EFF6FF' },
  discountBadgeAmount: { backgroundColor: '#ECFDF5' },
  discountInfoBadgeText: { fontSize: 12, fontWeight: '800' },
  discountBadgePercentText: { color: '#1D4ED8' },
  discountBadgeAmountText: { color: '#059669' },
  discountInfoNone: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
  manageCategoryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, alignSelf: 'flex-start' },
  manageCategoryBtnText: { color: '#1D4ED8', fontSize: 13, fontWeight: '700' },
  noDiscountsBox: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  noDiscountsText: { fontSize: 12, color: '#6B7280', textAlign: 'center', lineHeight: 17 },
  addDiscountsBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#BFDBFE', marginTop: 4 },
  addDiscountsBtnText: { color: '#2563EB', fontSize: 12, fontWeight: '700' },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#F5F3FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#DDD6FE', marginBottom: 4 },
  categoryChipText: { fontSize: 13, fontWeight: '700', color: '#7C3AED' },
  categoryEmptyHint: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  categoryEmptyHintText: { flex: 1, fontSize: 12, color: '#6B7280', lineHeight: 17 },

  // ── Autocomplete Dropdown ────────────────────────────────────────────────────
  suggestionsDropdown: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: '#7C3AED',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#7C3AED',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    marginBottom: 0,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F3FF',
    backgroundColor: '#fff',
  },
  suggestionText: { flex: 1, fontSize: 14, color: '#374151', fontWeight: '500' },

  // ── Wholesale Cards ──────────────────────────────────────────────────────────
  wholesaleCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  wholesaleCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wholesaleCardBadge: { backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  wholesaleCardBadgeText: { color: '#16A34A', fontSize: 11, fontWeight: '800' },
  deleteButton: { padding: 4 },
  wholesaleTip: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  wholesaleTipText: { flex: 1, fontSize: 11, color: '#64748B', lineHeight: 16 },

  // ── Empty State ──────────────────────────────────────────────────────────────
  emptyStateCard: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyStateTitle: { fontSize: 15, fontWeight: '700', color: '#9CA3AF' },
  emptyStateDesc: { fontSize: 12, color: '#C4C9D4', textAlign: 'center', lineHeight: 18, maxWidth: 240 },

  // ── Buttons ──────────────────────────────────────────────────────────────────
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#007AFF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, gap: 3 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyText: { fontSize: 13, color: '#999', fontStyle: 'italic', textAlign: 'center', marginTop: 10 },
  bottomContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -3 },
  },
  saveBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#007AFF',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  saveBtnDisabled: { backgroundColor: '#A0A0A0', elevation: 0 },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },

  // ── Route Prices ─────────────────────────────────────────────────────────────
  routeSelectorBox: {
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  routeSelectorTitle: { fontSize: 12, fontWeight: '700', color: '#7C3AED', marginBottom: 8 },
  routeSelectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE9FE',
  },
  routeSelectorItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  routeSelectorName: { fontSize: 14, fontWeight: '600', color: '#374151' },
  routeSelectorSub: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  routePriceCard: {
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  routePriceCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  routePriceCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  routePriceIconBox: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' },
  routePriceRouteName: { fontSize: 14, fontWeight: '700', color: '#4C1D95', flex: 1 },
  routePriceInputRow: { gap: 4 },
  routePriceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#7C3AED',
    paddingHorizontal: 10,
    height: 44,
    gap: 6,
  },
  routePriceCurrencySymbol: { fontSize: 14, fontWeight: '700', color: '#7C3AED' },
  routePriceInput: { flex: 1, fontSize: 16, fontWeight: '700', color: '#4C1D95' },
  routePriceDiff: { fontSize: 11, color: '#6B7280', marginTop: 4, fontStyle: 'italic' },
});
