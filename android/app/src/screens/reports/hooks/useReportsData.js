import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  getSalesSummaryOptimized,
  getSalesPage,
  subscribeUsersActivity,
  getSalesByUserInRange,
} from '../services/reportsService';

/**
 * Resumen del período para el panel Resumen y los KPIs del panel de Ventas.
 *
 * `refreshKey` fuerza una relectura aunque el rango no cambie: la pantalla lo
 * incrementa en el pull-to-refresh, después de vaciar las cachés del servicio.
 */
export const useReportsData = (dateFrom, dateTo, refreshKey = 0) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  // Evita repetir la consulta cuando el rango no cambió.
  const lastRangeRef = useRef(null);

  useEffect(() => {
    const rangeKey = `${dateFrom?.getTime?.() ?? null}_${dateTo?.getTime?.() ?? null}_${refreshKey}`;
    if (lastRangeRef.current === rangeKey) return;
    lastRangeRef.current = rangeKey;

    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const salesData = await getSalesSummaryOptimized({ from: dateFrom, to: dateTo });
        if (!mounted) return;
        // El servicio devuelve null si la consulta falló.
        if (salesData === null) setError('No se pudo calcular el resumen del período.');
        setSummary(salesData);
      } catch (e) {
        // Sin este catch, un fallo dejaba `loading` en true para siempre y la
        // pestaña se quedaba en "Calculando resumen…" sin datos ni mensaje.
        console.error('[useReportsData]', e);
        if (mounted) {
          setError(e?.message || 'No se pudo cargar el resumen.');
          setSummary(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, [dateFrom, dateTo, refreshKey]);

  return { summary, loading, error };
};

/** Hook para monitoreo de usuarios en tiempo real + ventas en rango */
export const useUsersMonitor = (dateFrom, dateTo, refreshKey = 0) => {
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
    const key = `${dateFrom?.getTime?.() ?? ''}_${dateTo?.getTime?.() ?? ''}_${refreshKey}`;
    if (lastRangeRef.current === key) return;
    lastRangeRef.current = key;

    let mounted = true;
    getSalesByUserInRange({ from: dateFrom, to: dateTo })
      .then((map) => { if (mounted) setSalesByUser(map); })
      .catch((e) => {
        console.error('[useUsersMonitor]', e);
        if (mounted) setSalesByUser({});
      });
    return () => { mounted = false; };
  }, [dateFrom, dateTo, refreshKey]);

  // Fusionar usuarios con sus ventas. useMemo: el panel re-renderiza con cada
  // cambio del listener de usuarios, y esto reconstruía y reordenaba la lista
  // completa en cada uno.
  const usersWithStats = useMemo(
    () => users
      .map((u) => {
        const key   = u.email || u.uid;
        const stats = salesByUser[key] || {};
        return {
          ...u,
          salesTotal: stats.total  || 0,
          salesCount: stats.count  || 0,
          lastSale:   stats.lastSale || null,
        };
      })
      .sort((a, b) => b.salesTotal - a.salesTotal),
    [users, salesByUser],
  );

  return { usersWithStats, loadingUsers };
};

/**
 * Hook dedicado para el panel de ventas.
 * Usa getSalesPage (solo sales + presales) para evitar que fallos en otras
 * colecciones (inventoryMovements, financials) oculten las ventas.
 */
export const useSalesData = (dateFrom, dateTo, refreshKey = 0) => {
  const [sales, setSales]         = useState([]);
  const [cursors, setCursors]     = useState({});
  const [hasMore, setHasMore]     = useState(true);
  const [loading, setLoading]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]         = useState(null);
  const lastRangeRef = useRef(null);

  useEffect(() => {
    const rangeKey = `${dateFrom?.getTime?.() ?? null}_${dateTo?.getTime?.() ?? null}_${refreshKey}`;
    if (lastRangeRef.current === rangeKey) return;
    lastRangeRef.current = rangeKey;

    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      setSales([]);
      setCursors({});
      setHasMore(true);

      try {
        const result = await getSalesPage({ from: dateFrom, to: dateTo, limit: 20 });
        if (!mounted) return;
        setSales(result.items);
        setCursors(result.cursors);
        setHasMore(result.items.length >= 20);
      } catch (e) {
        console.error('[useSalesData]', e);
        if (mounted) setError(e?.message || 'No se pudieron cargar las ventas.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, [dateFrom, dateTo, refreshKey]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const result = await getSalesPage({ from: dateFrom, to: dateTo, cursors, limit: 20 });
      if (result.items.length > 0) {
        setSales((prev) => [...prev, ...result.items]);
        setCursors(result.cursors);
        setHasMore(result.items.length >= 20);
      } else {
        setHasMore(false);
      }
    } catch (e) {
      // Sin el finally, un fallo dejaba `loadingMore` en true y la lista ya no
      // volvía a pedir página: el scroll infinito se quedaba muerto.
      console.error('[useSalesData.loadMore]', e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, dateFrom, dateTo, cursors]);

  return { sales, loading, loadingMore, loadMore, hasMore, error };
};
