import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { firestore } from '../services/firebaseConfig';

export default function Dashboard({ user, role }) {
  const navigation = useNavigation();
  const [stats, setStats] = useState({
    products: 0,
    lowStock: 0,
    users: 0,
    verifiedUsers: 0,
  });
  const [loading, setLoading] = useState(true);
  const anim = new Animated.Value(0);

  // 🔹 Estadísticas desde Firestore
  useEffect(() => {
    const unsubProducts = firestore()
      .collection('products')
      .onSnapshot((snap) => {
        const data = snap.docs.map((doc) => doc.data());
        const low = data.filter((p) => (p.stock || 0) < 5).length;
        setStats((prev) => ({ ...prev, products: data.length, lowStock: low }));
      });

    const unsubUsers = firestore()
      .collection('users')
      .onSnapshot((snap) => {
        const data = snap.docs.map((doc) => doc.data());
        const verified = data.filter((u) => u.verified).length;
        setStats((prev) => ({ ...prev, users: data.length, verifiedUsers: verified }));
        setLoading(false);
      });

    // animación suave al montar
    Animated.timing(anim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    return () => {
      unsubProducts();
      unsubUsers();
    };
  }, []);

  // 🔹 Lista de módulos
  const modules = [
    {
      key: 'products',
      label: 'Inventario',
      icon: 'cube-outline',
      color: '#007AFF',
      screen: 'ProductList',
      roles: ['admin', 'user'],
    },
    {
      key: 'users',
      label: 'Usuarios',
      icon: 'people-outline',
      color: '#34C759',
      screen: 'Register',
      roles: ['admin'],
    },
    {
      key: 'customers',
      label: 'Clientes',
      icon: 'person-sharp',
      color: '#FF9500',
      screen: 'Customer',
      roles: ['admin'],
    },
    {
      key: 'sales',
      label: 'Ventas',
      icon: 'cash-outline',
      color: '#FF2D55',
      screen: 'Sales',
      roles: ['admin', 'user'],
    },
    {
    key: 'credits',
    label: 'Créditos',
    icon: 'card-outline',
    color: '#FF3B30',
    screen: 'Credits',
    roles: ['admin', 'user'],
    },
    {
      key: 'reports',
      label: 'Reportes',
      icon: 'bar-chart-outline',
      color: '#5856D6',
      screen: 'Reports',
      roles: ['admin', 'user'],
    },
    {
      key: 'settings',
      label: 'Configuración',
      icon: 'settings-outline',
      color: '#FF9500',
      screen: 'Settings',
      roles: ['admin'],
    },

  ];

  const availableModules = modules.filter((m) => m.roles.includes(role));

  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate(item.screen, { user, role })}
      activeOpacity={0.9}
      style={{
        backgroundColor: item.color,
        borderRadius: 16,
        margin: 10,
        paddingVertical: 28,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 3,
        transform: [
          {
            scale: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.9, 1],
            }),
          },
        ],
        opacity: anim,
      }}
    >
      <Ionicons name={item.icon} size={40} color="#fff" />
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 8 }}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 10, color: '#555' }}>Cargando panel...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F6FA', paddingHorizontal: 16, paddingTop: 50 }}>
      {/* Encabezado */}
      <Text style={{ fontSize: 26, fontWeight: '800', color: '#007AFF', marginBottom: 6 }}>
        Bienvenido
      </Text>
      <Text style={{ fontSize: 16, color: '#666', marginBottom: 20 }}>
        {user.email} ({role.toUpperCase()})
      </Text>

      {/* 🔹 Tarjetas de estadísticas */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <StatCard icon="cube-outline" color="#007AFF" title="Productos" value={stats.products} />
        <StatCard icon="alert-circle-outline" color="#FF3B30" title="Stock bajo" value={stats.lowStock} />
        {role === 'admin' && (
          <>
            <StatCard icon="people-outline" color="#34C759" title="Usuarios" value={stats.users} />
            <StatCard icon="checkmark-done-outline" color="#5856D6" title="Verificados" value={stats.verifiedUsers} />
          </>
        )}
      </View>

      {/* 🔹 Módulos */}
      <Text style={{ fontSize: 20, fontWeight: '700', marginTop: 25, marginLeft: 5, color: '#333' }}>
        Operaciones
      </Text>

      <FlatList
        data={availableModules}
        numColumns={2}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 30 }}
      />

      {/* Footer */}
      <View style={{ alignItems: 'center', marginTop: 10 }}>
        <Text style={{ fontSize: 13, color: '#aaa', marginBottom: 20 }}>© 2025 ChickenInventoryApp</Text>
      </View>
    </View>
  );
}

// 🔹 Componente para tarjetas de estadísticas
function StatCard({ icon, color, title, value }) {
  return (
    <View
      style={{
        backgroundColor: color,
        flexBasis: '48%',
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{title}</Text>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{value}</Text>
      </View>
      <Ionicons name={icon} size={30} color="#fff" />
    </View>
  );
}
