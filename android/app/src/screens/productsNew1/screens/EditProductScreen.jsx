
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
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
import { db } from '../../../services/firebase';
import firestore, { serverTimestamp } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { useFocusEffect } from '@react-navigation/native';
import globalStyles from '../../../styles/globalStyles';
import Icon from 'react-native-vector-icons/Ionicons';
import productsService from '../services/productsService';
import { createProductOperation } from '../../../services/operations/productOperations';

export default function EditProductScreen({ route, navigation }) {
  const { productId } = route.params ?? {};
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState(null);

  // Estado principal
  const [values, setValues] = useState({
    name: '',
    barcode: '',
    description: '',
    purchasePrice: '',    // Costo
    profitMargin: '',     // % ganancia
    autoSalePrice: true,  // Si es true, salePrice se calcula
    salePrice: '',        // Precio venta final
    measureType: 'unit',
    wholesalePrices: [],
  });

  const initialRef = useRef(null);

  // Scroll y Teclado
  const scrollRef = useRef(null);
  const inputsRef = useRef({});
  const focusedField = useRef(null);
  const keyboardHeightRef = useRef(0);

  const assignRef = (field) => (r) => {
    inputsRef.current[field] = r;
  };

  // Carga inicial
  useEffect(() => {
    if (!productId) {
      Alert.alert('Error', 'No se recibió productId');
      navigation.goBack();
      return;
    }

    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const docRef = db.doc(`products/${productId}`);
        const snap = await docRef.get();
        if (!mounted) return;
        if (!snap.exists) {
          Alert.alert('No encontrado', 'El producto no existe.');
          navigation.goBack();
          return;
        }
        const data = snap.data();

        // 1. Cargar Precios Mayoristas
        let loadedWholesalePrices = [];
        if (Array.isArray(data.wholesalePrices)) {
          loadedWholesalePrices = data.wholesalePrices.map(wp => ({
              ...wp,
              margin: '' // Se calculará después si es posible
          }));
        } else if (data.wholesalePrice && data.wholesaleThreshold) {
          loadedWholesalePrices = [{
            price: data.wholesalePrice,
            quantity: data.wholesaleThreshold,
            margin: ''
          }];
        }

        // 2. Calcular Márgenes (Principal y Mayoristas)
        // Margen Principal
        let initialMargin = data.profitMargin ? String(data.profitMargin) : '';
        const cost = Number(data.purchasePrice);
        const sale = Number(data.salePrice);

        if (cost > 0 && sale > 0 && !initialMargin) {
             const m = ((1 - (cost / sale)) * 100).toFixed(2);
             initialMargin = m;
        }

        // Márgenes Mayoristas
        if(cost > 0) {
            loadedWholesalePrices = loadedWholesalePrices.map(wp => {
                if(wp.price > 0 && !wp.margin) {
                    const m = ((1 - (cost / wp.price)) * 100).toFixed(2);
                    return { ...wp, margin: m };
                }
                return wp;
            });
        }

        const normalized = {
          name: data.name ?? '',
          barcode: data.barcode ?? '',
          description: data.description ?? '',
          purchasePrice: data.purchasePrice ? String(data.purchasePrice) : '',
          profitMargin: initialMargin,
          autoSalePrice: data.autoSalePrice ?? true,
          salePrice: data.salePrice ? String(data.salePrice) : '',
          measureType: data.measureType ?? 'unit',
          wholesalePrices: loadedWholesalePrices,
        };

        setProduct({ id: snap.id, ...data });
        setValues(normalized);
        initialRef.current = JSON.stringify(normalized);
      } catch (err) {
        console.error('Error cargando producto:', err);
        Alert.alert('Error', 'No se pudo cargar el producto. Revisa la conexión.');
        navigation.goBack();
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [productId, navigation]);

  // Lógica de cálculo de precios (Bidireccional)
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

  // Keyboard listeners
  useEffect(() => {
    const onKeyboardShow = (e) => {
      const kbHeight = e?.endCoordinates?.height ?? 0;
      keyboardHeightRef.current = kbHeight;
      setTimeout(() => {
        ensureFocusedInputVisible(kbHeight);
      }, Platform.OS === 'ios' ? 50 : 0);
    };

    const onKeyboardHide = () => {
      keyboardHeightRef.current = 0;
    };

    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', onKeyboardShow);
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', onKeyboardHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const ensureFocusedInputVisible = async (keyboardHeight = keyboardHeightRef.current) => {
    try {
      const field = focusedField.current;
      if (!field) return;
      const ref = inputsRef.current[field];
      if (!ref || !scrollRef.current) return;

      if (typeof ref.measureInWindow === 'function') {
        ref.measureInWindow((x, y, width, height) => {
          const windowHeight = Dimensions.get('window').height;
          const inputBottom = y + height;
          const availableArea = windowHeight - keyboardHeight;
          const extraOffset = 20;
          if (inputBottom + extraOffset > availableArea) {
            const diff = inputBottom + extraOffset - availableArea;
            scrollRef.current.scrollTo({ y: diff + (Platform.OS === 'ios' ? 0 : 20), animated: true });
          }
        });
      }
    } catch (err) {
      console.warn('Error al asegurar visibilidad input:', err);
    }
  };

  const hasChanges = useCallback(() => {
    const current = JSON.stringify(values);
    return initialRef.current !== null && current !== initialRef.current;
  }, [values]);

  useFocusEffect(
    useCallback(() => {
      const onBeforeRemove = (e) => {
        if (!hasChanges() || saving) return; // Si guardando, no preguntar
        e.preventDefault();
        Alert.alert(
          'Descartar cambios?',
          'Tienes cambios sin guardar. ¿Deseas descartarlos y salir?',
          [
            { text: 'Cancelar', style: 'cancel', onPress: () => {} },
            {
              text: 'Descartar',
              style: 'destructive',
              onPress: () => navigation.dispatch(e.data.action),
            },
          ]
        );
      };
      navigation.addListener('beforeRemove', onBeforeRemove);
      return () => navigation.removeListener('beforeRemove', onBeforeRemove);
    }, [navigation, hasChanges, saving])
  );

  function setField(field, value) {
    setValues(v => ({ ...v, [field]: value }));
  }

  // ---- Wholesale Logic ----

  function addWholesalePrice() {
    if (values.wholesalePrices.length >= 5) {
      Alert.alert('Límite alcanzado', 'Solo puedes agregar hasta 5 precios de mayorista.');
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

      // Lógica de margen mayorista
      if (field === 'price') {
          // Si cambiamos precio, calculamos margen
          if (v.purchasePrice) {
              currentItem.margin = calculateMarginFromSalePrice(v.purchasePrice, value);
          }
      } else if (field === 'margin') {
          // Si cambiamos margen, calculamos precio
          if (v.purchasePrice) {
              currentItem.price = calculateSalePriceFromMargin(v.purchasePrice, value);
          }
      }

      newPrices[index] = currentItem;
      return { ...v, wholesalePrices: newPrices };
    });
  }

  // -------------------------

  function validateValues() {
    if (!values.name || values.name.toString().trim() === '') return { ok: false, msg: 'El nombre es obligatorio.' };
    const cost = Number(values.purchasePrice);
    if (Number.isNaN(cost) || cost < 0) return { ok: false, msg: 'Precio de compra inválido.' };

    // Validar venta
    const sp = Number(values.salePrice);
    if (Number.isNaN(sp) || sp <= 0) return { ok: false, msg: 'Precio de venta inválido.' };

    for (let i = 0; i < values.wholesalePrices.length; i++) {
      const item = values.wholesalePrices[i];
      const p = Number(item.price);
      const q = Number(item.quantity);
      if (Number.isNaN(p) || p <= 0) return { ok: false, msg: `El precio mayorista #${i+1} es inválido.` };
      if (Number.isNaN(q) || q <= 0) return { ok: false, msg: `El umbral (cantidad) mayorista #${i+1} es inválido.` };
    }

    return { ok: true };
  }

  async function handleSave() {
    const currentUser = auth().currentUser;
    if (!currentUser?.email) {
      Alert.alert('Error', 'No se pudo obtener la información del usuario para registrar la operación.');
      return;
    }

    const valCheck = validateValues();
    if (!valCheck.ok) {
      Alert.alert('Validación', valCheck.msg);
      return;
    }

    setSaving(true);
    try {
      // Validar duplicados (excepto el actual)
      const ndup = await productsService.validateNoDuplicates({
          name: values.name,
          barcode: values.barcode || null,
          currentId: productId
      });

      if (!ndup.ok) {
        Alert.alert('Duplicado', ndup.message || 'El producto ya existe.');
        setSaving(false);
        return;
      }

      const processedWholesale = values.wholesalePrices.map(wp => ({
        price: Number(wp.price),
        quantity: Number(wp.quantity)
      }));

      const payload = {
        name: values.name,
        barcode: values.barcode,
        description: values.description || '',
        purchasePrice: Number(values.purchasePrice),
        profitMargin: Number(values.profitMargin),
        autoSalePrice: Boolean(values.autoSalePrice),
        salePrice: Number(values.salePrice) || null,
        measureType: values.measureType,
        wholesalePrices: processedWholesale,
        updatedAt: serverTimestamp()
      };

      const docRef = db.doc(`products/${productId}`);
      await docRef.update(payload);

      // Registrar operación de actualización
      const initialValues = JSON.parse(initialRef.current);
      const changes = {};
      Object.keys(values).forEach(key => {
        const oldValue = initialValues[key];
        const newValue = values[key];

        if (key === 'wholesalePrices') {
          if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            changes[key] = { from: oldValue, to: newValue };
          }
          return;
        }

        if (String(oldValue) !== String(newValue)) {
          changes[key] = { from: oldValue, to: newValue };
        }
      });

      if (Object.keys(changes).length > 0) {
        await createProductOperation({
          productId: productId,
          productName: values.name,
          operationType: 'update',
          userEmail: currentUser.email, // Use the user's email
          details: {
            description: `Se actualizaron los campos: ${Object.keys(changes).join(', ')}.`,
            changes: changes
          }
        });
      }

      // Actualizar ref para evitar prompt de descartar
      initialRef.current = JSON.stringify({
          ...values,
          wholesalePrices: values.wholesalePrices.map(wp => ({
              price: Number(wp.price),
              quantity: Number(wp.quantity)
              // margin no se guarda en BD, así que lo "limpiamos" en la ref teórica o lo incluimos si es consistente
          }))
      });

      setProduct(prev => ({ ...prev, ...payload, wholesalePrices: processedWholesale }));
      Alert.alert('Guardado', 'Producto actualizado correctamente.',[
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      console.error('Error guardando producto:', err);
      Alert.alert('Error', 'No se pudo guardar el producto. Intenta de nuevo.');
    } finally {
      // Delay pequeño para asegurar que el estado se actualice antes de desmontar si es muy rápido
      setTimeout(() => {
           if (navigation.isFocused()) setSaving(false);
      }, 500);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 10, color: '#666' }}>Cargando producto...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#F5F6FA' }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
        <View style={globalStyles.header}>
			<TouchableOpacity onPress={() => {
                if(hasChanges()) {
                     Alert.alert(
                      'Descartar cambios?',
                      'Tienes cambios sin guardar. ¿Deseas descartarlos y salir?',
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Descartar', style: 'destructive', onPress: () => navigation.goBack() },
                      ]
                    );
                } else {
                    navigation.goBack();
                }
			  }}>
			  <Icon name="chevron-back" size={26} color="#fff" />
			</TouchableOpacity>
			<Text style={globalStyles.title}>Editar producto</Text>
            {/* Espaciador para balancear header */}
            <View style={{width: 26}} />
		</View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{flex: 1}}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderRelease={() => Keyboard.dismiss()}
        >

          {/* Section: Información Básica */}
          <View style={styles.section}>
              <Text style={styles.sectionTitle}>Información Básica</Text>

              <Text style={styles.label}>Nombre del producto</Text>
              <TextInput
                ref={assignRef('name')}
                style={styles.input}
                value={values.name}
                onFocus={() => { focusedField.current = 'name'; }}
                onBlur={() => { if (focusedField.current === 'name') focusedField.current = null; }}
                onChangeText={t => setField('name', t)}
                placeholder="Ej. Pechuga de Pollo"
                placeholderTextColor="#999"
              />

              <View style={styles.rowInputs}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.label}>Código de barras</Text>
                      <View style={styles.inputWithIconContainer}>
                          <TextInput
                            ref={assignRef('barcode')}
                            style={[styles.inputNoBorder, {flex: 1}]}
                            value={values.barcode}
                            onFocus={() => { focusedField.current = 'barcode'; }}
                            onBlur={() => { if (focusedField.current === 'barcode') focusedField.current = null; }}
                            onChangeText={t => setField('barcode', t)}
                            placeholder="Opcional"
                            placeholderTextColor="#999"
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
                      <Text style={styles.label}>Unidad de Medida</Text>
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
                onFocus={() => { focusedField.current = 'description'; }}
                onBlur={() => { if (focusedField.current === 'description') focusedField.current = null; }}
                onChangeText={t => setField('description', t)}
                placeholder="Breve descripción del producto..."
                placeholderTextColor="#999"
              />
          </View>

          {/* Section: Precios y Costos */}
          <View style={styles.section}>
             <Text style={styles.sectionTitle}>Precios y Costos</Text>

             <Text style={styles.label}>Costo de Compra ($)</Text>
             <TextInput
                ref={assignRef('purchasePrice')}
                style={styles.input}
                keyboardType="numeric"
                value={values.purchasePrice}
                onFocus={() => { focusedField.current = 'purchasePrice'; }}
                onBlur={() => { if (focusedField.current === 'purchasePrice') focusedField.current = null; }}
                onChangeText={t => handlePriceChange('purchasePrice', t)}
                placeholder="0.00"
                placeholderTextColor="#999"
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
                        onFocus={() => { focusedField.current = 'profitMargin'; }}
                        onBlur={() => { if (focusedField.current === 'profitMargin') focusedField.current = null; }}
                        onChangeText={t => handlePriceChange('profitMargin', t)}
                        placeholder="0"
                        placeholderTextColor="#999"
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
                        onFocus={() => { focusedField.current = 'salePrice'; }}
                        onBlur={() => { if (focusedField.current === 'salePrice') focusedField.current = null; }}
                        onChangeText={t => handlePriceChange('salePrice', t)}
                        placeholder="0.00"
                        placeholderTextColor="#999"
                    />
                 </View>
             </View>

             <View style={styles.infoRow}>
                 <Icon name="information-circle-outline" size={16} color="#666" />
                 <Text style={styles.infoText}>
                    Modifica el margen o el precio final y el otro se calculará automáticamente.
                 </Text>
             </View>
          </View>

          {/* Section: Precios Mayorista */}
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
                        <Text style={styles.subLabel}>Cant. Mínima</Text>
                        <TextInput
                            ref={assignRef(`wholesale_qty_${index}`)}
                            style={styles.inputSmall}
                            keyboardType="numeric"
                            placeholder="Ej. 10"
                            placeholderTextColor="#999"
                            value={String(wp.quantity)}
                            onFocus={() => { focusedField.current = `wholesale_qty_${index}`; }}
                            onBlur={() => { if (focusedField.current === `wholesale_qty_${index}`) focusedField.current = null; }}
                            onChangeText={t => updateWholesalePrice(index, 'quantity', t)}
                        />
                    </View>

                    <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.subLabel}>Margen (%)</Text>
                        <TextInput
                            ref={assignRef(`wholesale_margin_${index}`)}
                            style={styles.inputSmall}
                            keyboardType="numeric"
                            placeholder="%"
                            placeholderTextColor="#999"
                            value={String(wp.margin)}
                            onFocus={() => { focusedField.current = `wholesale_margin_${index}`; }}
                            onBlur={() => { if (focusedField.current === `wholesale_margin_${index}`) focusedField.current = null; }}
                            onChangeText={t => updateWholesalePrice(index, 'margin', t)}
                        />
                    </View>

                    <View style={{ flex: 1, marginRight: 4 }}>
                        <Text style={styles.subLabel}>Precio ($)</Text>
                        <TextInput
                            ref={assignRef(`wholesale_price_${index}`)}
                            style={[styles.inputSmall, { color: '#007AFF', fontWeight: '700' }]}
                            keyboardType="numeric"
                            placeholder="$"
                            placeholderTextColor="#999"
                            value={String(wp.price)}
                            onFocus={() => { focusedField.current = `wholesale_price_${index}`; }}
                            onBlur={() => { if (focusedField.current === `wholesale_price_${index}`) focusedField.current = null; }}
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
                <Text style={styles.emptyText}>No hay precios mayoristas configurados.</Text>
            )}
          </View>
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
                    <Text style={styles.saveBtnText}>Guardar Cambios</Text>
                  </>
              )}
          </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: '#111',
      marginBottom: 16,
  },
  label: {
      fontSize: 13,
      color: '#666',
      marginBottom: 6,
      fontWeight: '600',
      textTransform: 'uppercase'
  },
  subLabel: {
      fontSize: 11,
      color: '#888',
      marginBottom: 4,
      fontWeight: '600'
  },
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
  inputSmall: {
    backgroundColor: '#F5F6FA',
    padding: 10,
    borderRadius: 8,
    fontSize: 14,
    color: '#333',
    borderWidth: 1,
    borderColor: '#eee'
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
  rowInputs: {
      flexDirection: 'row',
      marginBottom: 16
  },

  // Percent Input
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
  percentInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#333'
  },
  percentSymbol: {
    fontSize: 16,
    color: '#999',
    fontWeight: 'bold'
  },

  // Toggles
  toggleContainer: {
      flexDirection: 'row',
      backgroundColor: '#F0F0F0',
      borderRadius: 10,
      padding: 3,
      marginBottom: 16,
      height: 48
  },
  toggleBtn: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 8
  },
  toggleBtnActive: {
      backgroundColor: '#fff',
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2
  },
  toggleText: {
      fontSize: 13,
      color: '#888',
      fontWeight: '600'
  },
  toggleTextActive: {
      color: '#007AFF',
      fontWeight: '700'
  },

  // Wholesale
  addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#007AFF',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20
  },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 4 },
  wholesaleRow: {
      marginBottom: 12,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0'
  },
  deleteButton: {
      padding: 8,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 18
  },
  emptyText: {
      fontSize: 13,
      color: '#999',
      fontStyle: 'italic',
      textAlign: 'center',
      marginTop: 10
  },
  infoRow: {
      flexDirection: 'row',
      backgroundColor: '#E3F2FD',
      padding: 10,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: -8
  },
  infoText: {
      color: '#1565C0',
      fontSize: 12,
      marginLeft: 6,
      flex: 1
  },

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
