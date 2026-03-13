import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Animated,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import { firestore } from '../../services/firebaseConfig';

const KPI_ITEMS = [
  { key: 'salesToday', title: 'Ventas de Hoy', color: '#2ECC71' },
  { key: 'activeDeliveries', title: 'Entregas Activas', color: '#2D9CDB' },
  { key: 'pendingCredits', title: 'Creditos Pendientes', color: '#EB5757' },
];

const PRIMARY_MODULES = [
  { key: 'preSale', label: 'Pre-Venta', screen: 'PreSales', color: '#2563EB', icon: 'cart' },
  { key: 'inventory', label: 'Inventario', screen: 'ProductsStack', color: '#16A085', icon: 'cube' },
];

const MODULES = [
  { key: 'clientes', label: 'Clientes', icon: 'person-circle', color: '#F2994A', screen: 'Customer' },
  { key: 'creditos', label: 'Creditos', icon: 'card', color: '#EB5757', screen: 'Credits' },
  { key: 'rutas', label: 'Rutas', icon: 'map', color: '#2D9CDB', screen: 'Routes' },
  { key: 'preparar', label: 'Preparar Pre-Ventas', icon: 'cube-outline', color: '#F2994A', screen: 'PreparePreSales' },
  { key: 'entregas', label: 'Mis Entregas', icon: 'bicycle-outline', color: '#2D9CDB', screen: 'MyDeliveries' },
  { key: 'reportes', label: 'Reportes', icon: 'bar-chart', color: '#9B51E0', screen: 'Reports' },
  { key: 'usuarios', label: 'Usuarios', icon: 'people', color: '#27AE60', screen: 'Register' },
  { key: 'config', label: 'Configuracion', icon: 'settings', color: '#8E8E93', screen: 'Settings' },
];

const QUICK_ACTIONS = [
  { key: 'qa-presale', label: 'Nueva Pre-Venta', icon: 'cart', color: '#27AE60', screen: 'PreSales' },
  { key: 'qa-delivery', label: 'Nueva Entrega', icon: 'car-outline', color: '#2D9CDB', screen: 'MyDeliveries' },
  { key: 'qa-credit', label: 'Cobrar Credito', icon: 'cash-outline', color: '#F2994A', screen: 'Credits' },
];

export default function NewDashboardScreen({ user, navigation, stats, loading }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0.62)).current;
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadUserProfile = async () => {
      try {
        const currentUid = user?.uid || auth().currentUser?.uid;
        const currentEmail = user?.email || auth().currentUser?.email;

        if (!currentUid && !currentEmail) return;

        let docData = null;

        if (currentUid) {
          const docSnap = await firestore().collection('users').doc(currentUid).get();
          if (docSnap.exists) {
            docData = docSnap.data();
          }
        }

        if (!docData && currentEmail) {
          const querySnap = await firestore().collection('users').where('email', '==', currentEmail).limit(1).get();
          if (!querySnap.empty) {
            docData = querySnap.docs[0].data();
          }
        }

        if (isMounted) {
          setUserProfile(docData || null);
        }
      } catch (err) {
        console.log('loadUserProfile dashboard error:', err);
      }
    };

    loadUserProfile();

    return () => {
      isMounted = false;
    };
  }, [user?.uid, user?.email]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(progressAnim, { toValue: 0.85, duration: 1600, useNativeDriver: false }),
        Animated.timing(progressAnim, { toValue: 0.62, duration: 1600, useNativeDriver: false }),
      ])
    ).start();
  }, [pulse, progressAnim]);

  const firstName = (userProfile?.nombre || user?.nombre || user?.name || user?.displayName || user?.email?.split('@')?.[0] || 'Usuario').trim();
  const lastName = (userProfile?.apellido || user?.apellido || '').trim();
  const displayName = `${firstName}${lastName ? ` ${lastName}` : ''}`;
  const email = userProfile?.email || user?.email || auth().currentUser?.email || 'sin-correo';

  const trendStroke = useMemo(
    () => ({ transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.02] }) }] }),
    [pulse]
  );

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const navigateTo = (screen, params = {}) => {
    if (!navigation?.navigate || !screen) return;
    navigation.navigate(screen, params);
  };

  const handleLogout = async () => {
    try {
      await auth().signOut();
      navigation?.reset?.({ index: 0, routes: [{ name: 'Login' }] });
    } catch (err) {
      Alert.alert('Error', 'No se pudo cerrar sesion.');
      console.log('logout error:', err);
    }
  };

  const kpiValues = useMemo(() => {
    if (loading || !stats) {
      return {
        salesToday: 'C$0.00',
        activeDeliveries: '0',
        pendingCredits: 'C$0.00',
      };
    }

    return {
      salesToday: `C$${Number(stats.salesTodayTotal || 0).toFixed(2)}`,
      activeDeliveries: String(Number(stats.activeDeliveries || 0)),
      pendingCredits: `C$${Number(stats.pendingCreditsAmount || 0).toFixed(2)}`,
    };
  }, [stats, loading]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F4FA" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.greeting}>Hola, {displayName}!</Text>
            <Text style={styles.subtitle}>Administrador Principal - {email}</Text>
          </View>

          <View style={styles.headerActions}>
            <View style={styles.avatarRing}>
              <View style={styles.avatarInner}><Text style={styles.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text></View>
            </View>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Icon name="log-out-outline" size={20} color="#3F4A5B" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.kpiRow}>
          {KPI_ITEMS.map((item, index) => (
            <View key={item.key} style={[styles.kpiCard, styles.shadowSoft]}>
              <Text style={styles.kpiTitle}>{item.title}</Text>
              <Text style={styles.kpiValue}>{kpiValues[item.key]}</Text>

              {index === 0 ? (
                <Animated.View style={[styles.trendLineWrap, trendStroke]}>
                  <View style={[styles.trendSegment, { width: '24%', height: 2, marginTop: 10 }]} />
                  <View style={[styles.trendSegment, { width: '24%', height: 2, marginTop: 7 }]} />
                  <View style={[styles.trendSegment, { width: '24%', height: 2, marginTop: 4 }]} />
                  <View style={[styles.trendSegment, { width: '24%', height: 2, marginTop: 0 }]} />
                </Animated.View>
              ) : null}

              {index === 1 ? (
                <View style={styles.kpiIconWrapBlue}><Icon name="car-sport-outline" size={18} color="#2D9CDB" /></View>
              ) : null}

              {index === 2 ? (
                <View style={styles.barChartRow}>
                  <View style={[styles.bar, { height: 7 }]} />
                  <View style={[styles.bar, { height: 11 }]} />
                  <View style={[styles.bar, { height: 15 }]} />
                  <View style={[styles.bar, { height: 10 }]} />
                </View>
              ) : null}
            </View>
          ))}
        </View>

        <View style={styles.primaryRow}>
          {PRIMARY_MODULES.map((module, index) => (
            <TouchableOpacity
              key={module.key}
              style={[styles.primaryCard, index === 0 ? styles.primaryBlue : styles.primaryGreen]}
              onPress={() => navigateTo(module.screen)}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryTitle}>{module.label}</Text>
              <View style={index === 0 ? styles.primaryIconBubble : styles.primaryIconBubbleAlt}>
                <Icon name={module.icon} size={26} color="#fff" />
                {index === 0 ? <View style={styles.greenDot} /> : null}
              </View>
              {index === 0 ? (
                <View style={styles.progressTrack}>
                  <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
                </View>
              ) : (
                <Text style={styles.primaryHint}>Stock en tiempo real</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.moduleGrid}>
          {MODULES.map((module) => (
            <TouchableOpacity
              key={module.key}
              style={[styles.moduleCard, styles.shadowSoft]}
              onPress={() => navigateTo(module.screen)}
              activeOpacity={0.85}
            >
              <View style={[styles.moduleIconWrap, { backgroundColor: `${module.color}22` }]}>
                <Icon name={module.icon} size={17} color={module.color} />
              </View>
              <Text style={styles.moduleText} numberOfLines={2}>{module.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.quickTitle}>Acciones Rapidas</Text>
        <View style={styles.quickRow}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.key}
              style={[styles.quickBtn, styles.shadowSoft]}
              onPress={() => navigateTo(action.screen)}
              activeOpacity={0.9}
            >
              <Icon name={action.icon} size={16} color={action.color} />
              <Text style={styles.quickText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.footer}>© 2026 DIALIFGH</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#E8EEF6',
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 40,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTextWrap: { flex: 1, paddingRight: 8 },
  greeting: { fontSize: 22, fontWeight: '800', color: '#1D2B42' },
  subtitle: { fontSize: 12, color: '#60708A', marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  avatarRing: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#8DB4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F4F7FC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontWeight: '800', color: '#4266A9' },
  logoutBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EDF2FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  kpiCard: {
    width: '31.8%',
    minHeight: 108,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    padding: 10,
  },
  kpiTitle: { fontSize: 10, color: '#7A879C', fontWeight: '600' },
  kpiValue: { fontSize: 16, color: '#1D2B42', fontWeight: '800', marginVertical: 4 },
  trendLineWrap: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 6 },
  trendSegment: { backgroundColor: '#2ECC71', borderRadius: 3 },
  kpiIconWrapBlue: {
    marginTop: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E8F5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  barChartRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 8, gap: 4 },
  bar: { width: 5, backgroundColor: '#EB5757', borderRadius: 2 },
  primaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  primaryCard: {
    width: '48.8%',
    borderRadius: 18,
    padding: 12,
    minHeight: 132,
  },
  primaryBlue: { backgroundColor: '#2563EB' },
  primaryGreen: { backgroundColor: '#16A085' },
  primaryTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 10 },
  primaryIconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryIconBubbleAlt: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  greenDot: {
    position: 'absolute',
    right: 6,
    bottom: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2ECC71',
  },
  progressTrack: {
    height: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  progressFill: { height: 8, borderRadius: 6, backgroundColor: '#D6FBE6' },
  primaryHint: { color: 'rgba(255,255,255,0.92)', fontSize: 12, marginTop: 6 },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  moduleCard: {
    width: '31.8%',
    backgroundColor: '#fff',
    borderRadius: 14,
    minHeight: 80,
    paddingHorizontal: 8,
    paddingVertical: 10,
    marginBottom: 8,
  },
  moduleIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  moduleText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  quickTitle: { fontSize: 16, fontWeight: '800', color: '#1D2B42', marginBottom: 8 },
  quickRow: { gap: 8 },
  quickBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  quickText: { marginLeft: 8, color: '#334155', fontWeight: '700', fontSize: 13 },
  footer: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 11,
    color: '#9AA3B2',
    fontWeight: '500',
  },
  shadowSoft: {
    shadowColor: '#B7C6DA',
    shadowOpacity: 0.25,
    shadowOffset: { width: 2, height: 5 },
    shadowRadius: 7,
    elevation: 4,
  },
});
