import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import UserManagementScreen from './UserManagementScreen';
import EditUserScreen from './screens/EditUserScreen';
import UserDetailScreen from './screens/UserDetailScreen';

const Stack = createNativeStackNavigator();

export default function UsersStack({ route }) {
  const { role, user } = route?.params ?? {};

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="UserManagement"
        component={UserManagementScreen}
        initialParams={{ role, user }}
      />
      <Stack.Screen
        name="UserDetail"
        component={UserDetailScreen}
        options={{ gestureEnabled: true }}
      />
      <Stack.Screen
        name="EditUser"
        component={EditUserScreen}
        options={{ gestureEnabled: true }}
      />
    </Stack.Navigator>
  );
}

