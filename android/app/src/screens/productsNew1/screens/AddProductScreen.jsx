import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  Switch,
  Keyboard,
  Dimensions
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import Icon from 'react-native-vector-icons/Ionicons';

import globalStyles from '../../../styles/globalStyles';
import productsService from '../services/productsService';
import { createProductOperation } from '../../../services/operations/productOperations';


export default function AddProductScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { scannedCode } = route.params || {};

  const [saving, setSaving] = useState(false);

  // Estado Unificado
  const [values, setValues] = useState({
    name: '',
    barcode: '',
    description: '',
    purchasePrice: '',
    profitMargin: '',
    autoSalePrice: true,
    salePrice: '',
    measureType: 'unit',
    wholesalePrices: [],
    initialStock: '',
    // --- Bonificaciones ---
    bonusEnabled: false,
    bonusThreshold: '', // Cantidad mínima para bonificar
    bonusQuantity: '',  // Cantidad de producto a regalar
  });

  const initialRef = useRef(JSON.stringify(values));

  // Referencias para UI
  const scrollRef = useRef(null);
  const inputsRef = useRef({});
  const focusedField = useRef(null);
  const keyboardHeightRef = useRef(0);

  const assignRef = (field) => (r) => { inputsRef.current[field] = r; };

  // Cargar código escaneado si viene desde la lista
  useEffect(() => {
    if (scannedCode) {
        setValues(prev => ({ ...prev, barcode: scannedCode }));
    }
  }, [scannedCode]);

  // --- Lógica de Precios (Igual que EditProduct) ---
  const calculateSalePriceFromMargin = (cost, margin) => {
      if (!cost || !margin || margin >= 100) return '';
      const c = Number(cost);
      const m = Number(margin);
      if (Number.isNaN(c) || Number.isNaN(m)) return '';
      const sale = c / (1 - (m / 100));
      return sale.toFixed(2);
  };

  const calculateMarginFromSalePrice = (cost, sale) => {
      if (!cost || !sale) return '';
      const c = Number(cost);
      const s = Number(sale);
      if (Number.isNaN(c) || Number.isNaN(s) || s === 0) return '';
      const margin = ((1 - (c / s)) * 100);
      return margin.toFixed(2);
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
               // Recalcular márgenes mayoristas
               newValues.wholesalePrices = prev.wholesalePrices.map(wp => {
                   if(wp.price) {
                       return {...wp, margin: calculateMarginFromSalePrice(text, wp.price)};
                   }
                   return wp;
               });
          }

          if (field === 'profitMargin') {
              if (newValues.purchasePrice) {
                  newValues.salePrice = calculateSalePriceFromMargin(newValues.purchasePrice, text);
              }
          }

          if (field === 'salePrice') {
              if (newValues.purchasePrice) {
                  newValues.profitMargin = calculateMarginFromSalePrice(newValues.purchasePrice, text);
              }
          }
          return newValues;
      });
  };

  // --- Lógica Mayorista ---
  function addWholesalePrice() {
    if (values.wholesalePrices.length >= 5) {
      Alert.alert('Límite alcanzado', 'Máximo 5 precios de mayorista.');
      return;
    }
    setValues(v => ({
      ...v,
      wholesalePrices: [...v.wholesalePrices, { price: '', quantity: '', margin: '' }]
    }));
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

  // --- Validación y Guardado ---
  function validateValues() {
    if (!values.name || values.name.trim() === '') return { ok: false, msg: 'El nombre es obligatorio.' };
    if (values.purchasePrice && (Number.isNaN(Number(values.purchasePrice)) || Number(values.purchasePrice) < 0))
        return { ok: false, msg: 'Costo de compra inválido.' };
    if (values.salePrice && (Number.isNaN(Number(values.salePrice)) || Number(values.salePrice) < 0))
        return { ok: false, msg: 'Precio de venta inválido.' };
    if (values.initialStock && (Number.isNaN(Number(values.initialStock)) || Number(values.initialStock) < 0))
        return { ok: false, msg: 'El stock inicial es inválido.' };
    if (values.bonusEnabled) {
      if (!values.bonusThreshold || Number(values.bonusThreshold) <= 0) return {ok: false, msg: "La 'cantidad mínima para bonificar' debe ser mayor a 0."};
      if (!values.bonusQuantity || Number(values.bonusQuantity) <= 0) return {ok: false, msg: "La 'cantidad a bonificar' debe ser mayor a 0."};
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
      Alert.alert('Error', 'No se pudo obtener la información del usuario para registrar la operación.');
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

      const payload = {
        name: values.name,
        barcode: values.barcode,
        description: values.description || '',
        purchasePrice: values.purchasePrice ? Number(values.purchasePrice) : 0,
        profitMargin: values.profitMargin ? Number(values.profitMargin) : 0,
        autoSalePrice: Boolean(values.autoSalePrice),
        salePrice: values.salePrice ? Number(values.salePrice) : 0,
        measureType: values.measureType,
        wholesalePrices: processedWholesale,
        stock: initialStock,
        // --- Bonificaciones ---
        bonusEnabled: values.bonusEnabled,
        bonusThreshold: values.bonusEnabled ? Number(values.bonusThreshold) : 0,
        bonusQuantity: values.bonusEnabled ? Number(values.bonusQuantity) : 0,
      };

      const newProductId = await productsService.createProduct(payload);
      
      await createProductOperation({
        productId: newProductId,
        productName: values.name,
        operationType: 'create',
        userEmail: currentUser.email,
        details: {
          description: `Producto creado con stock inicial de ${initialStock}.`,
          initialStock: initialStock,
          ...payload
        }
      });

      initialRef.current = JSON.stringify(values);

      Alert.alert('Éxito', 'Producto creado correctamente.',[
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);

    } catch (err) {
      console.error('Error creando producto:', err);
      Alert.alert('Error', 'No se pudo crear el producto.');
    } finally {
        setTimeout(() => {
             if (navigation.isFocused()) setSaving(false);
        }, 500);
    }
  }

  // --- Helpers de UI (Keyboard, Back handling) ---
  const hasChanges = useCallback(() => {
    return initialRef.current !== JSON.stringify(values);
  }, [values]);

  useFocusEffect(
    useCallback(() => {
      const onBeforeRemove = (e) => {
        if (!hasChanges() || saving) return;
        e.preventDefault();
        Alert.alert(
          'Descartar cambios?',
          'Tienes datos sin guardar. ¿Deseas salir?',
          [
            { text: 'Seguir editando', style: 'cancel' },
            { text: 'Salir', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
          ]
        );
      };
      navigation.addListener('beforeRemove', onBeforeRemove);
      return () => navigation.removeListener('beforeRemove', onBeforeRemove);
    }, [navigation, hasChanges, saving])
  );
  
  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
        keyboardHeightRef.current = e.endCoordinates.height;
    });
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
        keyboardHeightRef.current = 0;
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  function setField(field, value) {
    setValues(v => ({ ...v, [field]: value }));
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#F5F6FA' }}
    >
        <View style={globalStyles.header}>
			<TouchableOpacity onPress={() => navigation.goBack()}>
			  <Icon name="chevron-back" size={26} color="#fff" />
			</TouchableOpacity>
			<Text style={globalStyles.title}>Nuevo Producto</Text>
            <View style={{width: 26}} />
		</View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
          <View style={styles.section}>
              <Text style={styles.sectionTitle}>Información Básica</Text>
              <Text style={styles.label}>Nombre del producto *</Text>
              <TextInput ref={assignRef('name')} style={styles.input} value={values.name} onChangeText={t => setField('name', t)} placeholder="Ej. Pechuga de Pollo" placeholderTextColor="#999" onFocus={() => focusedField.current = 'name'} />
              <View style={styles.rowInputs}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.label}>Código de barras</Text>
                      <View style={styles.inputWithIconContainer}>
                          <TextInput ref={assignRef('barcode')} style={[styles.inputNoBorder, {flex: 1}]} value={values.barcode} onChangeText={t => setField('barcode', t)} placeholder="Escanea o escribe" placeholderTextColor="#999" onFocus={() => focusedField.current = 'barcode'} />
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
              <TextInput ref={assignRef('initialStock')} style={styles.input} keyboardType="numeric" value={values.initialStock} onChangeText={t => setField('initialStock', t)} placeholder="Cantidad inicial (opcional)" placeholderTextColor="#999" onFocus={() => focusedField.current = 'initialStock'} />
              <Text style={styles.label}>Descripción</Text>
              <TextInput ref={assignRef('description')} style={[styles.input, { height: 80, textAlignVertical: 'top' }]} multiline value={values.description} onChangeText={t => setField('description', t)} placeholder="Opcional" placeholderTextColor="#999" onFocus={() => focusedField.current = 'description'} />
          </View>
          
          <View style={styles.section}>
             <Text style={styles.sectionTitle}>Precios y Costos</Text>
             <Text style={styles.label}>Costo de Compra ($)</Text>
             <TextInput ref={assignRef('purchasePrice')} style={styles.input} keyboardType="numeric" value={values.purchasePrice} onChangeText={t => handlePriceChange('purchasePrice', t)} placeholder="0.00" placeholderTextColor="#999" onFocus={() => focusedField.current = 'purchasePrice'} />
             <View style={styles.rowInputs}>
                 <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.label}>Margen (%)</Text>
                    <View style={styles.percentInputContainer}>
                        <TextInput ref={assignRef('profitMargin')} style={styles.percentInput} keyboardType="numeric" value={values.profitMargin} onChangeText={t => handlePriceChange('profitMargin', t)} placeholder="0" placeholderTextColor="#999" onFocus={() => focusedField.current = 'profitMargin'} />
                        <Text style={styles.percentSymbol}>%</Text>
                    </View>
                 </View>
                 <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.label}>Precio Venta ($)</Text>
                    <TextInput ref={assignRef('salePrice')} style={[styles.input, { fontWeight: 'bold', color: '#007AFF' }]} keyboardType="numeric" value={values.salePrice} onChangeText={t => handlePriceChange('salePrice', t)} placeholder="0.00" placeholderTextColor="#999" onFocus={() => focusedField.current = 'salePrice'} />
                 </View>
             </View>
          </View>

          {/* SECTION: BONIFICACIONES */}
          <View style={styles.section}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                <Text style={styles.sectionTitle}>Bonificaciones</Text>
                <Switch
                  trackColor={{ false: "#767577", true: "#81b0ff" }}
                  thumbColor={values.bonusEnabled ? "#007AFF" : "#f4f3f4"}
                  onValueChange={() => setField('bonusEnabled', !values.bonusEnabled)}
                  value={values.bonusEnabled}
                />
              </View>
              {values.bonusEnabled && (
                <View style={{marginTop: 16}}>
                    <Text style={styles.label}>Por cada...</Text>
                    <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={values.bonusThreshold}
                        onChangeText={t => setField('bonusThreshold', t.replace(/[^0-9]/g, ''))}
                        placeholder="Ej. 10 unidades vendidas"
                        placeholderTextColor="#999"
                    />
                    <Text style={styles.label}>...regalar</Text>
                    <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={values.bonusQuantity}
                        onChangeText={t => setField('bonusQuantity', t.replace(/[^0-9]/g, ''))}
                        placeholder="Ej. 1 unidad"
                        placeholderTextColor="#999"
                    />
                </View>
              )}
          </View>

          <View style={styles.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.sectionTitle}>Precios Mayorista</Text>
                {values.wholesalePrices.length < 5 && (
                    <TouchableOpacity onPress={addWholesalePrice} style={styles.addBtn}>
                        <Icon name="add" size={18} color="#fff" />
                        <Text style={styles.addBtnText}>Agregar</Text>
                    </TouchableOpacity>
                )}
            </View>
            {values.wholesalePrices.map((wp, index) => (
              <View key={index} style={styles.wholesaleRow}>
                <View style={{flexDirection: 'row', alignItems: 'flex-start'}}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.subLabel}>Cant. Mín.</Text>
                        <TextInput style={styles.inputSmall} keyboardType="numeric" placeholder="10" placeholderTextColor="#999" value={String(wp.quantity)} onChangeText={t => updateWholesalePrice(index, 'quantity', t)} />
                    </View>
                    <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.subLabel}>Margen %</Text>
                        <TextInput style={styles.inputSmall} keyboardType="numeric" placeholder="%" placeholderTextColor="#999" value={String(wp.margin)} onChangeText={t => updateWholesalePrice(index, 'margin', t)} />
                    </View>
                    <View style={{ flex: 1, marginRight: 4 }}>
                        <Text style={styles.subLabel}>Precio $</Text>
                        <TextInput style={[styles.inputSmall, { color: '#007AFF', fontWeight: '700' }]} keyboardType="numeric" placeholder="$" placeholderTextColor="#999" value={String(wp.price)} onChangeText={t => updateWholesalePrice(index, 'price', t)} />
                    </View>
                    <TouchableOpacity onPress={() => removeWholesalePrice(index)} style={styles.deleteButton}>
                        <Icon name="trash-outline" size={20} color="#FF3B30" />
                    </TouchableOpacity>
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
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 16 },
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
  toggleBtnActive: { backgroundColor: '#fff', elevation: 2 },
  toggleText: { fontSize: 13, color: '#888', fontWeight: '600' },
  toggleTextActive: { color: '#007AFF', fontWeight: '700' },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#007AFF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 4 },
  wholesaleRow: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  deleteButton: { padding: 8, marginTop: 18 },
  emptyText: { fontSize: 13, color: '#999', fontStyle: 'italic', textAlign: 'center', marginTop: 10 },
  bottomContainer: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', paddingBottom: Platform.OS === 'ios' ? 30 : 16 },
  saveBtn: { backgroundColor: '#007AFF', borderRadius: 14, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#007AFF', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
  saveBtnDisabled: { backgroundColor: '#A0A0A0', elevation: 0 },
  saveBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});