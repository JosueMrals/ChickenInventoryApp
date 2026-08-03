import React, { createContext, useEffect, useState, useContext, useCallback, useMemo } from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {
  loginUser as loginFirebase,
  logoutUser as logoutFirebase,
  registerUser as registerFirebase,
  resendVerificationEmail as resendEmailFirebase,
  refreshEmailVerificationStatus as refreshEmailStatus,
} from '../services/auth';

// 🔹 Crear contexto
const AuthContext = createContext({});

/**
 * Obtiene el rol del custom claim del token en vez de leer users/{uid}.
 * getIdTokenResult() sirve del token ya cacheado: no toca red ni Firestore.
 *
 * Los dos fallbacks son transitorios (ver syncAllRoleClaims en functions/index.js):
 * refrescar el token cubre a quien inició sesión antes de la migración, y la
 * lectura del documento cubre a quien todavía no tiene el claim puesto.
 */
const resolveRole = async (currentUser) => {
  let { claims } = await currentUser.getIdTokenResult();
  if (claims.role) return claims.role;

  ({ claims } = await currentUser.getIdTokenResult(true));
  if (claims.role) return claims.role;

  const doc = await firestore().collection('users').doc(currentUser.uid).get();
  return doc.exists() ? doc.data().role : null;
};

// 🔹 Provider
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);         // Firebase user
  const [role, setRole] = useState(null);         // admin / user
  const [loading, setLoading] = useState(true);   // Carga inicial
  const [emailVerified, setEmailVerified] = useState(false);

  // Escucha cambios en la autenticación
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        setEmailVerified(currentUser.emailVerified);
        setRole(await resolveRole(currentUser));
      } else {
        setRole(null);
        setEmailVerified(false);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // 🔹 Funciones
  // Todas memoizadas: el value del Provider es un objeto y este contexto está en la
  // raíz del app, así que cualquier identidad nueva re-renderiza a TODOS los consumidores.
  const login = useCallback(async (email, password) => {
    const u = await loginFirebase(email, password);
    setUser(u);
    setEmailVerified(u.emailVerified);
    setRole(await resolveRole(u));
    return u;
  }, []);

  const register = useCallback(async (email, password, userRole = 'user') => {
    const u = await registerFirebase(email, password, userRole);
    setUser(u);
    setEmailVerified(u.emailVerified);
    setRole(userRole);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await logoutFirebase();
    setUser(null);
    setRole(null);
    setEmailVerified(false);
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    await resendEmailFirebase();
  }, []);

  const refreshEmailVerification = useCallback(async () => {
    await refreshEmailStatus();
    const currentUser = auth().currentUser;
    setEmailVerified(currentUser?.emailVerified || false);
  }, []);

  const value = useMemo(
    () => ({
      user,
      role,
      emailVerified,
      loading,
      login,
      register,
      logout,
      resendVerificationEmail,
      refreshEmailVerification,
    }),
    [user, role, emailVerified, loading, login, register, logout, resendVerificationEmail, refreshEmailVerification],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// 🔹 Hook para usar el contexto
export const useAuth = () => useContext(AuthContext);
