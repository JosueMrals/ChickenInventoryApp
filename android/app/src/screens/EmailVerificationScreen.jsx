import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { resendVerificationEmail, refreshEmailVerificationStatus } from '../services/auth';
import auth from '@react-native-firebase/auth';

export default function EmailVerificationScreen() {
  const [loading, setLoading] = useState(false);

  const handleResend = async () => {
    setLoading(true);
    try {
      await resendVerificationEmail();
      Alert.alert('Correo enviado', 'Revisa tu bandeja de entrada');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckVerified = async () => {
    await refreshEmailVerificationStatus();
    await auth().currentUser.reload();
    if (auth().currentUser.emailVerified) {
      Alert.alert('¡Verificado!', 'Tu correo fue validado. Reinicia sesión.');
      await auth().signOut();
    } else {
      Alert.alert('Aún no verificado', 'Revisa tu correo o vuelve a intentar.');
    }
  };

  return (
    <View style={{ flex:1, justifyContent:'center', padding:20 }}>
      <Text style={{ fontSize:20, textAlign:'center', marginBottom:20 }}>
        Por favor verifica tu correo antes de continuar
      </Text>

      <TouchableOpacity
        onPress={handleResend}
        disabled={loading}
        style={btnPrimary}
      >
        <Text style={{color:'#fff', fontWeight:'600'}}>
          {loading ? 'Enviando...' : 'Reenviar verificación'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleCheckVerified}
        style={{...btnPrimary, backgroundColor:'#34C759', marginTop:12}}
      >
        <Text style={{color:'#fff', fontWeight:'600'}}>
          Ya verifiqué mi correo
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => auth().signOut()}
        style={{marginTop:20, alignItems:'center'}}
      >
        <Text style={{color:'#FF3B30'}}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const btnPrimary = {
  backgroundColor:'#007AFF',
  padding:12,
  borderRadius:8,
  alignItems:'center'
};
