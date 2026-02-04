// src/screens/AddProductStep1Screen.jsx
import React, { useCallback, useRef, useState, useEffect } from 'react';
import { View, Alert, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import ProductFormStep1 from '../components/ProductFormStep1';
import { useProductForm } from '../hooks/useProductForm';
import productsService from '../services/productsService';
import globalStyles from '../../../styles/globalStyles';
import Icon from 'react-native-vector-icons/Ionicons';

export default function AddProductStep1Screen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { scannedCode } = route.params || {};

  const { values, setField, reset } = useProductForm();
  const [checking, setChecking] = useState(false);
  const initialRef = useRef(JSON.stringify(values));

  // Efecto para asignar código escaneado si viene de la lista
  useEffect(() => {
      if (scannedCode) {
          setField('barcode', scannedCode);
      }
  }, [scannedCode]);

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

  function handleOpenScanner() {
    navigation.navigate('BarcodeScanner', { onScanned: (code) => setField('barcode', code) });
  }

  async function handleNext() {
    const name = (values.name || '').toString().trim();
    const barcode = values.barcode ? values.barcode.toString().trim() : '';

    if (!name) { Alert.alert('Validación', 'El nombre es obligatorio.'); return; }
    if (name.length < 2) { Alert.alert('Validación', 'El nombre debe tener al menos 2 caracteres.'); return; }

    setChecking(true);
    try {
      const res = await productsService.validateNoDuplicates({ name, barcode: barcode || null, currentId: null });
      if (!res.ok) {
        Alert.alert('Duplicado', res.message || 'Ya existe un producto con ese valor.');
        setChecking(false);
        return;
      }
      initialRef.current = JSON.stringify(values);
      navigation.navigate('AddProductStep2');
    } catch (err) {
      console.error('validateNoDuplicates error:', err);
      Alert.alert('Error', 'No se pudo validar duplicados. Revisa la conexión e intenta de nuevo.');
    } finally {
      setChecking(false);
    }
  }

  function handleCancel() {
    reset();
    navigation.goBack();
  }

  if (checking) {
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
      <ProductFormStep1 values={values} setField={setField} onNext={handleNext} onCancel={handleCancel} onOpenScanner={handleOpenScanner} />
    </View>
  );
}
