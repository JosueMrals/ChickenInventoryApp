import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import globalStyles from '../../styles/globalStyles';
import { useRoute } from '../../context/RouteContext';
import { subscribePendingReturnRequests } from '../../services/returnService';
import PendingReturnsList from './components/PendingReturnsList';
import ReturnHistoryList from './components/ReturnHistoryList';
import ShortagesList from './components/ShortagesList';

const TABS = [
  { id: 'pending', label: 'Pendientes', icon: 'return-up-back-outline' },
  { id: 'history', label: 'Historial', icon: 'time-outline' },
  { id: 'shortages', label: 'Faltantes', icon: 'alert-circle-outline' },
];

export default function ReturnsScreen({ navigation, user, role }) {
  const { selectedRoute } = useRoute();
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingCount, setPendingCount] = useState(0);

  // Admin supervisa todas las rutas; bodeguero trabaja sobre su ruta seleccionada
  const routeId = role === 'admin' ? null : (selectedRoute?.id || null);

  useEffect(() => {
    const unsub = subscribePendingReturnRequests((docs) => {
      setPendingCount(docs.length);
    }, routeId);
    return () => unsub();
  }, [routeId]);

  return (
    <View style={s.container}>
      <View style={globalStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={globalStyles.title}>Devoluciones</Text>
        <View style={{ width: 28 }} />
      </View>

      {routeId && selectedRoute && (
        <View style={s.routeBanner}>
          <Icon name="map-outline" size={16} color="#007AFF" />
          <Text style={s.routeBannerText}>{selectedRoute.name}</Text>
        </View>
      )}

      <View style={s.tabBar}>
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[s.tab, active && s.tabActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <View>
                <Icon name={tab.icon} size={18} color={active ? '#007AFF' : '#8E8E93'} />
                {tab.id === 'pending' && pendingCount > 0 && (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{pendingCount > 9 ? '9+' : pendingCount}</Text>
                  </View>
                )}
              </View>
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ flex: 1 }}>
        {activeTab === 'pending' && <PendingReturnsList routeId={routeId} />}
        {activeTab === 'history' && <ReturnHistoryList routeId={routeId} />}
        {activeTab === 'shortages' && <ShortagesList routeId={routeId} />}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },
  routeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  routeBannerText: { fontSize: 13, fontWeight: '700', color: '#333' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#007AFF',
    backgroundColor: '#007AFF10',
  },
  tabLabel: { fontSize: 12, fontWeight: '700', color: '#8E8E93' },
  tabLabelActive: { color: '#007AFF' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
});
