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
  StyleSheet
} from 'react-native';
import { db } from '../../../services/firebase'; // ajusta la ruta si hace falta
import firestore from '@react-native-firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';

export default function EditProductScreen({ route, navigation }) {
  const { productId } = route.params ?? {};
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState(null); // original loaded product
  const [values, setValues] = useState({
    name: '',
    barcode: '',
    description: '',
    purchasePrice: '',
    profitMargin: '',
    autoSalePrice: true,
    salePrice: '',
    measureType: 'unit',
    wholesalePrice: '',
    wholesaleThreshold: '',
  });

  // keep initial snapshot to detect unsaved changes
  const initialRef = useRef(null);

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
        const normalized = {
          name: data.name ?? '',
          barcode: data.barcode ?? '',
          description: data.description ?? '',
          purchasePrice: data.purchasePrice ?? '',
          profitMargin: data.profitMargin ?? '',
          autoSalePrice: data.autoSalePrice ?? true,
          salePrice: data.salePrice ?? '',
          measureType: data.measureType ?? 'unit',
          wholesalePrice: data.wholesalePrice ?? '',
          wholesaleThreshold: data.wholesaleThreshold ?? '',
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
    // if margin invalid or >=100, leave salePrice as '' or null
  }, [values.purchasePrice, values.profitMargin, values.autoSalePrice]);

  // detect unsaved changes
  const hasChanges = useCallback(() => {
    const current = JSON.stringify(values);
    return initialRef.current !== null && current !== initialRef.current;
  }, [values]);

  // confirm before leaving if unsaved changes
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
      // cleanup
      return () => navigation.removeListener('beforeRemove', onBeforeRemove);
    }, [navigation, hasChanges])
  );

  // helper for updating fields
  function setField(field, value) {
    setValues(v => ({ ...v, [field]: value }));
  }

  // validation helpers
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
    return { ok: true };
  }

  // check duplicates for barcode/name excluding current doc
  async function hasDuplicate(field, value) {
    try {
      const q = db.collection('products').where(field, '==', value).get();
      const snap = await q;
      if (snap.empty) return false;
      // if there's any doc whose id != productId => duplicate
      const others = snap.docs.filter(d => d.id !== productId);
      return others.length > 0;
    } catch (err) {
      console.error('Error checking duplicates:', err);
      // fallback: avoid blocking user on network issues — return false but log
      return false;
    }
  }

  async function handleSave() {
    const valCheck = validateValues();
    if (!valCheck.ok) {
      Alert.alert('Validación', valCheck.msg);
      return;
    }

    // check duplicates
    setSaving(true);
    try {
      const ndup = await hasDuplicate('name', values.name);
      if (ndup) {
        Alert.alert('Duplicado', 'El nombre ya está en uso por otro producto.');
        setSaving(false);
        return;
      }

      // prepare payload (cast numbers)
      const payload = {
        name: values.name,
        barcode: values.barcode,
        description: values.description || '',
        purchasePrice: Number(values.purchasePrice),
        profitMargin: Number(values.profitMargin),
        autoSalePrice: Boolean(values.autoSalePrice),
        salePrice: Number(values.salePrice) || null,
        measureType: values.measureType,
        wholesalePrice: values.wholesalePrice ? Number(values.wholesalePrice) : null,
        wholesaleThreshold: values.wholesaleThreshold ? Number(values.wholesaleThreshold) : null,
        updatedAt: firestore.FieldValue.serverTimestamp()
      };

      // update document
      const docRef = db.doc(`products/${productId}`);
      await docRef.update(payload);

      // update local states
      initialRef.current = JSON.stringify({
        name: payload.name,
        barcode: payload.barcode,
        description: payload.description,
        purchasePrice: payload.purchasePrice,
        profitMargin: payload.profitMargin,
        autoSalePrice: payload.autoSalePrice,
        salePrice: payload.salePrice,
        measureType: payload.measureType,
        wholesalePrice: payload.wholesalePrice,
        wholesaleThreshold: payload.wholesaleThreshold
      });
      setProduct(prev => ({ ...prev, ...payload }));
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <Text style={styles.label}>Nombre</Text>
      <TextInput style={styles.input} value={values.name} onChangeText={t => setField('name', t)} />

      <Text style={styles.label}>Código de barras</Text>
      <TextInput style={styles.input} value={values.barcode} onChangeText={t => setField('barcode', t)} />

      <Text style={styles.label}>Descripción</Text>
      <TextInput style={[styles.input, { height: 80 }]} multiline value={values.description} onChangeText={t => setField('description', t)} />

      <Text style={styles.label}>Precio de compra</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={String(values.purchasePrice)} onChangeText={t => setField('purchasePrice', t)} />

      <Text style={styles.label}>Margen de ganancia (%)</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={String(values.profitMargin)} onChangeText={t => setField('profitMargin', t)} />

      <View style={styles.row}>
        <Text style={{ flex: 1, marginTop: 6 }}>Calcular precio de venta automáticamente</Text>
        <Switch value={values.autoSalePrice} onValueChange={v => setField('autoSalePrice', v)} />
      </View>

      {!values.autoSalePrice && (
        <>
          <Text style={styles.label}>Precio de venta (manual)</Text>
          <TextInput style={styles.input} keyboardType="numeric" value={String(values.salePrice)} onChangeText={t => setField('salePrice', t)} />
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

      <Text style={styles.label}>Precio mayorista</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={String(values.wholesalePrice ?? '')} onChangeText={t => setField('wholesalePrice', t)} />

      <Text style={styles.label}>Umbral mayorista (cantidad)</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={String(values.wholesaleThreshold ?? '')} onChangeText={t => setField('wholesaleThreshold', t)} />

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
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 8 }
});
