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
import { buildCreateChanges } from '../utils/operationChanges';

const PLACEHOLDER_COLOR = '#9CA3AF';
const PRODUCT_DISCOUNT_TYPES = [
  { key: 'percent', label: '%', placeholder: '%' },
  { key: 'amount', label: 'C$', placeholder: 'C$' },
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
  });

  const initialRef = useRef(JSON.stringify(values));
  const scrollRef = useRef(null);
  const inputsRef = useRef({});
  const assignRef = (field) => (r) => { inputsRef.current[field] = r; };

  const { categoryRows, categories } = useProductCategories();

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

  useEffect(() => {
    if (scannedCode) setValues(prev => ({ ...prev, barcode: scannedCode }));
  }, [scannedCode]);

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
    setValues(prev => {
      const newValues = { ...prev, [field]: text };
      if (field === 'purchasePrice') {
        if (newValues.autoSalePrice && newValues.profitMargin) {
          newValues.salePrice = calculateSalePriceFromMargin(text, newValues.profitMargin);
        } else if (!newValues.autoSalePrice && newValues.salePrice) {
          newValues.profitMargin = calculateMarginFromSalePrice(text, newValues.salePrice);
        }
        newValues.wholesalePrices = prev.wholesalePrices.map(wp => {
          if (wp.price) return { ...wp, margin: calculateMarginFromSalePrice(text, wp.price) };
          return wp;
        });
      }
      if (field === 'profitMargin') {
        if (newValues.purchasePrice) newValues.salePrice = calculateSalePriceFromMargin(newValues.purchasePrice, text);
      }
      if (field === 'salePrice') {
        if (newValues.purchasePrice) newValues.profitMargin = calculateMarginFromSalePrice(newValues.purchasePrice, text);
      }
      return newValues;
    });
  };

  function addWholesalePrice() {
    if (values.wholesalePrices.length >= 5) { Alert.alert('Límite alcanzado', 'Máximo 5 precios de mayorista.'); return; }
    setValues(v => ({ ...v, wholesalePrices: [...v.wholesalePrices, { price: '', quantity: '', margin: '' }] }));
  }

  function removeWholesalePrice(index) {
    setValues(v => {
      const newPrices = [...v.wholesalePrices];
      newPrices.splice(index, 1);
      return { ...v, wholesalePrices: newPrices };
    });
  }

  function updateWholesalePrice(index, field, value) {
    setValues(v => {
      const newPrices = [...v.wholesalePrices];
      const currentItem = { ...newPrices[index], [field]: value };
      if (field === 'price' && v.purchasePrice) {
          currentItem.margin = calculateMarginFromSalePrice(v.purchasePrice, value);
      } else if (field === 'margin' && v.purchasePrice) {
          currentItem.price = calculateSalePriceFromMargin(v.purchasePrice, value);
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
        if (!['percent', 'amount'].includes(discountType)) {
          return { ok: false, msg: 'Tipo de descuento por categoria invalido.' };
        }
        if (!Number.isFinite(discountValue) || discountValue <= 0) {
          return { ok: false, msg: 'El descuento por categoria debe ser mayor a 0.' };
        }
      }
    }

    // --- Validación de múltiples bonificaciones ---
    if (values.bonuses && values.bonuses.length > 0) {
      if (values.bonuses.length > 5) return { ok: false, msg: 'Máximo 5 bonificaciones permitidas.' };
      const enabledBonuses = values.bonuses.map((b, i) => ({ ...b, _idx: i })).filter(b => b.enabled);
      for (const b of enabledBonuses) {
        const idxDisplay = b._idx + 1;
        if (!b.threshold || Number(b.threshold) <= 0) return { ok: false, msg: `Bonificación ${idxDisplay}: la 'cantidad mínima' debe ser mayor a 0.` };
        if (!b.bonusProductId) return { ok: false, msg: `Bonificación ${idxDisplay}: debe seleccionar un producto a regalar.` };
        if (!b.bonusQuantity || Number(b.bonusQuantity) <= 0) return { ok: false, msg: `Bonificación ${idxDisplay}: la 'cantidad a regalar' debe ser mayor a 0.` };
      }
    }

    return { ok: true };
  }

  async function handleSave() {
    const valCheck = validateValues();
    if (!valCheck.ok) {
      Alert.alert('Validación', valCheck.msg);
      return;
    }

    const currentUser = auth().currentUser;
    if (!currentUser?.email) {
      Alert.alert('Error', 'No se pudo obtener la información del usuario.');
      return;
    }

    setSaving(true);
    try {
      const checkRes = await productsService.validateNoDuplicates({
          name: values.name,
          barcode: values.barcode || null
      });

      if (!checkRes.ok) {
        Alert.alert('Duplicado', checkRes.message || 'El producto ya existe.');
        setSaving(false);
        return;
      }

      const processedWholesale = values.wholesalePrices.map(wp => ({
        price: Number(wp.price),
        quantity: Number(wp.quantity)
      }));
      const initialStock = Number(values.initialStock) || 0;

      const productCategoryDiscountRules = (values.categoryDiscountRules || [])
        .map((rule) => ({
          minQty: Math.max(1, Math.floor(Number(rule?.minQty || 0))),
          discountType: String(rule?.discountType || '').toLowerCase(),
          discountValue: Number(rule?.discountValue || 0),
          active: rule?.active !== false,
        }))
        .filter((rule) => rule.minQty > 0 && ['percent', 'amount'].includes(rule.discountType) && rule.discountValue > 0)
        .sort((a, b) => a.minQty - b.minQty);

      // --- Nuevo payload con la estructura de bonificaciones (array) ---
      // Guardar únicamente las bonificaciones activas y con datos válidos
      const bonusesPayload = (values.bonuses || [])
        .filter(b => b && b.enabled && b.bonusProductId && Number(b.threshold) > 0 && Number(b.bonusQuantity) > 0)
        .map(b => ({
          enabled: true,
          threshold: Number(b.threshold),
          bonusProductId: b.bonusProductId,
          bonusProductName: b.bonusProductName || '',
          bonusQuantity: Number(b.bonusQuantity),
        }));

      const payload = {
        name: values.name,
        barcode: values.barcode,
        category: normalizeCategory(values.category),
        description: values.description || '',
        purchasePrice: values.purchasePrice ? Number(values.purchasePrice) : 0,
        profitMargin: values.profitMargin ? Number(values.profitMargin) : 0,
        autoSalePrice: Boolean(values.autoSalePrice),
        salePrice: values.salePrice ? Number(values.salePrice) : 0,
        measureType: values.measureType,
        wholesalePrices: processedWholesale,
        stock: initialStock,
        categoryDiscountRules: productCategoryDiscountRules,
         bonuses: bonusesPayload,
      };

      // Enviar legacy `bonus` para compatibilidad si solo hay una bonificación
      if (bonusesPayload.length === 1) {
        payload.bonus = bonusesPayload[0];
      }

      const newProductId = await productsService.createProduct(payload);

      const createChanges = buildCreateChanges(payload);
      await createProductOperation({
        productId: newProductId,
        productName: values.name,
        operationType: 'create',
        userEmail: currentUser.email,
        category: normalizeCategory(values.category),
        details: {
          description: `Producto creado correctamente.`,
          changes: createChanges,
        },
      });

      initialRef.current = JSON.stringify(values);
      Alert.alert('Éxito', 'Producto creado correctamente.',[
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);

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

  function setField(field, value) {
    setValues(v => ({ ...v, [field]: value }));
  }

  // --- Handler para cambios en el componente de bonificaciones ---
  const handleBonusesChange = (newBonusesArray) => {
    setValues(prev => ({ ...prev, bonuses: newBonusesArray }));
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#F5F6FA' }}>
        <View style={globalStyles.header}>
			<TouchableOpacity onPress={() => navigation.goBack()}><Icon name="chevron-back" size={26} color="#fff" /></TouchableOpacity>
			<Text style={globalStyles.title}>Nuevo Producto</Text>
            <View style={{width: 26}} />
		</View>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.section}>
              <Text style={styles.sectionTitle}>Informacion Basica</Text>
              <Text style={styles.label}>Nombre del producto *</Text>
              <TextInput ref={assignRef('name')} style={styles.input} value={values.name} onChangeText={t => setField('name', t)} placeholder="Ej. Pechuga de Pollo" placeholderTextColor={PLACEHOLDER_COLOR} />

              <View style={styles.categoryHeaderRow}>
                <Text style={styles.label}>Categoria</Text>
                <TouchableOpacity onPress={() => navigation.navigate('ManageCategories')}>
                  <Text style={styles.manageCategoryLink}>Gestionar</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                ref={assignRef('category')}
                style={styles.input}
                value={values.category}
                onChangeText={t => setField('category', t)}
                placeholder="Ej. Pollo"
                placeholderTextColor={PLACEHOLDER_COLOR}
              />

              <View style={styles.rowInputs}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.label}>Código de barras</Text>
                      <View style={styles.inputWithIconContainer}>
                          <TextInput ref={assignRef('barcode')} style={[styles.inputNoBorder, {flex: 1}]} value={values.barcode} onChangeText={t => setField('barcode', t)} placeholder="Escanea o escribe" placeholderTextColor={PLACEHOLDER_COLOR} />
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
              <TextInput ref={assignRef('initialStock')} style={styles.input} keyboardType="numeric" value={values.initialStock} onChangeText={t => setField('initialStock', t)} placeholder="Cantidad inicial (opcional)" placeholderTextColor={PLACEHOLDER_COLOR} />
              <Text style={styles.label}>Descripción</Text>
              <TextInput ref={assignRef('description')} style={[styles.input, { height: 80, textAlignVertical: 'top' }]} multiline value={values.description} onChangeText={t => setField('description', t)} placeholder="Opcional" placeholderTextColor={PLACEHOLDER_COLOR} />
          </View>

          <View style={styles.section}>
             <Text style={styles.sectionTitle}>Precios y Costos</Text>
             <Text style={styles.label}>Costo de Compra ($)</Text>
             <TextInput ref={assignRef('purchasePrice')} style={styles.input} keyboardType="numeric" value={values.purchasePrice} onChangeText={t => handlePriceChange('purchasePrice', t)} placeholder="0.00" placeholderTextColor={PLACEHOLDER_COLOR} />
             <View style={styles.rowInputs}>
                 <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.label}>Margen (%)</Text>
                    <View style={styles.percentInputContainer}>
                        <TextInput ref={assignRef('profitMargin')} style={styles.percentInput} keyboardType="numeric" value={values.profitMargin} onChangeText={t => handlePriceChange('profitMargin', t)} placeholder="0" placeholderTextColor={PLACEHOLDER_COLOR} />
                        <Text style={styles.percentSymbol}>%</Text>
                    </View>
                 </View>
                 <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.label}>Precio Venta ($)</Text>
                    <TextInput ref={assignRef('salePrice')} style={[styles.input, { fontWeight: 'bold', color: '#007AFF' }]} keyboardType="numeric" value={values.salePrice} onChangeText={t => handlePriceChange('salePrice', t)} placeholder="0.00" placeholderTextColor={PLACEHOLDER_COLOR} />
                 </View>
             </View>
          </View>

          {categoryActivationRules.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Descuento por Categoria (Producto)</Text>
              <Text style={styles.helperText}>La cantidad minima se define en Categorias. Aqui solo defines el valor para este producto.</Text>

              {categoryActivationRules.map((minQty) => {
                const rule = (values.categoryDiscountRules || []).find(r => Math.max(1, Math.floor(Number(r?.minQty || 0))) === minQty);
                const discountValue = rule?.discountValue || '';
                const discountType = rule?.discountType || 'percent';

                return (
                  <View key={minQty} style={styles.discountRuleRow}>
                    <Text style={styles.discountRuleLabel}>A partir de {minQty} unid.</Text>
                    <View style={styles.discountRuleInputs}>
                      <TextInput
                        style={styles.discountValueInput}
                        keyboardType="numeric"
                        value={String(discountValue)}
                        onChangeText={text => {
                          const numValue = Number(text);
                          if (Number.isNaN(numValue) || numValue < 0) return;
                          updateCategoryDiscountRule(minQty, { discountValue: numValue });
                        }}
                        placeholder="0"
                        placeholderTextColor={PLACEHOLDER_COLOR}
                      />
                      <View style={styles.discountTypeContainer}>
                        {PRODUCT_DISCOUNT_TYPES.map((type) => (
                          <TouchableOpacity
                            key={type.key}
                            style={[styles.discountTypeButton, discountType === type.key && styles.discountTypeButtonActive]}
                            onPress={() => updateCategoryDiscountRule(minQty, { discountType: type.key })}
                          >
                            <Text style={[styles.discountTypeText, discountType === type.key && styles.discountTypeTextActive]}>{type.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* --- SECCIÓN DE BONIFICACIONES REFACTORIZADA --- */}
          <BonusSetup bonuses={values.bonuses} onChange={handleBonusesChange} />

          <View style={styles.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.sectionTitle}>Precios Mayorista</Text>
                {values.wholesalePrices.length < 5 && (
                    <TouchableOpacity onPress={addWholesalePrice} style={styles.addBtn}>
                        <Icon name="add" size={18} color="#fff" /><Text style={styles.addBtnText}>Agregar</Text>
                    </TouchableOpacity>
                )}
            </View>
            {values.wholesalePrices.map((wp, index) => (
              <View key={index} style={styles.wholesaleRow}>
                <View style={{flexDirection: 'row', alignItems: 'flex-start'}}>
                    <View style={{ flex: 1, marginRight: 8 }}><Text style={styles.subLabel}>Cant. Mín.</Text><TextInput style={styles.inputSmall} keyboardType="numeric" placeholder="10" placeholderTextColor={PLACEHOLDER_COLOR} value={String(wp.quantity)} onChangeText={t => updateWholesalePrice(index, 'quantity', t)} /></View>
                    <View style={{ flex: 1, marginRight: 8 }}><Text style={styles.subLabel}>Margen %</Text><TextInput style={styles.inputSmall} keyboardType="numeric" placeholder="%" placeholderTextColor={PLACEHOLDER_COLOR} value={String(wp.margin)} onChangeText={t => updateWholesalePrice(index, 'margin', t)} /></View>
                    <View style={{ flex: 1, marginRight: 4 }}><Text style={styles.subLabel}>Precio $</Text><TextInput style={[styles.inputSmall, { color: '#007AFF', fontWeight: '700' }]} keyboardType="numeric" placeholder="$" placeholderTextColor={PLACEHOLDER_COLOR} value={String(wp.price)} onChangeText={t => updateWholesalePrice(index, 'price', t)} /></View>
                    <TouchableOpacity onPress={() => removeWholesalePrice(index)} style={styles.deleteButton}><Icon name="trash-outline" size={20} color="#FF3B30" /></TouchableOpacity>
                </View>
              </View>
            ))}
            {values.wholesalePrices.length === 0 && (<Text style={styles.emptyText}>Sin precios por volumen.</Text>)}
          </View>
      </ScrollView>

      <View style={styles.bottomContainer}>
          <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
              {saving ? (<ActivityIndicator color="#fff" />) : (<><Icon name="save-outline" size={22} color="#fff" style={{marginRight: 8}} /><Text style={styles.saveBtnText}>Guardar Producto</Text></>)}
          </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 16, paddingBottom: 10 },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#ECECEC' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 14 },
  label: { fontSize: 13, color: '#666', marginBottom: 6, fontWeight: '600', textTransform: 'uppercase' },
  subLabel: { fontSize: 11, color: '#888', marginBottom: 4, fontWeight: '600' },
  input: { backgroundColor: '#F5F6FA', padding: 12, borderRadius: 10, fontSize: 16, color: '#333', marginBottom: 16, borderWidth: 1, borderColor: '#F0F0F0' },
  inputWithIconContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F6FA', borderRadius: 10, borderWidth: 1, borderColor: '#F0F0F0', marginBottom: 16, paddingRight: 8 },
  inputNoBorder: { padding: 12, fontSize: 16, color: '#333' },
  iconButton: { padding: 8 },
  inputSmall: { backgroundColor: '#F5F6FA', padding: 10, borderRadius: 8, fontSize: 14, color: '#333', borderWidth: 1, borderColor: '#eee' },
  rowInputs: { flexDirection: 'row', marginBottom: 0 },
  percentInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F6FA', borderRadius: 10, borderWidth: 1, borderColor: '#F0F0F0', paddingRight: 12, marginBottom: 16 },
  percentInput: { flex: 1, padding: 12, fontSize: 16, color: '#333' },
  percentSymbol: { fontSize: 16, color: '#999', fontWeight: 'bold' },
  toggleContainer: { flexDirection: 'row', backgroundColor: '#F0F0F0', borderRadius: 10, padding: 3, marginBottom: 16, height: 48 },
  toggleBtn: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  toggleBtnActive: { backgroundColor: '#fff' },
  toggleText: { fontSize: 13, color: '#888', fontWeight: '600' },
  toggleTextActive: { color: '#007AFF', fontWeight: '700' },
  categoryHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  manageCategoryLink: { color: '#007AFF', fontWeight: '700', marginBottom: 8 },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#007AFF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 4 },
  wholesaleRow: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  deleteButton: { padding: 8, marginTop: 18 },
  emptyText: { fontSize: 13, color: '#999', fontStyle: 'italic', textAlign: 'center', marginTop: 10 },
  bottomContainer: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', paddingBottom: Platform.OS === 'ios' ? 30 : 16 },
  saveBtn: { backgroundColor: '#007AFF', borderRadius: 14, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#007AFF', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
  saveBtnDisabled: { backgroundColor: '#A0A0A0', elevation: 0 },
  saveBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  helperText: { fontSize: 12, color: '#888', marginBottom: 12 },
  discountRuleRow: { marginBottom: 16 },
  discountRuleLabel: { fontSize: 14, color: '#333', marginBottom: 8 },
  discountRuleInputs: { flexDirection: 'row', alignItems: 'center' },
  discountValueInput: { flex: 1, padding: 12, borderRadius: 8, fontSize: 16, color: '#333', backgroundColor: '#F5F6FA', borderWidth: 1, borderColor: '#E0E0E0', marginRight: 8 },
  discountTypeContainer: { flexDirection: 'row' },
  discountTypeButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#F0F0F0', borderWidth: 1, borderColor: '#D0D0D0', marginRight: 8 },
  discountTypeButtonActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  discountTypeText: { fontSize: 14, color: '#333', fontWeight: '600' },
  discountTypeTextActive: { color: '#fff' },
});
