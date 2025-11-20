import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import Header from './components/Header';
import EmptyState from './components/EmptyState';
import QuickActions from './components/QuickActions';
import BottomBar from './components/BottomBar';
import { useDashboard } from './hooks/useDashboard';
import styles from './styles/dashboardStyles';

export default function DashboardScreen({ navigation }) {
  const { items } = useDashboard();

  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const goToSales = () => navigation.navigate('Sales');
  const goToCustomers = () => navigation.navigate('Customer');

  return (
    <Animated.View style={[styles.container, { opacity: fade }]}>

      <Header onCustomerPress={goToCustomers} />

      {items.length === 0 ? (
        <EmptyState onRegisterPress={goToSales} />
      ) : (
        <QuickActions />
      )}

      <BottomBar />

    </Animated.View>
  );
}
