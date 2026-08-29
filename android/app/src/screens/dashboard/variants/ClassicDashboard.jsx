import React, { useRef } from 'react';
import { View, Text, Animated, StatusBar, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRoute } from '../../../context/RouteContext';
import DashboardHeader from '../components/DashboardHeader';
import InfoSection from '../components/InfoSection';
import InfoRow from '../components/InfoRow';
import { getStatRows, getModuleGroups } from '../dashboardConfig';
import styles from '../styles/dashboardStyles';

const NAV_BAR_HEIGHT = 44;

// Variante Clásica: la lista agrupada tipo "Ajustes" que ya existía.
// Es puramente presentacional; los datos (stats/refresh) llegan por props
// desde el contenedor DashboardScreen.
export default function ClassicDashboard({
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
  const scrollY = useRef(new Animated.Value(0)).current;

  const safeRole = role ? role.toLowerCase() : '';
  const canSelectRoute = ['vendedor', 'entregador', 'bodeguero', 'user'].includes(safeRole);

  const statRows = getStatRows(role, stats);
  const moduleGroups = getModuleGroups(role);
  const rawTodayLabel = format(new Date(), "EEEE d 'de' MMMM", { locale: es });
  const todayLabel = rawTodayLabel.charAt(0).toUpperCase() + rawTodayLabel.slice(1);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F4F8" />

      <DashboardHeader displayName={displayName} scrollY={scrollY} onToggleVariant={onToggleVariant} />

      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + NAV_BAR_HEIGHT }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            colors={['#007AFF']}
            tintColor="#007AFF"
            progressViewOffset={insets.top + NAV_BAR_HEIGHT}
          />
        }
      >
        <View style={styles.largeTitleBlock}>
          <Text style={styles.largeTitleGreeting}>Hola, {displayName} 👋</Text>
          <Text style={styles.largeTitleSubtitle}>
            {role ? `${role.toUpperCase()} • ` : ''}{todayLabel}
          </Text>
        </View>

        <View style={styles.sectionsContainer}>
          {canSelectRoute && (
            <InfoSection>
              <InfoRow
                icon="location-sharp"
                color="#007AFF"
                label="Ruta actual"
                value={selectedRoute ? selectedRoute.name : 'Seleccionar'}
                onPress={() => navigation.navigate('RouteSelection', { user, role })}
                wrapValue
              />
            </InfoSection>
          )}

          {statRows.length > 0 && (
            <InfoSection title="Resumen">
              {statRows.map((stat) => (
                <InfoRow key={stat.key} icon={stat.icon} color={stat.color} label={stat.title} value={stat.value} />
              ))}
            </InfoSection>
          )}

          {moduleGroups.map((group) => (
            <InfoSection key={group.label} title={group.label}>
              {group.modules.map((m) => (
                <InfoRow
                  key={m.key}
                  icon={m.icon}
                  color={m.color}
                  label={m.label}
                  onPress={() => navigation.navigate(m.screen, { user, role })}
                />
              ))}
            </InfoSection>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2025 DIALIFGH</Text>
        </View>
      </Animated.ScrollView>
    </View>
  );
}
