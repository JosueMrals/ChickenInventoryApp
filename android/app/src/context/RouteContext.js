import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RouteContext = createContext();

export const RouteProvider = ({ children }) => {
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(true);

  useEffect(() => {
    loadRoute();
  }, []);

  const loadRoute = async () => {
    try {
      const storedRoute = await AsyncStorage.getItem('selected_route');
      if (storedRoute) {
        setSelectedRoute(JSON.parse(storedRoute));
      }
    } catch (e) {
      console.error('Failed to load route', e);
    } finally {
      setLoadingRoute(false);
    }
  };

  const updateRoute = async (route) => {
    try {
      if (route) {
        await AsyncStorage.setItem('selected_route', JSON.stringify(route));
      } else {
        await AsyncStorage.removeItem('selected_route');
      }
      setSelectedRoute(route);
    } catch (e) {
      console.error('Failed to save route', e);
    }
  };

  return (
    <RouteContext.Provider value={{ selectedRoute, updateRoute, loadingRoute }}>
      {children}
    </RouteContext.Provider>
  );
};

export const useRoute = () => useContext(RouteContext);
