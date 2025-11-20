import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { loginUser, getUserRole, resendVerificationEmail } from '../services/auth';
import auth from '@react-native-firebase/auth';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [unverifiedUser, setUnverifiedUser] = useState(null); // Guarda usuario no verificado
  const [sendingVerification, setSendingVerification] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Campos incompletos', 'Por favor ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);
    setUnverifiedUser(null);
    try {
      const user = await loginUser(email.trim(), password);
      if (!user.emailVerified) {
        setUnverifiedUser(user);
        setLoading(false);
        Alert.alert(
          'Correo no verificado',
          'Tu cuenta no está verificada. Por favor revisa tu correo o reenvía la verificación.'
        );
        return;
      }

      const role = await getUserRole(user.uid);
      console.log('✅ Rol obtenido:', role);
      setLoading(false);

      navigation.replace('AppDrawer', { role, user });
    } catch (error) {
      console.log('🔥 Error al iniciar sesión:', error);
 // Si el error tiene texto indicando que NO está verificado:
    if ((error.message && error.message.toLowerCase().includes('verificado')) ||
        (error.code && error.code === 'correo-no-verificado')) {
      // auth().currentUser estará presente porque signInWithEmailAndPassword ya se ejecutó dentro de loginUser
      const current = auth().currentUser;
      if (current) {
        setUnverifiedUser(current); // mostramos la UI para reenviar verificación
      }

      setLoading(false);
      Alert.alert(
        'Correo no verificado',
        'Tu cuenta no está verificada. Por favor revisa tu correo o reenvía la verificación.'
      );
      return; // detenemos aquí, dejamos la UI para reenviar/verificar
    }
      let msg = 'Error al iniciar sesión.';
      if (error.code === 'auth/invalid-email') msg = 'Correo electrónico inválido.';
      if (error.code === 'auth/user-not-found') msg = 'Usuario no encontrado.';
      if (error.code === 'auth/wrong-password') msg = 'Contraseña incorrecta.';
      if (error.message.includes('verificado')) msg = 'Correo no verificado.';

      Alert.alert('Error', msg);
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedUser) {
      Alert.alert('Error', 'No hay un usuario pendiente de verificación.');
      return;
    }

    try {
      setSendingVerification(true);
      await resendVerificationEmail();
      Alert.alert(
        'Correo enviado',
        `Se ha reenviado el correo de verificación a ${unverifiedUser.email}.`
      );
    } catch (error) {
      console.log('⚠️ Error reenviando verificación:', error);
      Alert.alert('Error', error.message);
    } finally {
      setSendingVerification(false);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#F5F6FA',
      }}
    >
      <Text
        style={{
          fontSize: 28,
          fontWeight: '800',
          textAlign: 'center',
          marginBottom: 30,
          color: '#007AFF',
        }}
      >
        Iniciar Sesión
      </Text>

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
        style={{
          backgroundColor: '#007AFF',
          padding: 14,
          borderRadius: 10,
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>
            Ingresar
          </Text>
        )}
      </TouchableOpacity>

      {unverifiedUser && (
        <TouchableOpacity
          onPress={handleResendVerification}
          disabled={sendingVerification}
          style={{
            backgroundColor: '#FF9500',
            padding: 12,
            borderRadius: 10,
            alignItems: 'center',
          }}
        >
          {sendingVerification ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '600' }}>
              Reenviar verificación
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: '#ccc',
  borderRadius: 10,
  padding: 12,
  marginBottom: 12,
  backgroundColor: '#fff',
  fontSize: 16,
};
