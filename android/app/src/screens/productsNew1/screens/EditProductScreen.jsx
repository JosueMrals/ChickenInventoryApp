// screens/EditProductScreen.jsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  Button,
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
import { db } from '../../../services/firebase'; // ajusta la ruta si hace falta
import firestore from '@react-native-firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';

export default function EditProductScreen({ route, navigation }) {
  const { productId } = route.params ?? {};
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState(null);
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

  const initialRef = useRef(null);

  // ---------------------
  // Refs y estado para manejar teclado y scroll (NUEVO)
  // ---------------------
  const scrollRef = useRef(null);
  const inputsRef = useRef({}); // guardará refs: inputsRef.current['name'] = ref
  const focusedField = useRef(null); // nombre del campo enfocado
  const keyboardHeightRef = useRef(0);

  // Helper para asignar refs a los TextInput de forma dinámica
  const assignRef = (field) => (r) => {
    inputsRef.current[field] = r;
  };

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

        let loadedWholesalePrices = [];
        if (Array.isArray(data.wholesalePrices)) {
          loadedWholesalePrices = data.wholesalePrices;
        } else if (data.wholesalePrice && data.wholesaleThreshold) {
          loadedWholesalePrices = [{
            price: data.wholesalePrice,
            quantity: data.wholesaleThreshold
          }];
        }

        const normalized = {
          name: data.name ?? '',
          barcode: data.barcode ?? '',
          description: data.description ?? '',
          purchasePrice: data.purchasePrice ?? '',
          profitMargin: data.profitMargin ?? '',
          autoSalePrice: data.autoSalePrice ?? true,
          salePrice: data.salePrice ?? '',
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

  // Recalculate salePrice automatically when autoSalePrice true
  useEffect(() => {
    const { purchasePrice, profitMargin, autoSalePrice } = values;
    const cost = Number(purchasePrice);
    const margin = Number(profitMargin);
    if (autoSalePrice && !Number.isNaN(cost) && !Number.isNaN(margin) && margin < 100) {
      const sale = cost / (1 - (margin / 100));
      setValues(v => ({ ...v, salePrice: Number(sale.toFixed(2)) }));
    }
  }, [values.purchasePrice, values.profitMargin, values.autoSalePrice]);

  // ---------------------
  // Listeners del teclado (NUEVO)
  // ---------------------
  useEffect(() => {
    // Cuando el teclado se muestra
    const onKeyboardShow = (e) => {
      const kbHeight = e?.endCoordinates?.height ?? 0;
      keyboardHeightRef.current = kbHeight;
      // Intentamos desplazar el input enfocado si está cubierto
      setTimeout(() => { // con timeout pequeño para que la medición sea correcta después de la animación del teclado
        ensureFocusedInputVisible(kbHeight);
      }, Platform.OS === 'ios' ? 50 : 0);
    };

    const onKeyboardHide = () => {
      keyboardHeightRef.current = 0;
      // opcional: volver a posición original
      // scrollRef.current?.scrollTo({ y: 0, animated: true });
    };

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, onKeyboardShow);
    const hideSub = Keyboard.addListener(hideEvent, onKeyboardHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Mide el input enfocado y lo desplaza si queda cubierto por el teclado (NUEVO)
  const ensureFocusedInputVisible = async (keyboardHeight = keyboardHeightRef.current) => {
    try {
      const field = focusedField.current;
      if (!field) return;
      const ref = inputsRef.current[field];
      if (!ref || !scrollRef.current) return;

      // Try measureInWindow from the input ref:
      // Algunos refs tienen .measureInWindow; si no, salimos
      if (typeof ref.measureInWindow === 'function') {
        ref.measureInWindow((x, y, width, height) => {
          const windowHeight = Dimensions.get('window').height;
          const inputBottom = y + height;
          const availableArea = windowHeight - keyboardHeight; // espacio visible sobre el teclado
          const extraOffset = 10; // espacio extra para que no quede pegado
          if (inputBottom + extraOffset > availableArea) {
            const diff = inputBottom + extraOffset - availableArea;
            // current scroll position not easily accessible; scrollTo diff relative to current y:
            // Mejor: hacemos scrollTo currentY + diff; sin currentY, hacemos scrollTo diff (aprox)
            // Para mayor precisión podemos pedir scrollResponderScrollNativeHandleToKeyboard, pero usamos scrollRef.scrollTo
            scrollRef.current.scrollTo({ y: diff + (Platform.OS === 'ios' ? 0 : 20), animated: true });
          }
        });
      } else {
        // fallback si ref no expone measureInWindow
        // No hacemos nada (podrías usar UIManager.measure con findNodeHandle)
      }
    } catch (err) {
      console.warn('Error al asegurar visibilidad input:', err);
    }
  };

  // ---------------------
  // Resto de tus helpers y lógica (sin cambios significativos)
  // ---------------------
  const hasChanges = useCallback(() => {
    const current = JSON.stringify(values);
    return initialRef.current !== null && current !== initialRef.current;
  }, [values]);

  useFocusEffect(
    useCallback(() => {
      const onBeforeRemove = (e) => {
        if (!hasChanges()) return;
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
    }, [navigation, hasChanges])
  );

  function setField(field, value) {
    setValues(v => ({ ...v, [field]: value }));
  }

  function addWholesalePrice() {
    if (values.wholesalePrices.length >= 5) {
      Alert.alert('Límite alcanzado', 'Solo puedes agregar hasta 5 precios de mayorista.');
      return;
    }
    setValues(v => ({
      ...v,
      wholesalePrices: [...v.wholesalePrices, { price: '', quantity: '' }]
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
      newPrices[index] = { ...newPrices[index], [field]: value };
      return { ...v, wholesalePrices: newPrices };
    });
  }

  function validateValues() {
    if (!values.name || values.name.toString().trim() === '') return { ok: false, msg: 'El nombre es obligatorio.' };
    const cost = Number(values.purchasePrice);
    if (Number.isNaN(cost) || cost < 0) return { ok: false, msg: 'Precio de compra inválido.' };
    const margin = Number(values.profitMargin);
    if (Number.isNaN(margin) || margin < 0 || margin >= 100) return { ok: false, msg: 'Margen inválido. Debe estar entre 0 y 99.' };
    if (!values.measureType) return { ok: false, msg: 'Selecciona un tipo de medida.' };
    if (!values.autoSalePrice) {
      const sp = Number(values.salePrice);
      if (Number.isNaN(sp) || sp <= 0) return { ok: false, msg: 'Precio de venta inválido.' };
    }

    for (let i = 0; i < values.wholesalePrices.length; i++) {
      const item = values.wholesalePrices[i];
      const p = Number(item.price);
      const q = Number(item.quantity);
      if (Number.isNaN(p) || p <= 0) return { ok: false, msg: `El precio mayorista #${i+1} es inválido.` };
      if (Number.isNaN(q) || q <= 0) return { ok: false, msg: `El umbral (cantidad) mayorista #${i+1} es inválido.` };
    }

    return { ok: true };
  }

  async function hasDuplicate(field, value) {
    try {
      const q = db.collection('products').where(field, '==', value).get();
      const snap = await q;
      if (snap.empty) return false;
      const others = snap.docs.filter(d => d.id !== productId);
      return others.length > 0;
    } catch (err) {
      console.error('Error checking duplicates:', err);
      return false;
    }
  }

  async function handleSave() {
    const valCheck = validateValues();
    if (!valCheck.ok) {
      Alert.alert('Validación', valCheck.msg);
      return;
    }

    setSaving(true);
    try {
      const ndup = await hasDuplicate('name', values.name);
      if (ndup) {
        Alert.alert('Duplicado', 'El nombre ya está en uso por otro producto.');
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
        wholesalePrice: firestore.FieldValue.delete(),
        wholesaleThreshold: firestore.FieldValue.delete(),
        updatedAt: firestore.FieldValue.serverTimestamp()
      };

      const docRef = db.doc(`products/${productId}`);
      await docRef.update(payload);

      initialRef.current = JSON.stringify({
        name: values.name,
        barcode: values.barcode,
        description: values.description,
        purchasePrice: values.purchasePrice,
        profitMargin: values.profitMargin,
        autoSalePrice: values.autoSalePrice,
        salePrice: values.salePrice,
        measureType: values.measureType,
        wholesalePrices: values.wholesalePrices
      });
      setProduct(prev => ({ ...prev, ...payload, wholesalePrices: processedWholesale }));
      Alert.alert('Guardado', 'Producto actualizado correctamente.',[
        { text: 'Ver producto', onPress: () => navigation.navigate('EditProduct') },
        { text: 'Ir a lista', onPress: () => navigation.navigate('ProductsList') },
      ]);
    } catch (err) {
      console.error('Error guardando producto:', err);
      Alert.alert('Error', 'No se pudo guardar el producto. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Cargando producto...</Text>
      </View>
    );
  }

  // ---------------------
  // Render: usamos KeyboardAvoidingView para iOS pero el scroll real lo manejamos con listeners (NUEVO)
  // ---------------------
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#fff' }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Nombre</Text>
        <TextInput
          ref={assignRef('name')} // asignamos ref
          style={styles.input}
          value={values.name}
          onFocus={() => { focusedField.current = 'name'; }}
          onBlur={() => { if (focusedField.current === 'name') focusedField.current = null; }}
          onChangeText={t => setField('name', t)}
        />

        <Text style={styles.label}>Código de barras</Text>
        <TextInput
          ref={assignRef('barcode')}
          style={styles.input}
          value={values.barcode}
          onFocus={() => { focusedField.current = 'barcode'; }}
          onBlur={() => { if (focusedField.current === 'barcode') focusedField.current = null; }}
          onChangeText={t => setField('barcode', t)}
        />

        <Text style={styles.label}>Descripción</Text>
        <TextInput
          ref={assignRef('description')}
          style={[styles.input, { height: 80 }]}
          multiline
          value={values.description}
          onFocus={() => { focusedField.current = 'description'; }}
          onBlur={() => { if (focusedField.current === 'description') focusedField.current = null; }}
          onChangeText={t => setField('description', t)}
        />

        <Text style={styles.label}>Precio de compra</Text>
        <TextInput
          ref={assignRef('purchasePrice')}
          style={styles.input}
          keyboardType="numeric"
          value={String(values.purchasePrice)}
          onFocus={() => { focusedField.current = 'purchasePrice'; }}
          onBlur={() => { if (focusedField.current === 'purchasePrice') focusedField.current = null; }}
          onChangeText={t => setField('purchasePrice', t)}
        />

        <Text style={styles.label}>Margen de ganancia (%)</Text>
        <TextInput
          ref={assignRef('profitMargin')}
          style={styles.input}
          keyboardType="numeric"
          value={String(values.profitMargin)}
          onFocus={() => { focusedField.current = 'profitMargin'; }}
          onBlur={() => { if (focusedField.current === 'profitMargin') focusedField.current = null; }}
          onChangeText={t => setField('profitMargin', t)}
        />

        <View style={styles.row}>
          <Text style={{ flex: 1, marginTop: 6 }}>Calcular precio de venta automáticamente</Text>
          <Switch value={values.autoSalePrice} onValueChange={v => setField('autoSalePrice', v)} />
        </View>

        {!values.autoSalePrice && (
          <>
            <Text style={styles.label}>Precio de venta (manual)</Text>
            <TextInput
              ref={assignRef('salePrice')}
              style={styles.input}
              keyboardType="numeric"
              value={String(values.salePrice)}
              onFocus={() => { focusedField.current = 'salePrice'; }}
              onBlur={() => { if (focusedField.current === 'salePrice') focusedField.current = null; }}
              onChangeText={t => setField('salePrice', t)}
            />
          </>
        )}

        {values.autoSalePrice && (
          <Text style={{ marginVertical: 8 }}>Precio de venta calculado: {values.salePrice ?? '—'}</Text>
        )}

        <Text style={styles.label}>Tipo de medida</Text>
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          <Button title="Unidad" onPress={() => setField('measureType', 'unit')} color={values.measureType === 'unit' ? undefined : '#888'} />
          <View style={{ width: 8 }} />
          <Button title="Peso" onPress={() => setField('measureType', 'weight')} color={values.measureType === 'weight' ? undefined : '#888'} />
        </View>

        <View style={{ marginTop: 20, marginBottom: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold' }}>Precios de Mayorista</Text>
          <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
            Puedes agregar hasta 5 precios por volumen.
          </Text>

          {values.wholesalePrices.map((wp, index) => (
            <View key={index} style={styles.wholesaleRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.subLabel}>Precio</Text>
                <TextInput
                  ref={assignRef(`wholesale_price_${index}`)}
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="0.00"
                  value={String(wp.price)}
                  onFocus={() => { focusedField.current = `wholesale_price_${index}`; }}
                  onBlur={() => { if (focusedField.current === `wholesale_price_${index}`) focusedField.current = null; }}
                  onChangeText={t => updateWholesalePrice(index, 'price', t)}
                />
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.subLabel}>Umbral (Cant.)</Text>
                <TextInput
                  ref={assignRef(`wholesale_qty_${index}`)}
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="10"
                  value={String(wp.quantity)}
                  onFocus={() => { focusedField.current = `wholesale_qty_${index}`; }}
                  onBlur={() => { if (focusedField.current === `wholesale_qty_${index}`) focusedField.current = null; }}
                  onChangeText={t => updateWholesalePrice(index, 'quantity', t)}
                />
              </View>
              <View style={{ justifyContent: 'flex-end', paddingBottom: 2 }}>
                <TouchableOpacity onPress={() => removeWholesalePrice(index)} style={styles.deleteButton}>
                  <Text style={{ color: 'white', fontWeight: 'bold' }}>X</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {values.wholesalePrices.length < 5 && (
              <Button title="+ Agregar precio mayorista" onPress={addWholesalePrice} />
          )}
        </View>

        <View style={{ height: 12 }} />

        {saving ? (
          <ActivityIndicator />
        ) : (
          <>
            <Button title="Guardar cambios" onPress={handleSave} />
            <View style={{ height: 8 }} />
            <Button title="Cancelar" color="#888" onPress={() => {
              if (hasChanges()) {
                Alert.alert('Descartar cambios?', 'Estás a punto de descartar los cambios.', [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Descartar', style: 'destructive', onPress: () => navigation.goBack() }
                ]);
              } else navigation.goBack();
            }} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { marginTop: 12, marginBottom: 6, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 6,
    backgroundColor: '#fff'
  },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 8 },
  wholesaleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#eee'
  },
  subLabel: {
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 4
  },
  deleteButton: {
      backgroundColor: '#ff4444',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 6,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 18
  }
});
