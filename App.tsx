import React from 'react';
import { View, TouchableWithoutFeedback } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import auth from '@react-native-firebase/auth';

import LoginScreen from './android/app/src/screens/LoginScreen';
import ProductList from './android/app/src/screens/ProductList';
import ProductForm from './android/app/src/screens/ProductForm';
import Sidebar from './android/app/src/components/Sidebar';
import ProfileScreen from './android/app/src/screens/ProfileScreen';
import RegisterScreen from './android/app/src/screens/RegisterScreen';
import SalesScreen from './android/app/src/screens/sales/SalesScreen';
import CustomersScreen from './android/app/src/screens/customer/CustomerListScreen';
import ProductListScreen from './android/app/src/screens/products/ProductListScreen';
import DashboardScreen from './android/app/src/screens/dashboard/DashboardScreen';

import QuickSaleStack from './android/app/src/navigation/QuickSaleStack';
import ReportsScreen from './android/app/src/screens/reports/ReportsScreen';
import ProductsStack from './android/app/src/navigation/ProductsStack';
import PrintersScreen from './android/app/src/screens/settings/printers/PrintersScreen';

import useSessionTimeout from "./android/app/src/hooks/useSessionTimeout";
import { SessionManager } from './android/app/src/utils/SessionManager';

// Creamos la referencia de navegación globalmente para usarla fuera de componentes si es necesario
export const navigationRef = createNavigationContainerRef();

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

function AppDrawer({ route }) {
  const { role, user } = route.params || {};

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
      <Drawer.Screen name="Reports"
        component={ReportsScreen}
        options={{
          drawerLabel: "Reportes",
          headerShown: false,
          swipeEnabled: false,
        }}/>
    <Drawer.Screen name="ProductsStack"
        component={ProductsStack}
        options={{ headerShown: false
            }}
        initialParams={{ role, user }}
		/>

    </Drawer.Navigator>
  );
}

export default function App() {

  useSessionTimeout(() => {
      // Callback cuando expira la sesión
      (async () => {
        try {
          // 1. Cerrar sesión en Firebase Auth
          await auth().signOut();
        } catch (e) {
          console.log('Error signing out:', e);
        }
        
        // 2. Limpiar datos de sesión local
        await SessionManager.clear();
        
        // 3. Redirigir al Login usando la referencia global
        if (navigationRef.isReady()) {
          // Reseteamos el stack para que no pueda volver atrás
          navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
        }
      })();
    });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer ref={navigationRef}>
          <TouchableWithoutFeedback onPress={() => SessionManager.updateActivity()}>
            <View style={{ flex: 1 }}>
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="Login" component={LoginScreen} />
                  <Stack.Screen name="AppDrawer" component={AppDrawer} />
              </Stack.Navigator>
            </View>
          </TouchableWithoutFeedback>
        </NavigationContainer>
    </GestureHandlerRootView>
  );
}
