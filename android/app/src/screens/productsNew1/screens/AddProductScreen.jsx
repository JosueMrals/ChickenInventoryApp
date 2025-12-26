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
  Keyboard,
  Dimensions
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import Icon from 'react-native-vector-icons/Ionicons';

import globalStyles from '../../../styles/globalStyles';
import productsService from '../services/productsService';

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

    // Si ingresó costo, validarlo
    if (values.purchasePrice && (Number.isNaN(Number(values.purchasePrice)) || Number(values.purchasePrice) < 0))
        return { ok: false, msg: 'Costo de compra inválido.' };

    // Si ingresó venta, validarla
    if (values.salePrice && (Number.isNaN(Number(values.salePrice)) || Number(values.salePrice) < 0))
        return { ok: false, msg: 'Precio de venta inválido.' };

    return { ok: true };
  }

  async function handleSave() {
    const valCheck = validateValues();
    if (!valCheck.ok) {
      Alert.alert('Validación', valCheck.msg);
      return;
    }

    setSaving(true);
    try {
      // 1. Validar Duplicados
      const checkRes = await productsService.validateNoDuplicates({
          name: values.name,
          barcode: values.barcode || null
      });

      if (!checkRes.ok) {
        Alert.alert('Duplicado', checkRes.message || 'El producto ya existe.');
        setSaving(false);
        return;
      }

      // 2. Preparar Payload
      const processedWholesale = values.wholesalePrices.map(wp => ({
        price: Number(wp.price),
        quantity: Number(wp.quantity)
      }));

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
        // stock inicializa en 0 en el servicio
      };

      // 3. Crear
      await productsService.createProduct(payload);

      // Reset ref para evitar alerta de descarte
      initialRef.current = JSON.stringify(values);

      // Feedback y Salida
      Alert.alert('Éxito', 'Producto creado correctamente.',[
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);

    } catch (err) {
      console.error('Error creando producto:', err);
      Alert.alert('Error', 'No se pudo crear el producto.');
    } finally {
        // Delay pequeño para asegurar que el estado se actualice antes de desmontar si es muy rápido
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
        // Si estamos guardando (o se completo guardado y updated initialRef), no prevenir
        // El estado 'saving' puede ser false en el finally, pero initialRef ya está actualizado.
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

  // Manejo de teclado (simplificado del EditScreen)
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
            {/* Botón superior eliminado en favor del botón inferior */}
            <View style={{width: 26}} />
		</View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
          {/* Section: Información Básica */}
          <View style={styles.section}>
              <Text style={styles.sectionTitle}>Información Básica</Text>

              <Text style={styles.label}>Nombre del producto *</Text>
              <TextInput
                ref={assignRef('name')}
                style={styles.input}
                value={values.name}
                onChangeText={t => setField('name', t)}
                placeholder="Ej. Pechuga de Pollo"
                placeholderTextColor="#999"
                onFocus={() => focusedField.current = 'name'}
              />

              <View style={styles.rowInputs}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.label}>Código de barras</Text>
                      <View style={styles.inputWithIconContainer}>
                          <TextInput
                            ref={assignRef('barcode')}
                            style={[styles.inputNoBorder, {flex: 1}]}
                            value={values.barcode}
                            onChangeText={t => setField('barcode', t)}
                            placeholder="Escanea o escribe"
                            placeholderTextColor="#999"
                            onFocus={() => focusedField.current = 'barcode'}
                          />
                          <TouchableOpacity
                            onPress={() => navigation.navigate('BarcodeScanner', { onScanned: (code) => setField('barcode', code) })}
                            style={styles.iconButton}
                          >
                             <Icon name="scan" size={20} color="#666" />
                          </TouchableOpacity>
                      </View>
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.label}>Unidad</Text>
                      <View style={styles.toggleContainer}>
                        <TouchableOpacity
                            style={[styles.toggleBtn, values.measureType === 'unit' && styles.toggleBtnActive]}
                            onPress={() => setField('measureType', 'unit')}
                        >
                            <Text style={[styles.toggleText, values.measureType === 'unit' && styles.toggleTextActive]}>Unid.</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.toggleBtn, values.measureType === 'weight' && styles.toggleBtnActive]}
                            onPress={() => setField('measureType', 'weight')}
                        >
                            <Text style={[styles.toggleText, values.measureType === 'weight' && styles.toggleTextActive]}>Peso</Text>
                        </TouchableOpacity>
                      </View>
                  </View>
              </View>

              <Text style={styles.label}>Descripción</Text>
              <TextInput
                ref={assignRef('description')}
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                multiline
                value={values.description}
                onChangeText={t => setField('description', t)}
                placeholder="Opcional"
                placeholderTextColor="#999"
                onFocus={() => focusedField.current = 'description'}
              />
          </View>

          {/* Section: Precios */}
          <View style={styles.section}>
             <Text style={styles.sectionTitle}>Precios y Costos</Text>

             <Text style={styles.label}>Costo de Compra ($)</Text>
             <TextInput
                ref={assignRef('purchasePrice')}
                style={styles.input}
                keyboardType="numeric"
                value={values.purchasePrice}
                onChangeText={t => handlePriceChange('purchasePrice', t)}
                placeholder="0.00"
                placeholderTextColor="#999"
                onFocus={() => focusedField.current = 'purchasePrice'}
             />

             <View style={styles.rowInputs}>
                 <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.label}>Margen (%)</Text>
                    <View style={styles.percentInputContainer}>
                        <TextInput
                        ref={assignRef('profitMargin')}
                        style={styles.percentInput}
                        keyboardType="numeric"
                        value={values.profitMargin}
                        onChangeText={t => handlePriceChange('profitMargin', t)}
                        placeholder="0"
                        placeholderTextColor="#999"
                        onFocus={() => focusedField.current = 'profitMargin'}
                        />
                        <Text style={styles.percentSymbol}>%</Text>
                    </View>
                 </View>
                 <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.label}>Precio Venta ($)</Text>
                    <TextInput
                        ref={assignRef('salePrice')}
                        style={[styles.input, { fontWeight: 'bold', color: '#007AFF' }]}
                        keyboardType="numeric"
                        value={values.salePrice}
                        onChangeText={t => handlePriceChange('salePrice', t)}
                        placeholder="0.00"
                        placeholderTextColor="#999"
                        onFocus={() => focusedField.current = 'salePrice'}
                    />
                 </View>
             </View>
          </View>

          {/* Section: Mayorista */}
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
                        <TextInput
                            style={styles.inputSmall}
                            keyboardType="numeric"
                            placeholder="10"
                            placeholderTextColor="#999"
                            value={String(wp.quantity)}
                            onChangeText={t => updateWholesalePrice(index, 'quantity', t)}
                        />
                    </View>

                    <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.subLabel}>Margen %</Text>
                        <TextInput
                            style={styles.inputSmall}
                            keyboardType="numeric"
                            placeholder="%"
                            placeholderTextColor="#999"
                            value={String(wp.margin)}
                            onChangeText={t => updateWholesalePrice(index, 'margin', t)}
                        />
                    </View>

                    <View style={{ flex: 1, marginRight: 4 }}>
                        <Text style={styles.subLabel}>Precio $</Text>
                        <TextInput
                            style={[styles.inputSmall, { color: '#007AFF', fontWeight: '700' }]}
                            keyboardType="numeric"
                            placeholder="$"
                            placeholderTextColor="#999"
                            value={String(wp.price)}
                            onChangeText={t => updateWholesalePrice(index, 'price', t)}
                        />
                    </View>

                    <TouchableOpacity onPress={() => removeWholesalePrice(index)} style={styles.deleteButton}>
                        <Icon name="trash-outline" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                </View>
              </View>
            ))}

            {values.wholesalePrices.length === 0 && (
                <Text style={styles.emptyText}>Sin precios por volumen.</Text>
            )}
          </View>

      </ScrollView>

      {/* Floating Save Button */}
      <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
              {saving ? (
                  <ActivityIndicator color="#fff" />
              ) : (
                  <>
                    <Icon name="save-outline" size={22} color="#fff" style={{marginRight: 8}} />
                    <Text style={styles.saveBtnText}>Guardar Producto</Text>
                  </>
              )}
          </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  section: {
      backgroundColor: '#fff',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      elevation: 1,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 2 }
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 16 },
  label: { fontSize: 13, color: '#666', marginBottom: 6, fontWeight: '600', textTransform: 'uppercase' },
  subLabel: { fontSize: 11, color: '#888', marginBottom: 4, fontWeight: '600' },

  input: {
    backgroundColor: '#F5F6FA',
    padding: 12,
    borderRadius: 10,
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0'
  },
  inputWithIconContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#F5F6FA',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#F0F0F0',
      marginBottom: 16,
      paddingRight: 8
  },
  inputNoBorder: {
      padding: 12,
      fontSize: 16,
      color: '#333'
  },
  iconButton: { padding: 8 },

  inputSmall: {
    backgroundColor: '#F5F6FA',
    padding: 10,
    borderRadius: 8,
    fontSize: 14,
    color: '#333',
    borderWidth: 1,
    borderColor: '#eee'
  },
  rowInputs: { flexDirection: 'row', marginBottom: 16 },

  percentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F6FA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    paddingRight: 12,
    marginBottom: 16
  },
  percentInput: { flex: 1, padding: 12, fontSize: 16, color: '#333' },
  percentSymbol: { fontSize: 16, color: '#999', fontWeight: 'bold' },

  toggleContainer: {
      flexDirection: 'row',
      backgroundColor: '#F0F0F0',
      borderRadius: 10,
      padding: 3,
      marginBottom: 16,
      height: 48
  },
  toggleBtn: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  toggleBtnActive: { backgroundColor: '#fff', elevation: 2 },
  toggleText: { fontSize: 13, color: '#888', fontWeight: '600' },
  toggleTextActive: { color: '#007AFF', fontWeight: '700' },

  addBtn: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: '#007AFF',
      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20
  },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 4 },
  wholesaleRow: {
      marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0'
  },
  deleteButton: { padding: 8, marginTop: 18 },
  emptyText: { fontSize: 13, color: '#999', fontStyle: 'italic', textAlign: 'center', marginTop: 10 },

  // New Button Styles
  bottomContainer: {
      padding: 16,
      backgroundColor: '#fff',
      borderTopWidth: 1,
      borderTopColor: '#eee',
      paddingBottom: Platform.OS === 'ios' ? 30 : 16 // Extra padding for iPhone X+
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
      shadowOffset: { width: 0, height: 3 }
  },
  saveBtnDisabled: {
      backgroundColor: '#A0A0A0',
      elevation: 0
  },
  saveBtnText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold'
  }
});
