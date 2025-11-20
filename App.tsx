import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import LoginScreen from './android/app/src/screens/LoginScreen';
import ProductList from './android/app/src/screens/ProductList';
import ProductForm from './android/app/src/screens/ProductForm';
import Sidebar from './android/app/src/components/Sidebar';
import ProfileScreen from './android/app/src/screens/ProfileScreen';
import RegisterScreen from './android/app/src/screens/RegisterScreen';
import SalesScreen from './android/app/src/screens/sales/SalesScreen';
import CreditsScreen from './android/app/src/screens/CreditsScreen';
import CustomersScreen from './android/app/src/screens/customer/CustomerListScreen';
import ProductListScreen from './android/app/src/screens/products/ProductListScreen';
import DashboardScreen from './android/app/src/screens/dashboard/DashboardScreen';

import QuickSaleProductsScreen from './android/app/src/screens/quicksalesNew/QuickSaleProductsScreen';
import QuickSaleCartScreen from './android/app/src/screens/quicksalesNew/QuickSaleCartScreen';
import QuickSalePaymentScreen from './android/app/src/screens/quicksalesNew/QuickSalePaymentScreen';
import QuickSaleDoneScreen from './android/app/src/screens/quicksalesNew/QuickSaleDoneScreen';
import QuickSaleStack from './android/app/src/navigation/QuickSaleStack';

import { QuickSaleProvider } from './android/app/src/screens/quicksalesNew/context/quickSaleContext';

import Ionicons from 'react-native-vector-icons/Ionicons';

import PrintersScreen from './android/app/src/screens/settings/printers/PrintersScreen'

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

function AppDrawer({ route }) {
  const { role, user } = route.params;

  return (
    <Drawer.Navigator
      initialRouteName="DashboardScreen"
      drawerContent={(props) => <Sidebar {...props} role={role} user={user} />}
      screenOptions={{ headerShown: false }}
    >
      <Drawer.Screen name="DashboardScreen">
        {(props) => <DashboardScreen {...props} user={user} role={role} />}
      </Drawer.Screen>
      <Drawer.Screen name="ProductList">
        {(props) => <ProductList {...props} user={user} role={role} />}
      </Drawer.Screen>
      <Drawer.Screen name="Sales">
         {(props) => <SalesScreen {...props} user={user} role={role} />}
       </Drawer.Screen>
       <Drawer.Screen name="ProductListScreen">
          {(props) => <ProductListScreen {...props} user={user} role={role} />}
        </Drawer.Screen>
      <Drawer.Screen name="ProductForm">
        {(props) => <ProductForm {...props} user={user} role={role} />}
      </Drawer.Screen>
      <Drawer.Screen name="Profile">
        {(props) => <ProfileScreen {...props} user={user} role={role} />}
      </Drawer.Screen>
      <Drawer.Screen name="Register">
          {(props) => <RegisterScreen {...props} user={user} role={role} />}
        </Drawer.Screen>
      <Drawer.Screen name="Customer">
        {(props) => <CustomersScreen {...props} user={user} role={role} />}
      </Drawer.Screen>
      <Drawer.Screen
        name="QuickSales"
        component={QuickSaleStack}
        options={{
          drawerLabel: "Venta Rápida",
          headerShown: false,
          swipeEnabled: false,
        }}
      />
      <Drawer.Screen name="Settings"
      component={PrintersScreen}
      options={{
        drawerLabel: "Impresoras Bluetooth",
        headerShown: false,
        swipeEnabled: false,
      }}/>

    </Drawer.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <QuickSaleProvider>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="AppDrawer" component={AppDrawer} />
          </Stack.Navigator>
        </QuickSaleProvider>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
