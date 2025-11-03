import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function Dashboard({ user, role }) {
  const navigation = useNavigation();

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F6FA' }}>
      <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 10 }}>
        Bienvenido, {user.email.split('@')[0]}
      </Text>
      <Text style={{ fontSize: 16, color: '#555', marginBottom: 30 }}>
        Rol: {role.toUpperCase()}
      </Text>

      <TouchableOpacity
        onPress={() => navigation.navigate('ProductList')}
        style={{
          backgroundColor: '#007AFF',
          paddingVertical: 12,
          paddingHorizontal: 20,
          borderRadius: 10,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>Ir a Inventario</Text>
      </TouchableOpacity>
    </View>
  );
}
