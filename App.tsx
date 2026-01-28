import React, { useEffect } from 'react';
import { View, TouchableWithoutFeedback, Alert } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import auth from '@react-native-firebase/auth';
import appCheck from '@react-native-firebase/app-check'; // Importar App Check

import LoginScreen from './android/app/src/screens/LoginScreen';
import ProductList from './android/app/src/screens/ProductList';
import ProductForm from './android/app/src/screens/ProductForm';
import Sidebar from './android/app/src/components/Sidebar';
import ProfileScreen from './android/app/src/screens/ProfileScreen';
import UserManagementScreen from './android/app/src/screens/users/UserManagementScreen';

import SalesScreen from './android/app/src/screens/sales/SalesScreen';
import CustomersScreen from './android/app/src/screens/customer/CustomerListScreen';
import ProductListScreen from './android/app/src/screens/products/ProductListScreen';
import DashboardScreen from './android/app/src/screens/dashboard/DashboardScreen';

import QuickSaleStack from './android/app/src/navigation/QuickSaleStack';
import PreSaleStack from './android/app/src/navigation/PreSaleStack';
import PreSaleProductsScreen from './android/app/src/screens/presales/PreSaleProductsScreen';
import PreSaleListScreen from './android/app/src/screens/presales/PreSaleListScreen';
import PreSaleDetailScreen from './android/app/src/screens/presales/PreSaleDetailScreen';
import PreSalePaymentScreen from './android/app/src/screens/presales/PreSalePaymentScreen';
import PreSaleDoneScreen from './android/app/src/screens/presales/PreSaleDoneScreen';

import PreparePreSalesScreen from './android/app/src/screens/presales/PreparePreSalesScreen';
import WarehousePreSaleDetailScreen from './android/app/src/screens/presales/WarehousePreSaleDetailScreen';
import MyDeliveriesScreen from './android/app/src/screens/presales/MyDeliveriesScreen';

import ReportsScreen from './android/app/src/screens/reports/ReportsScreen';
import ProductsStack from './android/app/src/navigation/ProductsStack';
import PrintersScreen from './android/app/src/screens/settings/printers/PrintersScreen';

import useSessionTimeout from "./android/app/src/hooks/useSessionTimeout";
import { SessionManager } from './android/app/src/utils/SessionManager';
import { PreSaleProvider } from './android/app/src/screens/presales/context/preSaleContext';

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
      <Drawer.Screen 
        name="Register"
        component={UserManagementScreen}
        initialParams={{ role, user }}
      />
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
      <Drawer.Screen
        name="PreSales"
        component={PreSaleStack}
        options={{
          drawerLabel: "Preventa",
          headerShown: false,
          swipeEnabled: false,
        }}
      />
      <Drawer.Screen
        name="PreSalesList"
        component={PreSaleListScreen}
        options={{
          drawerLabel: "Lista de Preventas",
        }}
      />
      <Drawer.Screen
		  name="PreSaleDetail"
          component={PreSaleDetailScreen}
		  options={{
			drawerLabel: "Lista de Preventas",
		  }}
		/>

	  <Drawer.Screen
	  	name="PreSalePayment"
	  	component={PreSalePaymentScreen}
	  />

	  <Drawer.Screen
	  	name="PreSaleDone"
	  	component={PreSaleDoneScreen}
	  />

	  <Drawer.Screen name="PreSaleProducts"
		  component={PreSaleProductsScreen}
	  />

	  <Drawer.Screen name="PreparePreSales"
		  component={PreparePreSalesScreen}
	  />

    <Drawer.Screen name="WarehousePreSaleDetail"
      component={WarehousePreSaleDetailScreen}
    />

    <Drawer.Screen name="MyDeliveries">
      {(props) => <MyDeliveriesScreen {...props} user={user} />}
    </Drawer.Screen>

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

  // Inicializar App Check con proveedor de depuración
  useEffect(() => {
    const initAppCheck = async () => {
      try {
        // En desarrollo usamos el proveedor de depuración.
        // En producción se usaría 'playIntegrity' en Android.
        const provider = appCheck().newReactNativeFirebaseAppCheckProvider();

        provider.configure({
          android: {
            provider: __DEV__ ? 'debug' : 'playIntegrity',
            debug: {
              token: 'DE892224-2C47-4189-93C0-D6F39F80D87E' // Token fijo opcional para desarrollo, o ver logs para uno nuevo
            }
          },
          ios: {
            provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
            debug: {
              token: 'DE892224-2C47-4189-93C0-D6F39F80D87E'
            }
          },
        });

        await appCheck().initializeAppCheck({
          provider: provider,
          isTokenAutoRefreshEnabled: true,
        });

        console.log('App Check initialized');
      } catch (error) {
        console.log('App Check init error:', error);
      }
    };

    initAppCheck();
  }, []);

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
      <PreSaleProvider>
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
      </PreSaleProvider>
    </GestureHandlerRootView>
  );
}
