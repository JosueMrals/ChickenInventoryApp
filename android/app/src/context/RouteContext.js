import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
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

  const updateRoute = useCallback(async (route) => {
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
  }, []);

  // value memoizado: varias pantallas usan `selectedRoute` como dependencia de
  // useEffect para montar listeners de Firestore. Un objeto nuevo por render
  // los desmontaría y volvería a montar sin que la ruta haya cambiado.
  const value = useMemo(
    () => ({ selectedRoute, updateRoute, loadingRoute }),
    [selectedRoute, updateRoute, loadingRoute],
  );

  return <RouteContext.Provider value={value}>{children}</RouteContext.Provider>;
};

export const useRoute = () => useContext(RouteContext);
