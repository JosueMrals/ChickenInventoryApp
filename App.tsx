import React, { useEffect } from 'react';
import { View, TouchableWithoutFeedback, Alert } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import auth from '@react-native-firebase/auth';
import appCheck from '@react-native-firebase/app-check'; // Importar App Check
import appDistribution from '@react-native-firebase/app-distribution';

import LoginScreen from './android/app/src/screens/LoginScreen';
import Sidebar from './android/app/src/components/Sidebar';
import ProfileScreen from './android/app/src/screens/ProfileScreen';
import UserManagementScreen from './android/app/src/screens/users/UserManagementScreen';

import SalesScreen from './android/app/src/screens/sales/SalesScreen';
import CustomersScreen from './android/app/src/screens/customer/CustomerListScreen';
import DashboardScreen from './android/app/src/screens/dashboard/DashboardScreen';

import QuickSaleStack from './android/app/src/navigation/QuickSaleStack';
import PreSaleStack from './android/app/src/navigation/PreSaleStack';
import PreSaleProductsScreen from './android/app/src/screens/presales/PreSaleProductsScreen';
import PreSaleListScreen from './android/app/src/screens/presales/PreSaleListScreen';
import PreSaleDetailScreen from './android/app/src/screens/presales/PreSaleDetailScreen';
import PreSalePaymentScreen from './android/app/src/screens/presales/PreSalePaymentScreen';
import PreSaleDoneScreen from './android/app/src/screens/presales/PreSaleDoneScreen';

// --- WAREHOUSE IMPORTS (MIGRATED) ---
import WarehouseDashboardScreen from './android/app/src/screens/Warehouse/screens/WarehouseDashboardScreen';
import WarehouseOrderDetailScreen from './android/app/src/screens/Warehouse/screens/WarehouseOrderDetailScreen';
import ProductHandoverScreen from './android/app/src/screens/Warehouse/screens/ProductHandoverScreen';
import MyDeliveriesScreen from './android/app/src/screens/Warehouse/screens/MyDeliveriesScreen';
// ------------------------------------

import ReportsScreen from './android/app/src/screens/reports/ReportsScreen';
import ProductsStack from './android/app/src/navigation/ProductsStack';
import PrintersScreen from './android/app/src/screens/settings/printers/PrintersScreen';
import SettingsScreen from './android/app/src/screens/settings/SettingsScreen'; // Nuevo Import
import RoutesScreen from './android/app/src/screens/routes/RoutesScreen';
import AddRouteScreen from './android/app/src/screens/routes/AddRouteScreen';
import RouteSelectionScreen from './android/app/src/screens/routes/RouteSelectionScreen';

import useSessionTimeout from "./android/app/src/hooks/useSessionTimeout";
import { SessionManager } from './android/app/src/utils/SessionManager';
import { PreSaleProvider } from './android/app/src/screens/presales/context/preSaleContext';
import { RouteProvider } from './android/app/src/context/RouteContext';

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

	  {/* WAREHOUSE ROUTES */}
	  <Drawer.Screen name="PreparePreSales"
		  component={WarehouseDashboardScreen}
          options={{ title: "Bodega - Control" }}
	  />

      <Drawer.Screen name="WarehouseOrderDetail"
        component={WarehouseOrderDetailScreen}
        options={{ title: "Detalle de Orden Bodega" }}
      />
      {/* Kept alias for backward compatibility if needed, though WarehouseOrderDetail is preferred */}
      <Drawer.Screen name="WarehousePreSaleDetail"
        component={WarehouseOrderDetailScreen}
      />

      <Drawer.Screen name="ProductHandover"
        component={ProductHandoverScreen}
        options={{ title: "Entregar Carga" }}
      />

      <Drawer.Screen name="MyDeliveries">
        {(props) => <MyDeliveriesScreen {...props} user={user} />}
      </Drawer.Screen>
      {/* ---------------- */}

      {/* SETTINGS MODULE UPDATED */}
      <Drawer.Screen name="Settings"
        component={SettingsScreen}
        options={{
            drawerLabel: "Configuración",
            headerShown: false,
            swipeEnabled: false,
        }}
      />

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

      {/* ROUTES MODULE */}
      <Drawer.Screen name="Routes"
        component={RoutesScreen}
        options={{ title: "Rutas de Entrega" }}
      />
      <Drawer.Screen name="AddRouteScreen"
        component={AddRouteScreen}
        options={{ title: "Nueva Ruta" }}
      />

    </Drawer.Navigator>
  );
}

export default function App() {

  // Verificar actualizaciones de App Distribution al iniciar (o al hacer login)
  // Como `App` se monta una vez, este useEffect corre al arrancar la app.
  useEffect(() => {
    async function checkUpdates() {
      // Intentar verificar actualización, ignorando errores de entorno dev
      try {
        const release = await appDistribution().checkForUpdate();
        if (release && release.downloadUrl) {
          Alert.alert(
            'Nueva Actualización Disponible',
            `Versión ${release.displayVersion} (${release.versionCode}).\n¿Deseas descargarla e instalarla ahora?`,
            [
              {
                text: 'Más tarde',
                style: 'cancel',
              },
              {
                text: 'Actualizar',
                onPress: async () => {
                  try {
                    await release.download();
                  } catch (err) {
                    Alert.alert('Error', 'No se pudo iniciar la descarga.');
                    console.log('Download error:', err);
                  }
                },
              },
            ],
            { cancelable: false }
          );
        }
      } catch (error) {
        // Silenciar error si es entorno no soportado (dev/simulador) para no molestar
        if (error.message && error.message.includes("not supported")) {
             console.log("App Distribution check skipped: Not supported in this environment.");
        } else {
             console.log('App Distribution check error:', error);
        }
      }
    }

    checkUpdates();
  }, []);

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
      <RouteProvider>
        <PreSaleProvider>
          <NavigationContainer ref={navigationRef}>
            <TouchableWithoutFeedback onPress={() => SessionManager.updateActivity()}>
              <View style={{ flex: 1 }}>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="RouteSelection" component={RouteSelectionScreen} />
                    <Stack.Screen name="AppDrawer" component={AppDrawer} />
                    {/* Pantallas globales accesibles desde Settings */}
                    <Stack.Screen name="PrintersScreen" component={PrintersScreen} />
                </Stack.Navigator>
              </View>
            </TouchableWithoutFeedback>
          </NavigationContainer>
        </PreSaleProvider>
      </RouteProvider>
    </GestureHandlerRootView>
  );
}
