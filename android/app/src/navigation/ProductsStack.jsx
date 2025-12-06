// src/navigation/ProductsStack.jsx
import React from 'react';
import { Button } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Ajusta rutas según tu proyecto
import ProductsListScreen from '../screens/productsNew1/screens/ProductsListScreen';
import AddProductStep1Screen from '../screens/productsNew1/screens/AddProductStep1Screen';
import AddProductStep2Screen from '../screens/productsNew1/screens/AddProductStep2Screen';
import EditProductScreen from '../screens/productsNew1/screens/EditProductScreen';
import AddStockScreen from '../screens/productsNew1/screens/AddStockScreen';

const Stack = createNativeStackNavigator();

export default function ProductsStack() {
  return (
    <Stack.Navigator
      initialRouteName="ProductsList"
      screenOptions={{
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#111',
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: '#f7f7f7', paddingBottom: 20 },
      }}
    >
      <Stack.Screen
        name="ProductsList"
        component={ProductsListScreen}
        options={({ navigation }) => ({
          title: 'Productos',
          // botón para crear nuevo producto en el header
          headerRight: () => (
            <Button
              title="Agregar"
              onPress={() => navigation.navigate('AddProductStep1')}
            />
          ),
        })}
      />

      {/* Flujo de creación en 2 pasos */}
      <Stack.Screen
        name="AddProductStep1"
        component={AddProductStep1Screen}
        options={{
          title: 'Nuevo producto - Paso 1',
          // deshabilita gestos para evitar salir accidentalmente; cada screen puede manejar beforeRemove
          gestureEnabled: false,
        }}
      />

      <Stack.Screen
        name="AddProductStep2"
        component={AddProductStep2Screen}
        options={{
          title: 'Nuevo producto - Paso 2',
          gestureEnabled: false,
        }}
      />

      <Stack.Screen
        name="EditProduct"
        component={EditProductScreen}
        // Muestra el nombre del producto en el header si lo pasas por params: { productName }
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
    </Stack.Navigator>
  );
}
