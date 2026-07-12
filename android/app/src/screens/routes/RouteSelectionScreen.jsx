import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  StatusBar,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useRoute } from '../../context/RouteContext';

// ── Ordenamiento por día de semana ────────────────────────────────────────────
const DAY_ORDER = {
  lunes: 0, monday: 0,
  martes: 1, tuesday: 1,
  miercoles: 2, miércoles: 2, wednesday: 2,
  jueves: 3, thursday: 3,
  viernes: 4, friday: 4,
  sabado: 5, sábado: 5, saturday: 5,
  domingo: 6, sunday: 6,
};

function getDayIndex(name) {
  const lower = (name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const key of Object.keys(DAY_ORDER)) {
    const nk = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lower.startsWith(nk)) return DAY_ORDER[key];
  }
  return 99;
}

function sortRoutesByDay(list) {
  return [...list].sort((a, b) => {
    const diff = getDayIndex(a.name) - getDayIndex(b.name);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name, 'es');
  });
}

// ── Etiqueta del día ──────────────────────────────────────────────────────────
const DAY_LABELS = {
  0: { label: 'Lunes',     color: '#6366F1', bg: '#EEF2FF' },
  1: { label: 'Martes',    color: '#8B5CF6', bg: '#F5F3FF' },
  2: { label: 'Miércoles', color: '#0EA5E9', bg: '#E0F2FE' },
  3: { label: 'Jueves',    color: '#10B981', bg: '#D1FAE5' },
  4: { label: 'Viernes',   color: '#F59E0B', bg: '#FEF3C7' },
  5: { label: 'Sábado',    color: '#EF4444', bg: '#FEE2E2' },
  6: { label: 'Domingo',   color: '#EC4899', bg: '#FCE7F3' },
};

function getDayChip(name) {
  const idx = getDayIndex(name);
  return DAY_LABELS[idx] || null;
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function RouteSelectionScreen({ navigation, route }) {
  const { user, role, returnTo } = route.params || {};
  const { updateRoute } = useRoute();
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selecting, setSelecting] = useState(null); // id de ruta en proceso

  // Listener en tiempo real
  useEffect(() => {
    const unsubscribe = firestore()
      .collection('routes')
      .orderBy('name', 'asc')
      .onSnapshot(
        (snapshot) => {
          const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          setRoutes(sortRoutesByDay(data));
          setLoading(false);
          setRefreshing(false);
        },
        (error) => {
          console.error(error);
          Alert.alert('Error', 'No se pudieron cargar las rutas.');
          setLoading(false);
          setRefreshing(false);
        }
      );
    return () => unsubscribe();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleSelectRoute = async (selected) => {
    setSelecting(selected.id);
    try {
      await updateRoute(selected);
      navigation.replace('AppDrawer', { user, role, screen: returnTo });
    } catch {
      Alert.alert('Error', 'No se pudo seleccionar la ruta.');
    } finally {
      setSelecting(null);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que deseas cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            try {
              await auth().signOut();
              navigation.replace('Login');
            } catch {
              Alert.alert('Error', 'No se pudo cerrar la sesión.');
            }
          },
        },
      ]
    );
  };

  // ── Render item ─────────────────────────────────────────────────────────────
  const renderItem = ({ item, index }) => {
    const chip = getDayChip(item.name);
    const isSelecting = selecting === item.id;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleSelectRoute(item)}
        activeOpacity={0.75}
        disabled={!!selecting}
      >
        {/* Número de orden */}
        <View style={[styles.orderBadge, chip ? { backgroundColor: chip.bg } : {}]}>
          <Text style={[styles.orderText, chip ? { color: chip.color } : {}]}>
            {index + 1}
          </Text>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.routeName} numberOfLines={1}>{item.name}</Text>

          </View>
          <View style={styles.routeDetailsRow}>
            <Icon name="navigate-circle-outline" size={13} color="#22C55E" />
            <Text style={styles.routeDetailText} numberOfLines={1}>{item.start}</Text>
            <Icon name="arrow-forward" size={11} color="#9CA3AF" style={{ marginHorizontal: 4 }} />
            <Icon name="flag-outline" size={13} color="#EF4444" />
            <Text style={styles.routeDetailText} numberOfLines={1}>{item.end}</Text>
          </View>
        </View>

        {isSelecting
          ? <ActivityIndicator size="small" color="#007AFF" style={{ marginLeft: 8 }} />
          : <Icon name="chevron-forward" size={20} color="#CBD5E1" />
        }
      </TouchableOpacity>
    );
  };

  // ── UI ──────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#007AFF" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerIconWrap}>
            <Icon name="map" size={28} color="#fff" />
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="log-out-outline" size={22} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>Selecciona tu Ruta</Text>
        <Text style={styles.headerSubtitle}>Elige la ruta de trabajo para hoy</Text>
        {user?.email && (
          <View style={styles.userBadge}>
            <Icon name="person-circle-outline" size={14} color="rgba(255,255,255,0.8)" />
            <Text style={styles.userBadgeText}>{user.email}</Text>
          </View>
        )}
      </View>

      {/* Lista */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando rutas...</Text>
        </View>
      ) : (
        <FlatList
          data={routes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#007AFF']} />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="map-outline" size={52} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>Sin rutas disponibles</Text>
              <Text style={styles.emptySubtitle}>Contacta al administrador para configurar las rutas.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },

  // Header
  header: {
    backgroundColor: '#007AFF',
    paddingTop: 40,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 10,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  userBadgeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },

  // Lista
  list: {
    padding: 16,
    paddingBottom: 40,
  },

  // Card
  card: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
    gap: 12,
  },
  orderBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748B',
  },
  cardBody: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
    flexWrap: 'wrap',
  },
  routeName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    flexShrink: 1,
  },
  dayChip: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dayChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  routeDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 3,
  },
  routeDetailText: {
    fontSize: 12,
    color: '#64748B',
    flexShrink: 1,
    maxWidth: 90,
  },

  // Loading / Empty
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#374151',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
});
