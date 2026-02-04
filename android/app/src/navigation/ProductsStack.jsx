// src/navigation/ProductsStack.jsx
import React from 'react';
import { Button } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Ajusta rutas según tu proyecto
import ProductsListScreen from '../screens/productsNew1/screens/ProductsListScreen';
import AddProductScreen from '../screens/productsNew1/screens/AddProductScreen'; // Nueva Pantalla Unificada
import EditProductScreen from '../screens/productsNew1/screens/EditProductScreen';
import AddStockScreen from '../screens/productsNew1/screens/AddStockScreen';
import BarcodeScannerScreen from '../screens/productsNew1/screens/BarcodeScannerScreen';

const Stack = createNativeStackNavigator();

export default function ProductsStack({route}) {
  const { role } = route.params ?? {};

  return (
    <Stack.Navigator
      initialRouteName="ProductsList"
      screenOptions={{
		headerShown: false,
		headerShadowVisible: false,
		headerBackTitleVisible: false,
	  }}
    >
      <Stack.Screen
        name="ProductsList"
        component={ProductsListScreen}
        initialParams={{ role }}
      />

      {/* Pantalla Unificada de Creación */}
      <Stack.Screen
        name="AddProduct"
        component={AddProductScreen}
        options={{
          title: 'Nuevo producto',
          gestureEnabled: false,
        }}
      />

      <Stack.Screen
        name="EditProduct"
        component={EditProductScreen}
        options={({ route }) => ({
          title: route?.params?.productName ? `Editar: ${route.params.productName}` : 'Editar producto',
        })}
      />

      <Stack.Screen
        name="AddStock"
        component={AddStockScreen}
        options={{
          title: 'Agregar stock',
        }}
      />

      <Stack.Screen
        name="BarcodeScanner"
        component={BarcodeScannerScreen}
        options={{
          presentation: 'fullScreenModal',
          headerShown: false
        }}
      />
    </Stack.Navigator>
  );
}
