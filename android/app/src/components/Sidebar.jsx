import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import auth from '@react-native-firebase/auth';
import { DrawerContentScrollView } from '@react-navigation/drawer';

export default function Sidebar({ navigation, role, user }) {
  const handleLogout = async () => {
    await auth().signOut();
    navigation.replace('Login');
  };

  return (
    <DrawerContentScrollView contentContainerStyle={{ flex: 1, justifyContent: 'space-between' }}>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 20 }}>Menú</Text>

        <TouchableOpacity onPress={() => navigation.navigate('DashboardScreen')}>
          <Text style={{ fontSize: 16, marginBottom: 10 }}>🏠 Inicio</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('ProductList')}>
          <Text style={{ fontSize: 16, marginBottom: 10 }}>📦 Productos</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Profile', { user, role })}>
          <Text style={{fontSize: 16, marginBottom: 10}}>👤 Perfil</Text>
        </TouchableOpacity>

        {role === 'admin' && (
          <>
            <View style={{ height: 1, backgroundColor: '#ddd', marginVertical: 10 }} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#007AFF' }}>ADMIN</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={{ fontSize: 16, marginTop: 8 }}>⚙️ Panel de control</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={{ padding: 20 }}>
        <Text style={{ color: '#888', fontSize: 14 }}>{user.email}</Text>
        <TouchableOpacity onPress={handleLogout} style={{ marginTop: 10 }}>
          <Text style={{ color: '#FF3B30', fontWeight: '600' }}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
}
