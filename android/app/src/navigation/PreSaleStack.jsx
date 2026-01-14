import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Screens
import PreSalesListScreen from '../screens/presales/PreSaleListScreen';
import PreSaleProductsScreen from '../screens/presales/PreSaleProductsScreen';
import PreSaleCartScreen from '../screens/presales/PreSaleCartScreen';
import PreSaleDetailScreen from '../screens/presales/PreSaleDetailScreen';
import AssignCustomerScreen from '../screens/presales/AssignCustomerScreen';
import PreSalePaymentScreen from '../screens/presales/PreSalePaymentScreen';
import PreSaleDoneScreen from '../screens/presales/PreSaleDoneScreen';
import ProductQuantityScreen from '../screens/presales/ProductQuantityScreen';


const Stack = createNativeStackNavigator();

export default function PreSaleStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PreSalesList" component={PreSalesListScreen} />
      <Stack.Screen name="PreSaleProducts" component={PreSaleProductsScreen} />
      <Stack.Screen name="PreSaleCart" component={PreSaleCartScreen} />
      <Stack.Screen name="PreSaleDetail" component={PreSaleDetailScreen} />
      <Stack.Screen name="AssignCustomer" component={AssignCustomerScreen} />
      <Stack.Screen name="PreSalePayment" component={PreSalePaymentScreen} />
      <Stack.Screen name="PreSaleDone" component={PreSaleDoneScreen} />
      <Stack.Screen name="ProductQuantity" component={ProductQuantityScreen} />
    </Stack.Navigator>
  );
}