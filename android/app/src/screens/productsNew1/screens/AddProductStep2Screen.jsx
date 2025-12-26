// src/screens/AddProductStep2Screen.jsx
import React, { useCallback, useRef, useState } from 'react';
import { View, Alert, ActivityIndicator, TouchableOpacity, Text  } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import ProductFormStep2 from '../components/ProductFormStep2';
import { useProductForm } from '../hooks/useProductForm';
import productsService from '../services/productsService';
import globalStyles from '../../../styles/globalStyles';
import Icon from 'react-native-vector-icons/Ionicons';

export default function AddProductStep2Screen() {
  const navigation = useNavigation();
  const { values, setField, reset, getValues } = useProductForm();
  const [saving, setSaving] = useState(false);

  const initialRef = useRef(JSON.stringify(values));

  const hasChanges = useCallback(() => {
    try {
      return initialRef.current !== JSON.stringify(values);
    } catch (e) {
      return true;
    }
  }, [values]);

  useFocusEffect(
    useCallback(() => {
      const beforeRemove = (e) => {
        if (!hasChanges()) return;
        e.preventDefault();
        Alert.alert('Descartar cambios?', 'Tienes cambios sin guardar. ¿Deseas descartarlos y salir?', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Descartar', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ]);
      };
      navigation.addListener('beforeRemove', beforeRemove);
      return () => navigation.removeListener('beforeRemove', beforeRemove);
    }, [navigation, hasChanges])
  );

  function handleBack() {
    navigation.goBack();
  }

  function handleCancel() {
    reset();
    navigation.goBack();
  }

  async function handleSubmit() {
    const current = getValues();
    const name = (current.name || '').toString().trim();
    if (!name) { Alert.alert('Validación', 'El nombre es obligatorio.'); return; }

    const purchasePrice = current.purchasePrice;
    if (purchasePrice === '' || purchasePrice == null || Number.isNaN(Number(purchasePrice)) || Number(purchasePrice) < 0) {
      Alert.alert('Validación', 'Precio de compra inválido.'); return;
    }

    const profitMargin = current.profitMargin;
    if (profitMargin === '' || profitMargin == null || Number.isNaN(Number(profitMargin)) || Number(profitMargin) < 0 || Number(profitMargin) >= 100) {
      Alert.alert('Validación', 'Margen inválido. Debe estar entre 0 y 99.'); return;
    }

    setSaving(true);
    try {
      const dup = await productsService.validateNoDuplicates({ name, barcode: current.barcode || null, currentId: null });
      if (!dup.ok) { Alert.alert('Duplicado', dup.message || 'Ya existe un producto con ese valor.'); setSaving(false); return; }

      let salePriceFinal = current.salePrice;
      if (current.autoSalePrice) {
        const cost = Number(current.purchasePrice);
        const margin = Number(current.profitMargin);
        if (margin >= 100) { Alert.alert('Validación', 'El margen debe ser menor a 100.'); setSaving(false); return; }
        salePriceFinal = Number((cost / (1 - margin / 100)).toFixed(2));
      } else {
        salePriceFinal = Number(current.salePrice);
      }

      const payload = {
        name,
        barcode: current.barcode || null,
        description: current.description || '',
        purchasePrice: Number(current.purchasePrice),
        profitMargin: Number(current.profitMargin),
        autoSalePrice: !!current.autoSalePrice,
        salePrice: salePriceFinal,
        measureType: current.measureType || 'unit',
        wholesalePrice: current.wholesalePrice !== '' && current.wholesalePrice != null ? Number(current.wholesalePrice) : null,
        wholesaleThreshold: current.wholesaleThreshold !== '' && current.wholesaleThreshold != null ? Number(current.wholesaleThreshold) : null,
        stock: 0,
      };

      const newId = await productsService.createProduct(payload);
      reset();
      Alert.alert('Éxito', 'Producto creado correctamente.', [
        { text: 'Ver producto', onPress: () => navigation.navigate('EditProduct', { productId: newId }) },
        { text: 'Ir a lista', onPress: () => navigation.navigate('ProductsList') },
      ]);
    } catch (err) {
      console.error('Error al crear producto:', err);
      Alert.alert('Error', 'No fue posible crear el producto. Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  }

  if (saving) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
		<View style={globalStyles.header}>
			<TouchableOpacity onPress={() => {
				//resetQuickSale();
				navigation.goBack();
			  }}>
			  <Icon name="chevron-back" size={26} color="#fff" />
			</TouchableOpacity>
			<Text style={globalStyles.title}>Detalles del producto</Text>

		</View>
      <ProductFormStep2 values={values} setField={setField} onBack={handleBack} onSubmit={handleSubmit} onCancel={handleCancel} />
    </View>
  );
}
