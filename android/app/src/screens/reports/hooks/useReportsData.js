import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getSalesSummaryOptimized,
  getActivityFeedPage,
  subscribeUsersActivity,
  getSalesByUserInRange,
} from '../services/reportsService';

export const useReportsData = (dateFrom, dateTo) => {
  const [summary, setSummary]         = useState(null);
  const [operations, setOperations]   = useState([]);
  const [cursors, setCursors]         = useState({});
  const [hasMore, setHasMore]         = useState(true);
  const [loading, setLoading]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Ref para evitar re-fetch cuando las fechas son las mismas
  const lastRangeRef = useRef(null);

  useEffect(() => {
    const fromKey = dateFrom?.getTime?.() ?? null;
    const toKey   = dateTo?.getTime?.()   ?? null;
    const rangeKey = `${fromKey}_${toKey}`;

    // Si ya cargamos este rango y hay datos, no volvemos a hacer la query
    if (lastRangeRef.current === rangeKey && summary !== null) return;
    lastRangeRef.current = rangeKey;

    const load = async () => {
      setLoading(true);
      setOperations([]);
      setCursors({});
      setHasMore(true);

      const [salesData, activityData] = await Promise.all([
        getSalesSummaryOptimized({ from: dateFrom, to: dateTo }),
        getActivityFeedPage({ from: dateFrom, to: dateTo, limit: 10 }),
      ]);

      setSummary(salesData);

      if (activityData.items.length > 0) {
        setOperations(activityData.items);
        setCursors(activityData.cursors);
      } else {
        setOperations([]);
        setHasMore(false);
      }

      setLoading(false);
    };

    load();
  }, [dateFrom, dateTo]);

  const loadMoreOperations = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const activityData = await getActivityFeedPage({ from: dateFrom, to: dateTo, cursors, limit: 10 });
    if (activityData.items.length > 0) {
      setOperations((prev) => [...prev, ...activityData.items]);
      setCursors(activityData.cursors);
    } else {
      setHasMore(false);
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, dateFrom, dateTo, cursors]);

  return { summary, operations, loading, loadingMore, loadMoreOperations, hasMore };
};

/** Hook para monitoreo de usuarios en tiempo real + ventas en rango */
export const useUsersMonitor = (dateFrom, dateTo) => {
  const [users, setUsers]             = useState([]);
  const [salesByUser, setSalesByUser] = useState({});
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Suscripción en tiempo real a usuarios (solo una vez)
  useEffect(() => {
    const unsub = subscribeUsersActivity((list) => {
      setUsers(list);
      setLoadingUsers(false);
    });
    return () => unsub();
  }, []);

  // Ventas por usuario — respeta la caché del servicio
  const lastRangeRef = useRef(null);
  useEffect(() => {
    const key = `${dateFrom?.getTime?.() ?? ''}_${dateTo?.getTime?.() ?? ''}`;
    if (lastRangeRef.current === key) return;
    lastRangeRef.current = key;
    getSalesByUserInRange({ from: dateFrom, to: dateTo }).then(setSalesByUser);
  }, [dateFrom, dateTo]);

  // Fusionar usuarios con sus ventas
  const usersWithStats = users.map((u) => {
    const key   = u.email || u.uid;
    const stats = salesByUser[key] || {};
    return {
      ...u,
      salesTotal: stats.total  || 0,
      salesCount: stats.count  || 0,
      lastSale:   stats.lastSale || null,
    };
  }).sort((a, b) => b.salesTotal - a.salesTotal);

  return { usersWithStats, loadingUsers };
};
