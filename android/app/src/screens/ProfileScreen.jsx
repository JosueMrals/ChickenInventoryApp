import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function ProfileScreen({ navigation }) {
  const {
    user,
    role,
    emailVerified,
    loading,
    logout,
    resendVerificationEmail,
    refreshEmailVerification,
  } = useAuth();

  if (loading) {
    return (
      <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ flex:1, justifyContent:'center', alignItems:'center', padding:20 }}>
        <Text>No hay usuario autenticado</Text>
        <TouchableOpacity onPress={() => navigation.replace('Login')}>
          <Text style={{color:'#007AFF', marginTop:10}}>Volver al Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex:1, justifyContent:'center', alignItems:'center', padding:20 }}>
      <Text style={{ fontSize:22, fontWeight:'bold', marginBottom:10 }}>Perfil</Text>
      <Text>Email: {user.email}</Text>
      <Text>Rol: {role}</Text>
      <Text>Verificado: {emailVerified ? '✅ Sí' : '❌ No'}</Text>

      {!emailVerified && (
        <>
          <TouchableOpacity
            onPress={resendVerificationEmail}
            style={{ marginTop:20, backgroundColor:'#007AFF', padding:12, borderRadius:10 }}
          >
            <Text style={{ color:'#fff', fontWeight:'600' }}>Reenviar verificación</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={refreshEmailVerification}
            style={{ marginTop:10, backgroundColor:'#34C759', padding:12, borderRadius:10 }}
          >
            <Text style={{ color:'#fff', fontWeight:'600' }}>Actualizar estado</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity
        onPress={logout}
        style={{ marginTop:30, backgroundColor:'#FF3B30', padding:12, borderRadius:10 }}
      >
        <Text style={{ color:'#fff', fontWeight:'600' }}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}
