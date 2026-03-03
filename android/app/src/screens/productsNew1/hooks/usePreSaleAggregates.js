import { useEffect, useMemo, useState } from 'react';
import firestore from '@react-native-firebase/firestore';

const PRE_SOLD_STATUSES = [
  'pending',
  'preparing',
  'ready_for_delivery',
  'credit_pending',
  'credit_preparing',
  'credit_ready_for_delivery',
];

const DISPATCHED_STATUS = 'dispatched';

const mergeItemArrays = (sale) => {
  const items = Array.isArray(sale?.items) ? sale.items : [];
  const bonuses = Array.isArray(sale?.bonuses)
    ? sale.bonuses.map((b) => ({ ...b, isBonus: true }))
    : [];
  return items.concat(bonuses);
};

const aggregateItems = (preSales) => {
  const totals = new Map();

  preSales.forEach((sale) => {
    mergeItemArrays(sale).forEach((item) => {
      const productId = item.productId || item.id || item.product?.id || item.productName || item.name;
      if (!productId) return;
      const name = item.productName || item.name || item.product?.name || 'Producto';
      const qty = Number(item.quantity) || 0;
      if (!qty) return;

      const current = totals.get(productId) || { productId, name, qty: 0 };
      current.qty += qty;
      totals.set(productId, current);
    });
  });

  return Array.from(totals.values()).sort((a, b) => b.qty - a.qty);
};

const aggregateByDeliverer = (preSales, delivererMap) => {
  const grouped = new Map();

  preSales.forEach((sale) => {
    const entregadorId = sale?.entregadorId || 'sin_asignar';
    const bucket = grouped.get(entregadorId) || {
      entregadorId,
      entregadorName: delivererMap[entregadorId] || entregadorId,
      itemsMap: new Map(),
      totalQty: 0,
    };

    mergeItemArrays(sale).forEach((item) => {
      const productId = item.productId || item.id || item.product?.id || item.productName || item.name;
      if (!productId) return;
      const name = item.productName || item.name || item.product?.name || 'Producto';
      const qty = Number(item.quantity) || 0;
      if (!qty) return;

      const existing = bucket.itemsMap.get(productId) || { productId, name, qty: 0 };
      existing.qty += qty;
      bucket.itemsMap.set(productId, existing);
      bucket.totalQty += qty;
    });

    grouped.set(entregadorId, bucket);
  });

  return Array.from(grouped.values())
    .map((entry) => ({
      entregadorId: entry.entregadorId,
      entregadorName: entry.entregadorName,
      totalQty: entry.totalQty,
      items: Array.from(entry.itemsMap.values()).sort((a, b) => b.qty - a.qty),
    }))
    .sort((a, b) => b.totalQty - a.totalQty);
};

const chunk = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

export function usePreSaleAggregates({ routeId } = {}) {
  const [preSoldRaw, setPreSoldRaw] = useState([]);
  const [dispatchedRaw, setDispatchedRaw] = useState([]);
  const [delivererMap, setDelivererMap] = useState({});
  const [loadingPreSold, setLoadingPreSold] = useState(true);
  const [loadingDispatched, setLoadingDispatched] = useState(true);

  useEffect(() => {
    let preSoldUnsub;
    let dispatchUnsub;

    const presalesRef = firestore().collection('presales');

    let preSoldQuery = presalesRef.where('status', 'in', PRE_SOLD_STATUSES);
    if (routeId) preSoldQuery = preSoldQuery.where('routeId', '==', routeId);

    preSoldUnsub = preSoldQuery.onSnapshot(
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setPreSoldRaw(items);
        setLoadingPreSold(false);
      },
      (error) => {
        console.error('preSold presales snapshot error:', error);
        setPreSoldRaw([]);
        setLoadingPreSold(false);
      }
    );

    let dispatchQuery = presalesRef.where('status', '==', DISPATCHED_STATUS);
    if (routeId) dispatchQuery = dispatchQuery.where('routeId', '==', routeId);

    dispatchUnsub = dispatchQuery.onSnapshot(
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setDispatchedRaw(items);
        setLoadingDispatched(false);
      },
      (error) => {
        console.error('dispatched presales snapshot error:', error);
        setDispatchedRaw([]);
        setLoadingDispatched(false);
      }
    );

    return () => {
      if (preSoldUnsub) preSoldUnsub();
      if (dispatchUnsub) dispatchUnsub();
    };
  }, [routeId]);

  const delivererIds = useMemo(() => {
    const ids = dispatchedRaw
      .map((sale) => sale.entregadorId)
      .filter((id) => !!id);
    return Array.from(new Set(ids));
  }, [dispatchedRaw]);

  useEffect(() => {
    let active = true;

    const loadUsers = async () => {
      if (!delivererIds.length) {
        if (active) setDelivererMap({});
        return;
      }

      const usersRef = firestore().collection('users');
      const result = {};

      try {
        const chunks = chunk(delivererIds, 10);
        for (const ids of chunks) {
          const snap = await usersRef.where(firestore.FieldPath.documentId(), 'in', ids).get();
          snap.docs.forEach((doc) => {
            const data = doc.data() || {};
            result[doc.id] = data.displayName || data.name || data.email || doc.id;
          });
        }
      } catch (error) {
        console.error('load deliverer users error:', error);
      }

      if (active) setDelivererMap(result);
    };

    loadUsers();

    return () => {
      active = false;
    };
  }, [delivererIds.join('|')]);

  const preSold = useMemo(() => aggregateItems(preSoldRaw), [preSoldRaw]);
  const delivererAssignments = useMemo(
    () => aggregateByDeliverer(dispatchedRaw, delivererMap),
    [dispatchedRaw, delivererMap]
  );

  return {
    preSold,
    delivererAssignments,
    loading: loadingPreSold || loadingDispatched,
  };
}

