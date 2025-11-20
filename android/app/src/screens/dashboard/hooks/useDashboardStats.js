import { useEffect, useState } from 'react';
import { firestore } from '../../../services/firebaseConfig';

export const useDashboardStats = () => {
  const [stats, setStats] = useState({
    products: 0,
    lowStock: 0,
    users: 0,
    verifiedUsers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubProducts = firestore()
      .collection('products')
      .onSnapshot((snap) => {
        const data = snap.docs.map((d) => d.data());
        const low = data.filter((p) => (p.stock || 0) < 5).length;
        setStats((prev) => ({ ...prev, products: data.length, lowStock: low }));
      });

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
        setLoading(false);
      });

    return () => {
      unsubProducts();
      unsubUsers();
    };
  }, []);

  return { stats, loading };
};
