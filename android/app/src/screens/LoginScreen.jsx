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
import Icon from 'react-native-vector-icons/Ionicons';
import { loginUser, getUserRole, resendVerificationEmail } from '../services/auth';
import { getSavedAccounts, saveAccount, removeAccount } from '../services/accountManager';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [unverifiedUser, setUnverifiedUser] = useState(null);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Estados para gestión de cuentas guardadas
  const [savedAccounts, setSavedAccounts] = useState([]);
  const [showAccountList, setShowAccountList] = useState(false);
  const [loggingInAccount, setLoggingInAccount] = useState(null); // UID de la cuenta intentando entrar

  // Animación de entrada
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadSavedAccounts();

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

  const loadSavedAccounts = async () => {
    const accounts = await getSavedAccounts();
    if (accounts && accounts.length > 0) {
      setSavedAccounts(accounts);
      setShowAccountList(true);
    }
  };

  const processLogin = async (emailInput, passwordInput, isQuickLogin = false) => {
    if (!emailInput || !passwordInput) {
      Alert.alert('Campos incompletos', 'Por favor ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);
    setUnverifiedUser(null);
    try {
      // 1. Autenticación con Backend (Firebase)
      const user = await loginUser(emailInput.trim(), passwordInput);

      if (!user.emailVerified) {
        setUnverifiedUser(user);
        setLoading(false);
        setLoggingInAccount(null);
        if (isQuickLogin) setShowAccountList(false); // Volver al form para mostrar advertencia
        return;
      }

      // 2. Obtener rol
      const role = await getUserRole(user.uid, user.email);
      console.log('✅ Rol obtenido:', role);

      // 3. Guardar credenciales localmente para futuro acceso rápido
      await saveAccount(user, passwordInput, role);

      setLoading(false);
      setLoggingInAccount(null);

      // REDIRECCIÓN SEGÚN ROL (RUTA O DASHBOARD)
      const rolesWithRoute = ['user', 'entregador', 'bodeguero', 'vendedor'];
      if (rolesWithRoute.includes(role)) {
        navigation.replace('RouteSelection', { role, user });
      } else {
        navigation.replace('AppDrawer', { role, user });
      }

    } catch (error) {
      console.log('🔥 Error al iniciar sesión:', error);
      let msg = 'Error al iniciar sesión.';
      if (error.code === 'auth/invalid-email') msg = 'Correo electrónico inválido.';
      if (error.code === 'auth/user-not-found') msg = 'Usuario no encontrado.';
      if (error.code === 'auth/wrong-password') msg = 'Contraseña incorrecta.'; // Posible si cambió pass en otro lado

      Alert.alert('Error de Acceso', msg);
      setLoading(false);
      setLoggingInAccount(null);
    }
  };

  const handleLogin = () => {
    processLogin(email, password, false);
  };

  const handleQuickLogin = (account) => {
    setLoggingInAccount(account.uid);
    processLogin(account.email, account.password, true);
  };

  const handleDeleteAccount = async (uid) => {
    Alert.alert(
      'Eliminar cuenta',
      '¿Estás seguro de que quieres eliminar esta cuenta de la lista de acceso rápido?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const updated = await removeAccount(uid);
            setSavedAccounts(updated);
            if (updated.length === 0) {
              setShowAccountList(false);
            }
          }
        }
      ]
    );
  };

  const handleResendVerification = async () => {
    if (!unverifiedUser) return;
    try {
      setSendingVerification(true);
      await resendVerificationEmail();
      Alert.alert('Correo enviado', `Se ha reenviado el enlace a ${unverifiedUser.email}.`);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setSendingVerification(false);
    }
  };

  // Helper para mostrar el nombre del rol correctamente
  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'vendedor': return 'Vendedor';
      case 'entregador': return 'Entregador';
      case 'bodeguero': return 'Bodeguero';
      case 'user': return 'Usuario';
      default: return role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Usuario';
    }
  };

  // Render del Item de Cuenta Guardada
  const renderAccountItem = (account) => {
    const isLoggingIn = loggingInAccount === account.uid;

    return (
      <TouchableOpacity
        key={account.uid}
        style={styles.accountCard}
        onPress={() => handleQuickLogin(account)}
        disabled={loading}
      >
        <View style={styles.accountAvatar}>
          <Text style={styles.accountInitial}>
            {account.displayName ? account.displayName.charAt(0).toUpperCase() : account.email.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.accountInfo}>
          <Text style={styles.accountName} numberOfLines={1}>
            {account.displayName || account.email.split('@')[0]}
          </Text>
          <Text style={styles.accountEmail} numberOfLines={1}>{account.email}</Text>
          <Text style={styles.accountRole}>{getRoleDisplayName(account.role)}</Text>
        </View>

        {isLoggingIn ? (
          <ActivityIndicator color="#007AFF" />
        ) : (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteAccount(account.uid)}
          >
            <Icon name="trash-outline" size={20} color="#FF3B30" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Animated.View style={[styles.innerContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* Header */}
          <View style={styles.headerContainer}>
            <View style={styles.logoContainer}>
              <Icon name="cube" size={50} color="#007AFF" />
            </View>
            <Text style={styles.title}>
              {showAccountList ? 'Selecciona una cuenta' : 'Bienvenido'}
            </Text>
            <Text style={styles.subtitle}>
              {showAccountList ? 'Toca para iniciar sesión rápidamente' : 'Inicia sesión para gestionar el inventario'}
            </Text>
          </View>

          {/* VISTA: LISTA DE CUENTAS */}
          {showAccountList ? (
            <View style={styles.accountListContainer}>
              {savedAccounts.map(renderAccountItem)}

              <TouchableOpacity
                style={styles.useAnotherAccountButton}
                onPress={() => setShowAccountList(false)}
              >
                <Icon name="add-circle-outline" size={24} color="#007AFF" style={{ marginRight: 8 }} />
                <Text style={styles.useAnotherAccountText}>Usar otra cuenta</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* VISTA: FORMULARIO DE LOGIN */
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

              {/* Botón Volver a Cuentas Guardadas (si existen) */}
              {savedAccounts.length > 0 && (
                <TouchableOpacity
                  style={styles.backToAccountsButton}
                  onPress={() => setShowAccountList(true)}
                >
                  <Text style={styles.backToAccountsText}>Volver a mis cuentas</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

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
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
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
    borderColor: 'transparent',
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
  // Estilos Nuevos para Lista de Cuentas
  accountListContainer: {
    width: '100%',
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  accountAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E1F0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  accountInitial: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  accountEmail: {
    fontSize: 14,
    color: '#888',
    marginBottom: 2,
  },
  accountRole: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  deleteButton: {
    padding: 8,
  },
  useAnotherAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingVertical: 12,
  },
  useAnotherAccountText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  backToAccountsButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  backToAccountsText: {
    color: '#666',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
