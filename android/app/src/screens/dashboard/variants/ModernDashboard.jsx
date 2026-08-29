import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StatusBar,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRoute } from '../../../context/RouteContext';
import { navigationRef } from '../../../../../../App';
import { getStatRows, getModuleGroups } from '../dashboardConfig';

// Densidad: escala global ×0.9 — reduce la vista del tablero un 10%.
const S = 0.9;
const dim = (n) => Math.round(n * S);

// Variante Moderna: hero compacto + indicadores en grid 2 columnas + módulos
// como mosaicos tipo lanzador (3 por fila). Presentacional: recibe stats/refresh
// del contenedor y reutiliza la misma config de datos que la variante Clásica.
export default function ModernDashboard({
  user,
  role,
  navigation,
  stats,
  refreshing,
  refresh,
  displayName,
  onToggleVariant,
}) {
  const insets = useSafeAreaInsets();
  const { selectedRoute } = useRoute();

  const safeRole = role ? role.toLowerCase() : '';
  const canSelectRoute = ['vendedor', 'entregador', 'bodeguero', 'user'].includes(safeRole);

  const statRows = getStatRows(role, stats);
  const moduleGroups = getModuleGroups(role);
  const rawTodayLabel = format(new Date(), "EEEE d 'de' MMMM", { locale: es });
  const todayLabel = rawTodayLabel.charAt(0).toUpperCase() + rawTodayLabel.slice(1);

  const handleLogout = async () => {
    try {
      await auth().signOut();
      if (navigationRef.isReady()) {
        navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
      }
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      Alert.alert('Error', 'No se pudo cerrar la sesión.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A63C9" />

      {/* Hero */}
      <View style={[styles.hero, { paddingTop: insets.top + dim(14) }]}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroAvatar}>
            <Text style={styles.heroAvatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.heroGreetingBlock}>
            <Text style={styles.heroGreeting} numberOfLines={1}>Hola, {displayName}</Text>
            <Text style={styles.heroDate} numberOfLines={1}>{todayLabel}</Text>
          </View>
          <View style={styles.heroActions}>
            <TouchableOpacity onPress={onToggleVariant} style={styles.heroIconBtn} activeOpacity={0.7}>
              <Ionicons name="list-outline" size={dim(19)} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={styles.heroIconBtn} activeOpacity={0.7}>
              <Ionicons name="log-out-outline" size={dim(19)} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
        {role ? (
          <View style={styles.roleChip}>
            <Text style={styles.roleChipText}>{role.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            colors={['#007AFF']}
            tintColor="#007AFF"
          />
        }
      >
        {/* Selector de ruta */}
        {canSelectRoute && (
          <TouchableOpacity
            style={styles.routeCard}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('RouteSelection', { user, role })}
          >
            <View style={styles.routeIconWrap}>
              <Ionicons name="location-sharp" size={dim(20)} color="#007AFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Ruta actual</Text>
              <Text style={styles.routeValue} numberOfLines={1}>
                {selectedRoute ? selectedRoute.name : 'Seleccionar ruta'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={dim(20)} color="#C7C7CC" />
          </TouchableOpacity>
        )}

        {/* Indicadores en grid 2 columnas */}
        {statRows.length > 0 && (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Resumen</Text>
            <View style={styles.statGrid}>
              {statRows.map((stat) => (
                <View key={stat.key} style={styles.statCard}>
                  <View style={[styles.statIconWrap, { backgroundColor: stat.color + '18' }]}>
                    <Ionicons name={stat.icon} size={dim(16)} color={stat.color} />
                  </View>
                  <View style={styles.statTextWrap}>
                    <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                      {stat.value}
                    </Text>
                    <Text style={styles.statTitle} numberOfLines={1}>{stat.title}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Módulos como mosaicos 3 por fila */}
        {moduleGroups.map((group) => (
          <View key={group.label} style={styles.block}>
            <Text style={styles.blockTitle}>{group.label}</Text>
            <View style={styles.tileGrid}>
              {group.modules.map((m) => (
                <TouchableOpacity
                  key={m.key}
                  style={styles.tile}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate(m.screen, { user, role })}
                >
                  <View style={[styles.tileIconWrap, { backgroundColor: m.color + '18' }]}>
                    <Ionicons name={m.icon} size={dim(24)} color={m.color} />
                  </View>
                  <Text style={styles.tileLabel} numberOfLines={2}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2025 DIALIFGH</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  // --- Hero ---
  hero: {
    backgroundColor: '#0A63C9',
    paddingHorizontal: dim(18),
    paddingBottom: dim(18),
    borderBottomLeftRadius: dim(24),
    borderBottomRightRadius: dim(24),
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroAvatar: {
    width: dim(44),
    height: dim(44),
    borderRadius: dim(22),
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: dim(12),
  },
  heroAvatarInitial: {
    color: '#FFFFFF',
    fontSize: dim(19),
    fontWeight: '800',
  },
  heroGreetingBlock: {
    flex: 1,
  },
  heroGreeting: {
    color: '#FFFFFF',
    fontSize: dim(19),
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroDate: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: dim(12.5),
    fontWeight: '600',
    marginTop: dim(2),
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroIconBtn: {
    width: dim(36),
    height: dim(36),
    borderRadius: dim(12),
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: dim(8),
  },
  roleChip: {
    alignSelf: 'flex-start',
    marginTop: dim(14),
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: dim(12),
    paddingVertical: dim(5),
    borderRadius: dim(30),
  },
  roleChipText: {
    color: '#FFFFFF',
    fontSize: dim(11),
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  // --- Scroll ---
  scrollContent: {
    paddingTop: dim(18),
    paddingBottom: dim(8),
  },
  block: {
    paddingHorizontal: dim(16),
    marginBottom: dim(22),
  },
  blockTitle: {
    fontSize: dim(13),
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: dim(12),
    marginLeft: dim(4),
  },
  // --- Route card ---
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: dim(16),
    marginBottom: dim(22),
    padding: dim(14),
    borderRadius: dim(16),
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  routeIconWrap: {
    width: dim(40),
    height: dim(40),
    borderRadius: dim(12),
    backgroundColor: '#007AFF18',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: dim(12),
  },
  routeLabel: {
    fontSize: dim(12),
    fontWeight: '600',
    color: '#8E8E93',
  },
  routeValue: {
    fontSize: dim(16),
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: dim(2),
  },
  // --- Stat grid (2 columnas) ---
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: dim(14),
    paddingVertical: dim(9),
    paddingHorizontal: dim(11),
    marginBottom: dim(10),
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statIconWrap: {
    width: dim(30),
    height: dim(30),
    borderRadius: dim(9),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: dim(10),
  },
  statTextWrap: {
    flex: 1,
  },
  statValue: {
    fontSize: dim(16),
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  statTitle: {
    fontSize: dim(11),
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: dim(1),
  },
  // --- Module tiles (3 por fila) ---
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tile: {
    width: '33.333%',
    alignItems: 'center',
    paddingVertical: dim(10),
    paddingHorizontal: dim(4),
    marginBottom: dim(6),
  },
  tileIconWrap: {
    width: dim(58),
    height: dim(58),
    borderRadius: dim(18),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: dim(8),
  },
  tileLabel: {
    fontSize: dim(12),
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: dim(15),
  },
  // --- Footer ---
  footer: {
    alignItems: 'center',
    paddingVertical: dim(20),
  },
  footerText: {
    fontSize: dim(12),
    color: '#C7C7CC',
    fontWeight: '500',
  },
});
