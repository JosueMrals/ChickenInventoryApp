import { useState, useEffect } from 'react';
import routesService from '../../routes/services/routesService';

/**
 * Hook que carga la lista de rutas disponibles desde Firestore.
 * Usado en los formularios de productos para configurar precios por ruta.
 */
export function useRoutes() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    routesService.getRoutes()
      .then((data) => {
        if (!cancelled) {
          setRoutes(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('useRoutes error:', err);
          setError(err);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  return { routes, loading, error };
}

