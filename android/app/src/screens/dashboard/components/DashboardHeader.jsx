import React from 'react';
import { View, Text, TouchableOpacity, Alert, Animated, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigationRef } from '../../../../../../App';
import styles from '../styles/DashboardHeaderStyles';

const COLLAPSE_DISTANCE = 40;

export default function DashboardHeader({ displayName, scrollY }) {
  const insets = useSafeAreaInsets();

  const handleLogout = async () => {
    try {
      await auth().signOut();
      if (navigationRef.isReady()) {
        navigationRef.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      Alert.alert('Error', 'No se pudo cerrar la sesión.');
    }
  };

  const collapseProgress = scrollY.interpolate({
    inputRange: [0, COLLAPSE_DISTANCE],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.navBar, { height: insets.top + 44, paddingTop: insets.top }]}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.navBarBg, { opacity: collapseProgress }]}
      />

      <View style={styles.avatar}>
        <Text style={styles.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
      </View>

      <Animated.Text style={[styles.collapsedTitle, { opacity: collapseProgress }]} numberOfLines={1}>
        {displayName}
      </Animated.Text>

      <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
        <Icon name="log-out-outline" size={20} color="#FF3B30" />
      </TouchableOpacity>
    </View>
  );
}
