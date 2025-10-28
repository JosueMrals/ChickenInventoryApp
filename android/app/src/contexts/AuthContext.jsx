import React, { createContext, useEffect, useState, useContext } from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {
  loginUser as loginFirebase,
  logoutUser as logoutFirebase,
  registerUser as registerFirebase,
  resendVerificationEmail as resendEmailFirebase,
  refreshEmailVerificationStatus as refreshEmailStatus,
  getUserRole as getUserRoleFirebase,
} from '../services/auth';

// 🔹 Crear contexto
const AuthContext = createContext({});

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
        const doc = await firestore().collection('users').doc(currentUser.uid).get();
        if (doc.exists) setRole(doc.data().role);
      } else {
        setRole(null);
        setEmailVerified(false);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // 🔹 Funciones
  const login = async (email, password) => {
    const u = await loginFirebase(email, password);
    setUser(u);
    setEmailVerified(u.emailVerified);
    const r = await getUserRoleFirebase(u.uid);
    setRole(r);
    return u;
  };

  const register = async (email, password, userRole = 'user') => {
    const u = await registerFirebase(email, password, userRole);
    setUser(u);
    setEmailVerified(u.emailVerified);
    setRole(userRole);
    return u;
  };

  const logout = async () => {
    await logoutFirebase();
    setUser(null);
    setRole(null);
    setEmailVerified(false);
  };

  const resendVerificationEmail = async () => {
    await resendEmailFirebase();
  };

  const refreshEmailVerification = async () => {
    await refreshEmailStatus();
    const currentUser = auth().currentUser;
    setEmailVerified(currentUser?.emailVerified || false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        emailVerified,
        loading,
        login,
        register,
        logout,
        resendVerificationEmail,
        refreshEmailVerification,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// 🔹 Hook para usar el contexto
export const useAuth = () => useContext(AuthContext);
