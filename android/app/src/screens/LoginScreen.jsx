import React, { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity, Alert } from 'react-native';
import { loginUser } from '../services/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Error', 'Ingrese email y contraseña');
    setLoading(true);

    try {
      await loginUser(email, password);
      // onAuthStateChanged en App.tsx se encargará de navegar
    } catch (e) {
      if (e.message === 'EMAIL_NOT_VERIFIED') {
        Alert.alert('Correo no verificado', 'Por favor verifica tu correo');
      } else {
        Alert.alert('Error', e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent:'center', padding:20 }}>
      <TextInput
        placeholder="Correo electrónico"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        style={inputStyle}
      />
      <TextInput
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={inputStyle}
      />

      <TouchableOpacity
        onPress={handleLogin}
        disabled={loading}
        style={btnPrimary}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const inputStyle = {
  borderWidth:1,
  borderColor:'#ddd',
  borderRadius:8,
  padding:12,
  marginBottom:12
};

const btnPrimary = {
  backgroundColor:'#007AFF',
  padding:12,
  borderRadius:8,
  alignItems:'center'
};
