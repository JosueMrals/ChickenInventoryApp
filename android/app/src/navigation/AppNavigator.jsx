import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, TouchableOpacity } from 'react-native';
import { onAuthStateChanged, getUserRole, logoutUser } from '../services/auth';
import LoginScreen from '../screens/LoginScreen';
import ProductList from '../screens/ProductList';
import ProfileScreen from '../screens/ProfileScreen';

export default function AppNavigator() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async (usr) => {
      if (usr && usr.emailVerified) {
        const r = await getUserRole(usr.uid);
        setUser(usr);
        setRole(r);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return <View style={{flex:1,justifyContent:'center',alignItems:'center'}}><ActivityIndicator size="large" /></View>;
  }

  if (!user) return <LoginScreen />;

  if (showProfile) return <ProfileScreen onBack={() => setShowProfile(false)} />;

  return (
    <View style={{ flex: 1 }}>
      <ProductList role={role} />
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
        borderTopWidth: 1,
        borderColor: '#eee',
        backgroundColor: '#fafafa'
      }}>
        <TouchableOpacity onPress={() => setShowProfile(true)}>
          <Text style={{ color: '#0066FF', fontWeight: '600' }}>Perfil</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={logoutUser}>
          <Text style={{ color: '#FF3B30', fontWeight: '600' }}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
