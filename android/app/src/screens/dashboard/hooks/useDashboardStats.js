import { useEffect, useState } from 'react';
import { firestore } from '../../../services/firebaseConfig';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadingState = {
      products: role === 'admin',
      users: role === 'admin',
      salesToday: role === 'admin',
      activeDeliveries: role === 'admin',
      pendingCredits: role === 'admin',
      deliveries: role === 'entregador',
    };

    const markLoaded = (key) => {
      loadingState[key] = false;
      const pending = Object.values(loadingState).some(Boolean);
      if (!pending) setLoading(false);
    };

    const unsubs = [];

    if (role === 'admin') {
      const unsubProducts = firestore()
        .collection('products')
        .onSnapshot((snap) => {
          const data = snap.docs.map((d) => d.data());
          const low = data.filter((p) => (p.stock || 0) < 5).length;
          setStats((prev) => ({ ...prev, products: data.length, lowStock: low }));
          markLoaded('products');
        });
      unsubs.push(unsubProducts);

      const unsubUsers = firestore()
        .collection('users')
        .onSnapshot((snap) => {
          const data = snap.docs.map((d) => d.data());
          const verified = data.filter((u) => u.verified).length;
          setStats((prev) => ({
            ...prev,
            users: data.length,
            verifiedUsers: verified,
          }));
          markLoaded('users');
        });
      unsubs.push(unsubUsers);

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const unsubSalesToday = firestore()
        .collection('sales')
        .where('createdAt', '>=', startOfDay)
        .onSnapshot(
          (snap) => {
            let total = 0;
            snap.docs.forEach((doc) => {
              total += Number(doc.data()?.total || 0);
            });
            setStats((prev) => ({ ...prev, salesTodayTotal: total }));
            markLoaded('salesToday');
          },
          () => {
            markLoaded('salesToday');
          }
        );
      unsubs.push(unsubSalesToday);

      const activeStatuses = new Set(['dispatched', 'credit_dispatched', 'ready_for_delivery', 'credit_ready_for_delivery']);
      const unsubActiveDeliveries = firestore()
        .collection('presales')
        .onSnapshot(
          (snap) => {
            let active = 0;
            snap.docs.forEach((doc) => {
              const status = doc.data()?.status;
              if (activeStatuses.has(status)) active += 1;
            });
            setStats((prev) => ({ ...prev, activeDeliveries: active }));
            markLoaded('activeDeliveries');
          },
          () => {
            markLoaded('activeDeliveries');
          }
        );
      unsubs.push(unsubActiveDeliveries);

      const unsubCredits = firestore()
        .collection('credits')
        .onSnapshot(
          (snap) => {
            let pendingTotal = 0;
            snap.docs.forEach((doc) => {
              const data = doc.data() || {};
              if (data.status === 'pending' || data.status === 'credit_pending') {
                pendingTotal += Number(data.pending || 0);
              }
            });
            setStats((prev) => ({ ...prev, pendingCreditsAmount: pendingTotal }));
            markLoaded('pendingCredits');
          },
          () => {
            markLoaded('pendingCredits');
          }
        );
      unsubs.push(unsubCredits);
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

    if (role !== 'admin' && role !== 'entregador') {
      setLoading(false);
    }

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [role, user?.uid]);

  return { stats, loading };
};
