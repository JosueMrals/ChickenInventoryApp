import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Animated,
  ScrollView,
  Image,
} from 'react-native';
import { firestore } from '../services/firebaseConfig';
import auth from '@react-native-firebase/auth';

export default function ProfileScreen({ route, navigation }) {
  const { user: routeUser, role: routeRole } = route.params || {};
  const [user, setUser] = useState(routeUser || auth().currentUser);
  const [role, setRole] = useState(routeRole || '');
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (user?.uid) fetchProfile();

    // Animación de entrada
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [user]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const docSnap = await firestore().collection('users').doc(user.uid).get();
      if (docSnap.exists) setProfileData(docSnap.data());
    } catch (e) {
      console.log('🔥 Error obteniendo perfil:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await auth().signOut();
    navigation.replace('Login');
  };

  const firstLetter = user?.email?.charAt(0)?.toUpperCase() || 'U';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6FA' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}>
        {/* 🔷 Header con gradiente */}
        <View
          style={{
            height: 180,
            backgroundColor: '#007AFF',
            borderBottomLeftRadius: 25,
            borderBottomRightRadius: 25,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#007AFF',
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 6,
          }}
        >
          <View
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: '#fff',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 8,
              elevation: 4,
            }}
          >
            <Text style={{ fontSize: 36, color: '#007AFF', fontWeight: '700' }}>
              {firstLetter}
            </Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>
            {user?.email}
          </Text>
          <Text style={{ color: '#E0E0E0', fontSize: 14 }}>
            {role?.toUpperCase() || profileData?.role?.toUpperCase() || 'USER'}
          </Text>
        </View>

        {/* 🧾 Datos del perfil */}
        <Animated.View
          style={{
            flex: 1,
            padding: 20,
            opacity: fadeAnim,
            transform: [
              {
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          }}
        >
          {loading ? (
            <View style={{ justifyContent: 'center', alignItems: 'center', marginTop: 40 }}>
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          ) : (
            <View style={{ gap: 15 }}>
              <View style={card}>
                <Text style={label}>Correo electrónico</Text>
                <Text style={value}>{user?.email}</Text>
              </View>

              <View style={card}>
                <Text style={label}>Rol</Text>
                <Text style={[value, { color: role === 'admin' ? '#007AFF' : '#333' }]}>
                  {role || profileData?.role || 'user'}
                </Text>
              </View>

              <View style={card}>
                <Text style={label}>ID de usuario (UID)</Text>
                <Text
                  style={[value, { fontSize: 13, color: '#666' }]}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {user?.uid}
                </Text>
              </View>

              {profileData?.createdAt && (
                <View style={card}>
                  <Text style={label}>Fecha de registro</Text>
                  <Text style={value}>
                    {new Date(profileData.createdAt.seconds * 1000).toLocaleString()}
                  </Text>
                </View>
              )}
            </View>
          )}
        </Animated.View>

        {/* 🔴 Botón de cerrar sesión */}
        <TouchableOpacity
          onPress={handleLogout}
          activeOpacity={0.8}
          style={{
            backgroundColor: '#FF3B30',
            marginHorizontal: 20,
            marginTop: 10,
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: 'center',
            elevation: 4,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
            Cerrar sesión
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const card = {
  backgroundColor: '#fff',
  borderRadius: 12,
  padding: 16,
  elevation: 2,
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 6,
};

const label = {
  fontSize: 14,
  color: '#999',
  fontWeight: '500',
  marginBottom: 4,
};

const value = {
  fontSize: 16,
  color: '#222',
  fontWeight: '600',
};
