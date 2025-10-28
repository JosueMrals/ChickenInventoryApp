import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { onAuthStateChanged, getUserRole } from './android/app/src/services/auth';

import LoginScreen from './android/app/src/screens/LoginScreen';
import EmailVerificationScreen from './android/app/src/screens/EmailVerificationScreen';
import ProductList from './android/app/src/screens/ProductList';

const Stack = createNativeStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const userRole = await getUserRole(firebaseUser.uid);
        setUser(firebaseUser);
        setRole(userRole);
        setEmailVerified(firebaseUser.emailVerified);
      } else {
        setUser(null);
        setRole(null);
        setEmailVerified(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={{flex:1,justifyContent:'center',alignItems:'center'}}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        {!user ? (
          // Login
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : !emailVerified ? (
          // Verificación de correo
          <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
        ) : (
          // Home / ProductList
          <Stack.Screen name="Home">
            {() => <ProductList role={role} />}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
