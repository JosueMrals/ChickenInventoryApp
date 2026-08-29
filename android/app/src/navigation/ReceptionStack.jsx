import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ReceptionListScreen from '../screens/reception/screens/ReceptionListScreen';
import ReceptionCreateScreen from '../screens/reception/screens/ReceptionCreateScreen';
import ReceptionDetailScreen from '../screens/reception/screens/ReceptionDetailScreen';

const Stack = createNativeStackNavigator();

// Stack del módulo Recepción de Mercancía. Recibe user/role por params (igual
// que ProductsStack) y los reinyecta a cada pantalla vía initialParams.
export default function ReceptionStack({ route }) {
  const { user, role } = route?.params ?? {};

  return (
    <Stack.Navigator
      initialRouteName="ReceptionList"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="ReceptionList" component={ReceptionListScreen} initialParams={{ user, role }} />
      <Stack.Screen name="ReceptionCreate" component={ReceptionCreateScreen} initialParams={{ user, role }} />
      <Stack.Screen name="ReceptionDetail" component={ReceptionDetailScreen} initialParams={{ user, role }} />
    </Stack.Navigator>
  );
}
