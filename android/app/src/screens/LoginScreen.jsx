import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  StatusBar
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons'; // Asegúrate de tener esta librería instalada
import { loginUser, getUserRole, resendVerificationEmail, logUserData } from '../services/auth';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [unverifiedUser, setUnverifiedUser] = useState(null);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Animación de entrada
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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
        // No mostramos Alert intrusivo, la UI mostrará la tarjeta de advertencia
        return;
      }

      // Obtener rol (buscando por UID y Email para robustez)
      const role = await getUserRole(user.uid, user.email);
      console.log('✅ Rol obtenido:', role);

      // DEBUG: Log datos del usuario
      // await logUserData(user.email);

      setLoading(false);
      navigation.replace('AppDrawer', { role, user });

    } catch (error) {
      console.log('🔥 Error al iniciar sesión:', error);
      let msg = 'Error al iniciar sesión.';
      if (error.code === 'auth/invalid-email') msg = 'Correo electrónico inválido.';
      if (error.code === 'auth/user-not-found') msg = 'Usuario no encontrado.';
      if (error.code === 'auth/wrong-password') msg = 'Contraseña incorrecta.';

      Alert.alert('Error de Acceso', msg);
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedUser) return;

    try {
      setSendingVerification(true);
      await resendVerificationEmail();
      Alert.alert(
        'Correo enviado',
        `Se ha reenviado el enlace a ${unverifiedUser.email}. Revisa tu bandeja de entrada o spam.`
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setSendingVerification(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Animated.View style={[styles.innerContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* Header / Logo Placeholder */}
          <View style={styles.headerContainer}>
            <View style={styles.logoContainer}>
              <Icon name="cube" size={50} color="#007AFF" />
            </View>
            <Text style={styles.title}>Bienvenido</Text>
            <Text style={styles.subtitle}>Inicia sesión para gestionar el inventario</Text>
          </View>

          {/* Formulario */}
          <View style={styles.formContainer}>

            {/* Input Email */}
            <View style={styles.inputWrapper}>
              <Icon name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                placeholder="Correo electrónico"
                placeholderTextColor="#A0A0A0"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                style={styles.input}
              />
            </View>

            {/* Input Password */}
            <View style={styles.inputWrapper}>
              <Icon name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                placeholder="Contraseña"
                placeholderTextColor="#A0A0A0"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                style={styles.input}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                <Icon name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Botón Login */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>INGRESAR</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Tarjeta de Usuario No Verificado */}
          {unverifiedUser && (
            <View style={styles.warningCard}>
              <Icon name="alert-circle" size={24} color="#FF9500" />
              <Text style={styles.warningTitle}>Cuenta no verificada</Text>
              <Text style={styles.warningText}>
                Debes verificar tu correo electrónico para acceder al sistema.
              </Text>
              <TouchableOpacity
                onPress={handleResendVerification}
                disabled={sendingVerification}
                style={styles.resendButton}
              >
                {sendingVerification ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  <Text style={styles.resendButtonText}>Reenviar correo de verificación</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>ChickenInventory App v1.0</Text>
          </View>

        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  innerContainer: {
    width: '100%',
    alignItems: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 25,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 60,
    borderWidth: 1,
    borderColor: 'transparent', // Se puede cambiar a un gris muy suave si se desea borde
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    height: '100%',
  },
  eyeIcon: {
    padding: 8,
  },
  loginButton: {
    backgroundColor: '#007AFF',
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  loginButtonDisabled: {
    backgroundColor: '#A0C4FF',
  },
  loginButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  warningCard: {
    marginTop: 30,
    backgroundColor: '#FFF8E1',
    width: '100%',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF8F00',
    marginTop: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#5D4037',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  resendButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resendButtonText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 15,
  },
  footer: {
    marginTop: 40,
  },
  footerText: {
    color: '#B0B0B0',
    fontSize: 12,
  },
});
