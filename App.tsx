import React, { useEffect } from 'react';
import { View, Alert } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import appCheck from '@react-native-firebase/app-check'; // Importar App Check

import LoginScreen from './android/app/src/screens/LoginScreen';
import Sidebar from './android/app/src/components/Sidebar';
import ProfileScreen from './android/app/src/screens/ProfileScreen';
import UserManagementScreen from './android/app/src/screens/users/UserManagementScreen';
import UsersStack from './android/app/src/screens/users/UsersStack';

import SalesScreen from './android/app/src/screens/sales/SalesScreen';
import CustomersScreen from './android/app/src/screens/customer/CustomerListScreen';
import CustomerFormModal from './android/app/src/screens/customer/CustomerFormModal';
import DashboardScreen from './android/app/src/screens/dashboard/DashboardScreen';
import ProductList from './android/app/src/screens/ProductList';
import CreditsScreen from './android/app/src/screens/credits/screens/CreditsScreen';
import CreditsHistoryScreen from './android/app/src/screens/credits/screens/CreditsHistoryScreen';
import CreditDetailScreen from './android/app/src/screens/credits/screens/CreditDetailScreen';

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
import DeliveryPaymentScreen from './android/app/src/screens/Warehouse/screens/DeliveryPaymentScreen';
import DeliveryDoneScreen from './android/app/src/screens/Warehouse/screens/DeliveryDoneScreen';
// ------------------------------------

import ReportsScreen from './android/app/src/screens/reports/ReportsScreen';
import ProductsStack from './android/app/src/navigation/ProductsStack';
import PrintersScreen from './android/app/src/screens/settings/printers/PrintersScreen';
import TicketCustomizationScreen from './android/app/src/screens/settings/ticketCustomization/TicketCustomizationScreen';
import SettingsScreen from './android/app/src/screens/settings/SettingsScreen'; // Nuevo Import
import RoutesScreen from './android/app/src/screens/routes/RoutesScreen';
import AddRouteScreen from './android/app/src/screens/routes/AddRouteScreen';
import RouteSelectionScreen from './android/app/src/screens/routes/RouteSelectionScreen';

import useSessionTimeout from "./android/app/src/hooks/useSessionTimeout";
import { SessionManager } from './android/app/src/utils/SessionManager';
import { PreSaleProvider } from './android/app/src/screens/presales/context/preSaleContext';
import { RouteProvider } from './android/app/src/context/RouteContext';
import {
  checkForUpdates,
  startUpdate,
  isNotSupportedError,
} from './android/app/src/screens/settings/updates';
import packageJson from './package.json';
import { setMonitoringUser } from './android/app/src/services/errorMonitoring';

export const navigationRef = createNavigationContainerRef();

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

const DashboardScreenAny = DashboardScreen as React.ComponentType<any>;
const ProductListAny = ProductList as React.ComponentType<any>;
const SalesScreenAny = SalesScreen as React.ComponentType<any>;
const ProfileScreenAny = ProfileScreen as React.ComponentType<any>;
const CustomersScreenAny = CustomersScreen as React.ComponentType<any>;
const CreditsScreenAny = CreditsScreen as React.ComponentType<any>;
const CreditsHistoryScreenAny = CreditsHistoryScreen as React.ComponentType<any>;
const MyDeliveriesScreenAny = MyDeliveriesScreen as React.ComponentType<any>;

function AppDrawer({ route }: any) {
  const { role, user } = route?.params || {};

  return (
    <Drawer.Navigator
      initialRouteName="DashboardScreen"
      drawerContent={(props) => <Sidebar {...props} role={role} user={user} />}
      screenOptions={{ headerShown: false }}
    >
      <Drawer.Screen name="DashboardScreen">
        {(props) => <DashboardScreenAny {...props} user={user} role={role} />}
      </Drawer.Screen>
      <Drawer.Screen name="ProductList">
        {(props) => <ProductListAny {...props} user={user} role={role} />}
      </Drawer.Screen>
      <Drawer.Screen name="Sales">
         {(props) => <SalesScreenAny {...props} user={user} role={role} />}
       </Drawer.Screen>
      <Drawer.Screen name="Profile">
        {(props) => <ProfileScreenAny {...props} user={user} role={role} />}
      </Drawer.Screen>
      <Drawer.Screen
        name="Register"
        component={UsersStack}
        initialParams={{ role, user }}
        options={{ headerShown: false, swipeEnabled: false }}
      />
      <Drawer.Screen name="Customer">
        {(props) => <CustomersScreenAny {...props} user={user} role={role} />}
      </Drawer.Screen>
      <Drawer.Screen name="Credits">
        {(props) => <CreditsScreenAny {...props} user={user} role={role} initialFilter="pending" />}
      </Drawer.Screen>
      <Drawer.Screen name="CreditsHistory">
        {(props) => <CreditsHistoryScreenAny {...props} user={user} role={role} />}
      </Drawer.Screen>
      <Drawer.Screen
        name="CreditDetail"
        component={CreditDetailScreen}
        options={{
          drawerItemStyle: { display: 'none' },
        }}
      />
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
        {(props) => <MyDeliveriesScreenAny {...props} user={user} role={role} />}
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

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((user) => {
      setMonitoringUser(user?.uid || null);
    });

    return unsubscribe;
  }, []);

  // Verificar actualizaciones al iniciar la app.
  // Usa el servicio unificado: Play Store (produccion) o App Distribution (testing).
  useEffect(() => {
    async function checkUpdates() {
      try {
        const result = await checkForUpdates({ localVersion: packageJson.version });

        if (result.hasUpdate) {
          const sourceLabel = result.source === 'play-store' ? 'Google Play' : 'App Distribution';
          Alert.alert(
            'Nueva Actualizacion Disponible',
            `Version ${result.remoteVersion} disponible via ${sourceLabel}.\nDeseas actualizar ahora?`,
            [
              {
                text: 'Mas tarde',
                style: 'cancel',
              },
              {
                text: 'Actualizar',
                onPress: async () => {
                  try {
                    await startUpdate(result);
                  } catch (err) {
                    Alert.alert('Error', 'No se pudo iniciar la actualizacion.');
                    console.log('Update error:', err);
                  }
                },
              },
            ],
            { cancelable: false }
          );
        }
      } catch (error) {
        if (isNotSupportedError(error)) {
          console.log('Update check skipped: Not supported in this environment.');
        } else {
          console.log('Update check error:', error);
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
          },
          apple: {
            provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
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
    <SafeAreaProvider>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RouteProvider>
        <PreSaleProvider>
          <NavigationContainer ref={navigationRef}>
              <View
                style={{ flex: 1 }}
                onStartShouldSetResponderCapture={() => {
                  SessionManager.updateActivity();
                  return false;
                }}
              >
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="RouteSelection" component={RouteSelectionScreen} />
                    <Stack.Screen name="AppDrawer" component={AppDrawer} />
                    <Stack.Screen name="CustomerForm" component={CustomerFormModal} />
                    {/* Pantallas globales accesibles desde Settings */}
                    <Stack.Screen name="PrintersScreen" component={PrintersScreen} />
                    <Stack.Screen name="TicketCustomizationScreen" component={TicketCustomizationScreen} />

                    {/* Warehouse Delivery Flow */}
                    <Stack.Screen name="DeliveryPayment" component={DeliveryPaymentScreen} />
                    <Stack.Screen name="DeliveryDone" component={DeliveryDoneScreen} />
                </Stack.Navigator>
              </View>
          </NavigationContainer>
        </PreSaleProvider>
      </RouteProvider>
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
