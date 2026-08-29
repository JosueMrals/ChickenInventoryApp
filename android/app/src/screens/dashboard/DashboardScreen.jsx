import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDashboardStats } from './hooks/useDashboardStats';
import ClassicDashboard from './variants/ClassicDashboard';
import ModernDashboard from './variants/ModernDashboard';
import styles from './styles/dashboardStyles';

// Clave de preferencia del diseño del tablero. Se persiste para que el usuario
// no tenga que volver a elegir en cada sesión; por defecto abre en 'modern'.
const DASHBOARD_VARIANT_KEY = '@dashboard_variant';

export default function DashboardScreen({ user, role, navigation }) {
  const { stats, loading, refreshing, refresh } = useDashboardStats(role, user);
  const [userProfile, setUserProfile] = useState(null);

  // Preferencia de variante ('modern' | 'classic'). null = aún cargando de disco,
  // para no parpadear el diseño equivocado antes de leer AsyncStorage.
  const [variant, setVariant] = useState(null);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(DASHBOARD_VARIANT_KEY)
      .then((saved) => {
        if (mounted) setVariant(saved === 'classic' ? 'classic' : 'modern');
      })
      .catch(() => {
        if (mounted) setVariant('modern');
      });
    return () => { mounted = false; };
  }, []);

  const toggleVariant = useCallback(() => {
    setVariant((prev) => {
      const next = prev === 'modern' ? 'classic' : 'modern';
      AsyncStorage.setItem(DASHBOARD_VARIANT_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  // Las tarjetas se calculan con agregados de servidor (count/sum), que son
  // consultas puntuales y no suscripciones: sin un disparador explícito los
  // números se quedarían congelados desde que se montó la pantalla.
  //
  // Al volver el foco: se entra al tablero justo después de cobrar o despachar,
  // que es cuando los números cambiaron. El pull-to-refresh de las variantes
  // permite forzarlo sin salir y entrar.
  //
  // Se salta el primer foco: el hook ya calcula al montarse, y refrescar ahí
  // dispararía la segunda tanda de agregados sin que nada haya cambiado.
  const skipFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (skipFirstFocus.current) {
        skipFirstFocus.current = false;
        return;
      }
      refresh();
    }, [refresh])
  );

  // El saludo se arma con el doc de `users`, no con el displayName de Auth (que
  // no está seteado en todas las cuentas y hacía caer el nombre al inicio del correo).
  useEffect(() => {
    if (!user?.uid) return undefined;
    const unsubscribe = firestore()
      .collection('users')
      .doc(user.uid)
      .onSnapshot(
        (snap) => setUserProfile(snap?.exists() ? snap.data() : null),
        (error) => {
          console.error('[Dashboard] perfil de usuario:', error);
          setUserProfile(null);
        }
      );
    return () => unsubscribe();
  }, [user?.uid]);

  const firstName = (userProfile?.nombre || user?.nombre || user?.name || user?.displayName || user?.email?.split('@')?.[0] || 'Usuario').trim();
  const lastName = (userProfile?.apellido || user?.apellido || '').trim();
  const displayName = `${firstName}${lastName ? ` ${lastName}` : ''}`;

  if (loading || variant === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando panel...</Text>
      </View>
    );
  }

  const Variant = variant === 'classic' ? ClassicDashboard : ModernDashboard;

  return (
    <Variant
      user={user}
      role={role}
      navigation={navigation}
      stats={stats}
      refreshing={refreshing}
      refresh={refresh}
      displayName={displayName}
      onToggleVariant={toggleVariant}
    />
  );
}
