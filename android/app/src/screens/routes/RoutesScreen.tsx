import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { NavigationProp } from '@react-navigation/native';
import globalStyles from '../../styles/globalStyles';
import RouteEditPanel from './components/RouteEditPanel';
import routesService from './services/routesService';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Route {
  id: string;
  name: string;
  start: string;
  end: string;
  createdAt?: any;
  updatedAt?: any;
}

interface Props {
  navigation: NavigationProp<any>;
}

// ── Constantes de diseño ──────────────────────────────────────────────────────
const ACCENT = '#E91E63';
const ACCENT_LIGHT = '#FCE4EC';
const HEADER_BG = '#007AFF';

// ── Ordenamiento por día de semana ────────────────────────────────────────────
const DAY_ORDER: Record<string, number> = {
  lunes: 0, monday: 0,
  martes: 1, tuesday: 1,
  miercoles: 2, miércoles: 2, wednesday: 2,
  jueves: 3, thursday: 3,
  viernes: 4, friday: 4,
  sabado: 5, sábado: 5, saturday: 5,
  domingo: 6, sunday: 6,
};

function getDayIndex(name: string): number {
  const lower = (name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const key of Object.keys(DAY_ORDER)) {
    const normalizedKey = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lower.startsWith(normalizedKey)) return DAY_ORDER[key];
  }
  return 99; // sin día conocido → al final
}

function sortRoutesByDay(list: Route[]): Route[] {
  return [...list].sort((a, b) => {
    const diff = getDayIndex(a.name) - getDayIndex(b.name);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name, 'es');
  });
}

// ── Sub-componente: Card de ruta ──────────────────────────────────────────────
interface RouteCardProps {
  item: Route;
  onEdit: (route: Route) => void;
  onDelete: (route: Route) => void;
}

const RouteCard: React.FC<RouteCardProps> = ({ item, onEdit, onDelete }) => (
  <View style={styles.card}>
    {/* Franja de color izquierda */}
    <View style={styles.cardAccent} />

    <View style={styles.cardContent}>
      {/* Header de la tarjeta */}
      <View style={styles.cardHeader}>
        <View style={styles.cardIconWrap}>
          <Icon name="map" size={18} color={ACCENT} />
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onEdit(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="create-outline" size={19} color="#555" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDelete]}
            onPress={() => onDelete(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="trash-outline" size={19} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Línea de ruta */}
      <View style={styles.routeLine}>
        {/* Origen */}
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: '#22C55E' }]} />
          <View style={styles.routeInfo}>
            <Text style={styles.routePointLabel}>INICIO</Text>
            <Text style={styles.routePointText} numberOfLines={1}>{item.start}</Text>
          </View>
        </View>

        {/* Conector */}
        <View style={styles.routeConnectorWrap}>
          <View style={styles.routeConnectorLine} />
          <Icon name="arrow-forward" size={14} color="#9CA3AF" />
        </View>

        {/* Destino */}
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: '#EF4444' }]} />
          <View style={styles.routeInfo}>
            <Text style={styles.routePointLabel}>FIN</Text>
            <Text style={styles.routePointText} numberOfLines={1}>{item.end}</Text>
          </View>
        </View>
      </View>
    </View>
  </View>
);

// ── Componente principal ──────────────────────────────────────────────────────

export default function RoutesScreen({ navigation }: Props) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [editPanelVisible, setEditPanelVisible] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);

  // ── Listener en tiempo real ─────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    const unsubscribe = firestore()
      .collection('routes')
      .orderBy('name', 'asc')
      .onSnapshot(
        (snapshot) => {
          const data: Route[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<Route, 'id'>),
          }));
          setRoutes(sortRoutesByDay(data));
          setLoading(false);
          setRefreshing(false);
        },
        (error) => {
          console.error('Routes snapshot error:', error);
          Alert.alert('Error', 'No se pudieron cargar las rutas.');
          setLoading(false);
          setRefreshing(false);
        }
      );

    return () => unsubscribe();
  }, []);

  // ── Pull-to-refresh (solo fuerza visual; el listener ya actualiza en tiempo real) ─
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // El listener actualiza automáticamente; solo reseteamos el flag tras un delay
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  // ── Filtrado por búsqueda ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return routes;
    return routes.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.start.toLowerCase().includes(q) ||
        r.end.toLowerCase().includes(q)
    );
  }, [routes, search]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleEdit = (route: Route) => {
    setSelectedRoute(route);
    setEditPanelVisible(true);
  };

  const handleDelete = (route: Route) => {
    Alert.alert(
      'Eliminar ruta',
      `¿Estás seguro de que deseas eliminar "${route.name}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await routesService.deleteRoute(route.id);
              // El listener actualiza automáticamente
            } catch {
              Alert.alert('Error', 'No se pudo eliminar la ruta.');
            }
          },
        },
      ]
    );
  };

  const handleSaveRoute = async (updatedRoute: Route) => {
    try {
      await routesService.updateRoute(updatedRoute.id, {
        name: updatedRoute.name,
        start: updatedRoute.start,
        end: updatedRoute.end,
      });
      // El listener actualiza la lista automáticamente
    } catch (error) {
      console.error('Error updating route:', error);
      Alert.alert('Error', 'No se pudo actualizar la ruta.');
      throw error;
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Icon name="map-outline" size={52} color={ACCENT} />
      </View>
      <Text style={styles.emptyTitle}>
        {search ? 'Sin resultados' : 'Sin rutas registradas'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {search
          ? `No se encontró ninguna ruta con "${search}"`
          : 'Toca el botón + para agregar tu primera ruta de entrega.'}
      </Text>
      {search.length > 0 && (
        <TouchableOpacity style={styles.clearSearchBtn} onPress={() => setSearch('')}>
          <Text style={styles.clearSearchText}>Limpiar búsqueda</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderItem = ({ item }: { item: Route }) => (
    <RouteCard item={item} onEdit={handleEdit} onDelete={handleDelete} />
  );

  return (
    <SafeAreaView style={globalStyles.container}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={globalStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={globalStyles.title}>Rutas de Entrega</Text>
        {/* Badge con contador */}
        {!loading && routes.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{routes.length}</Text>
          </View>
        )}
      </View>

      {/* ── Barra de búsqueda ────────────────────────────────────────────── */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Icon name="search-outline" size={18} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar ruta, inicio o destino..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Lista ────────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Cargando rutas...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[ACCENT]}
              tintColor={ACCENT}
            />
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── FAB ──────────────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddRouteScreen')}
        activeOpacity={0.85}
      >
        <Icon name="add" size={30} color="#fff" />
      </TouchableOpacity>

      {/* ── Panel de edición ─────────────────────────────────────────────── */}
      <RouteEditPanel
        visible={editPanelVisible}
        route={selectedRoute}
        onClose={() => {
          setEditPanelVisible(false);
          setSelectedRoute(null);
        }}
        onSave={handleSaveRoute}
      />
    </SafeAreaView>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Header badge ─────────────────────────────────────────────────────────
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    minWidth: 28,
    alignItems: 'center',
  },
  countBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },

  // ── Búsqueda ─────────────────────────────────────────────────────────────
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    paddingVertical: 0,
  },

  // ── Lista ────────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    flexGrow: 1,
  },

  // ── Loading ──────────────────────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },

  // ── Empty state ──────────────────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: ACCENT_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  clearSearchBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: ACCENT_LIGHT,
    borderRadius: 20,
  },
  clearSearchText: {
    color: ACCENT,
    fontWeight: '600',
    fontSize: 14,
  },

  // ── Card ─────────────────────────────────────────────────────────────────
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    overflow: 'hidden',
  },
  cardAccent: {
    width: 4,
    backgroundColor: ACCENT,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  cardContent: {
    flex: 1,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: ACCENT_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnDelete: {
    backgroundColor: '#FEF2F2',
  },

  // ── Línea de ruta ────────────────────────────────────────────────────────
  routeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  routePoint: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeInfo: {
    flex: 1,
  },
  routePointLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  routePointText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  routeConnectorWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: 4,
  },
  routeConnectorLine: {
    width: 12,
    height: 1,
    backgroundColor: '#D1D5DB',
  },

  // ── FAB ─────────────────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    backgroundColor: ACCENT,
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
});

