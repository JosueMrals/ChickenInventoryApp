import { useCallback, useEffect, useRef, useState } from 'react';
import { getAggregateFromServer, sum } from '@react-native-firebase/firestore';
import { firestore } from '../../../services/firebaseConfig';

const ACTIVE_DELIVERY_STATUSES = [
  'dispatched',
  'credit_dispatched',
  'ready_for_delivery',
  'credit_ready_for_delivery',
];

export const useDashboardStats = (role, user) => {
  const [stats, setStats] = useState({
    products: 0,
    lowStock: 0,
    users: 0,
    verifiedUsers: 0,
    pendingPreSales: 0,
    readyForDelivery: 0,
    assignedDeliveries: 0,
    totalToCollect: 0,
    salesTodayTotal: 0,
    activeDeliveries: 0,
    pendingCreditsAmount: 0,
  });
  // `loading` es solo el primer cargue (spinner de pantalla completa).
  // `refreshing` son los recálculos posteriores, que no deben tapar la pantalla.
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const mountedRef = useRef(true);
  const firstLoadRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  // Los agregados son one-shot: esto permite recalcularlos (pull-to-refresh, o al
  // volver el foco a la pantalla) sin volver a los listeners de colección completa.
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    const loadingState = {
      products: role === 'admin',
      users: role === 'admin',
      salesToday: role === 'admin',
      activeDeliveries: role === 'admin',
      pendingCredits: role === 'admin',
      deliveries: role === 'entregador',
    };

    if (!firstLoadRef.current) setRefreshing(true);

    const markLoaded = (key) => {
      loadingState[key] = false;
      const pending = Object.values(loadingState).some(Boolean);
      if (!pending) {
        setLoading(false);
        setRefreshing(false);
        firstLoadRef.current = false;
      }
    };

    const unsubs = [];

    if (role === 'admin') {
      // Todas estas tarjetas son agregados. Antes cada una abría un listener sobre
      // la colección COMPLETA (products, users, presales, credits) y contaba o sumaba
      // en JS — se descargaba toda la base para mostrar cinco números.
      //
      // count()/sum() se resuelven en el servidor y no transfieren documentos, pero
      // no son suscripciones: el tablero pasa a refrescarse al montar y cuando se
      // llame refresh(), no en vivo. Para un tablero de indicadores es el trade-off
      // correcto; los flujos operativos (Bodega, entregas) siguen en tiempo real.
      const products = firestore().collection('products');
      const users = firestore().collection('users');

      // startOfDay se calcula acá dentro para que refresh() reevalúe el corte:
      // antes quedaba congelado al montar y "ventas de hoy" se volvía obsoleto
      // pasada la medianoche sin que nadie lo notara.
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const aggregates = [
        ['products', () => Promise.all([
          products.count().get(),
          products.where('stock', '<', 5).count().get(),
        ]).then(([all, low]) => ({
          products: all.data().count,
          lowStock: low.data().count,
        }))],

        ['users', () => Promise.all([
          users.count().get(),
          users.where('verified', '==', true).count().get(),
        ]).then(([all, verified]) => ({
          users: all.data().count,
          verifiedUsers: verified.data().count,
        }))],

        ['salesToday', () => getAggregateFromServer(
          firestore().collection('sales').where('createdAt', '>=', startOfDay),
          { value: sum('total') },
        ).then((snap) => ({ salesTodayTotal: snap.data().value || 0 }))],

        ['activeDeliveries', () => firestore()
          .collection('presales')
          .where('status', 'in', ACTIVE_DELIVERY_STATUSES)
          .count()
          .get()
          .then((snap) => ({ activeDeliveries: snap.data().count }))],

        ['pendingCredits', () => getAggregateFromServer(
          firestore().collection('credits').where('status', 'in', ['pending', 'credit_pending']),
          { value: sum('pending') },
        ).then((snap) => ({ pendingCreditsAmount: snap.data().value || 0 }))],
      ];

      aggregates.forEach(([key, run]) => {
        run()
          .then((patch) => {
            if (mountedRef.current) setStats((prev) => ({ ...prev, ...patch }));
          })
          .catch((error) => {
            console.error(`[useDashboardStats] ${key}:`, error);
          })
          .finally(() => {
            if (mountedRef.current) markLoaded(key);
          });
      });
    }

    if (role === 'entregador') {
      const userId = user?.uid;
      if (!userId) {
        setStats((prev) => ({ ...prev, assignedDeliveries: 0, totalToCollect: 0 }));
        markLoaded('deliveries');
      } else {
        const unsubDeliveries = firestore()
          .collection('presales')
          .where('status', '==', 'dispatched')
          .where('entregadorId', '==', userId)
          .onSnapshot((snap) => {
            let total = 0;
            snap.docs.forEach((doc) => {
              total += Number(doc.data()?.total || 0);
            });
            setStats((prev) => ({
              ...prev,
              assignedDeliveries: snap.size,
              totalToCollect: total,
            }));
            markLoaded('deliveries');
          });
        unsubs.push(unsubDeliveries);
      }
    }

    // Roles sin tarjetas: cerrar también `refreshing`, si no un pull-to-refresh
    // dejaría el indicador girando indefinidamente.
    if (role !== 'admin' && role !== 'entregador') {
      setLoading(false);
      setRefreshing(false);
      firstLoadRef.current = false;
    }

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [role, user?.uid, refreshKey]);

  return { stats, loading, refreshing, refresh };
};
