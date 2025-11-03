import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { loginUser, getUserRole } from '../services/auth';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Campos incompletos', 'Por favor ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);
    try {
      const user = await loginUser(email, password);
      const role = await getUserRole(user.uid);

      console.log('✅ Rol obtenido:', role);
      setLoading(false);
      navigation.replace('AppDrawer', { role, user });
    } catch (error) {
      console.log('🔥 Error al iniciar sesión:', error);
      let msg = 'Error al iniciar sesión.';
      if (error.code === 'auth/wrong-password') msg = 'Contraseña incorrecta.';
      if (error.code === 'auth/user-not-found') msg = 'Usuario no encontrado.';
      if (error.message.includes('verificado')) msg = 'Correo no verificado.';
      Alert.alert('Error', msg);
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: 30 }}>
        Iniciar Sesión
      </Text>

      <TextInput
        placeholder="Correo electrónico"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          borderRadius: 10,
          padding: 12,
          marginBottom: 10,
        }}
      />

      <TextInput
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          borderRadius: 10,
          padding: 12,
          marginBottom: 20,
        }}
      />

      <TouchableOpacity
        onPress={handleLogin}
        disabled={loading}
        style={{
          backgroundColor: '#007AFF',
          padding: 14,
          borderRadius: 10,
          alignItems: 'center',
        }}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>Ingresar</Text>}
      </TouchableOpacity>
    </View>
  );
}
