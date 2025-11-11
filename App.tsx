import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import LoginScreen from './android/app/src/screens/LoginScreen';
import Dashboard from './android/app/src/screens/Dashboard';
import ProductList from './android/app/src/screens/ProductList';
import ProductForm from './android/app/src/screens/ProductForm';
import Sidebar from './android/app/src/components/Sidebar';
import ProfileScreen from './android/app/src/screens/ProfileScreen';
import RegisterScreen from './android/app/src/screens/RegisterScreen';
import SalesScreen from './android/app/src/screens/sales/SalesScreen';
import CreditsScreen from './android/app/src/screens/CreditsScreen';
import CustomersScreen from './android/app/src/screens/CustomersScreen';


const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

function AppDrawer({ route }) {
  const { role, user } = route.params;

  return (
    <Drawer.Navigator
      initialRouteName="Dashboard"
      drawerContent={(props) => <Sidebar {...props} role={role} user={user} />}
      screenOptions={{ headerShown: false }}
    >
      <Drawer.Screen name="Dashboard">
        {(props) => <Dashboard {...props} user={user} role={role} />}
      </Drawer.Screen>
      <Drawer.Screen name="ProductList">
        {(props) => <ProductList {...props} user={user} role={role} />}
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
      <Drawer.Screen name="Sales"
        component={SalesScreen}
        options={{ title: 'Ventas', drawerIcon: ({ color, size }) => (
          <Ionicons name="cash-outline" size={size} color={color} />
        )}}
      />
      <Drawer.Screen name="Credits"
        component={CreditsScreen}
        options={{ title: 'Créditos', drawerIcon: ({ color, size }) => (
          <Ionicons name="cash-outline" size={size} color={color} />
        )}}
      />
    </Drawer.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="AppDrawer" component={AppDrawer} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
