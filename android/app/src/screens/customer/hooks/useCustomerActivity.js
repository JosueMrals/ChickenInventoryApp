// Actividad completa de un cliente en tiempo real: compras (ventas rápidas +
// preventas concretadas) y sus créditos, para la vista de detalle del cliente.
import { useEffect, useMemo, useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import { toDateSafe } from '../../../utils/creditUtils';

// Preventas que cuentan como compra concretada (mismo criterio que reportes).
// Array y no Set: se pasa directo al `where(..., 'in', ...)` del query.
const COMPLETED_PRESALE_STATUSES = [
  'paid',
  'delivered',
  'partially_returned',
  'returned',
  'credit_pending',
  'credit_preparing',
  'credit_ready_for_delivery',
  'credit_dispatched',
  'dispatched',
];

// La ficha del cliente muestra su actividad reciente, no su historia completa.
const MAX_ROWS = 100;

export function useCustomerActivity(customerId) {
  const [sales, setSales] = useState([]);
  const [presales, setPresales] = useState([]);
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) {
      setSales([]); setPresales([]); setCredits([]); setLoading(false);
      return undefined;
    }

    let pendingLoads = 3;
    const markLoaded = () => { pendingLoads -= 1; if (pendingLoads <= 0) setLoading(false); };

    const onError = (label) => (error) => {
      console.error(`[useCustomerActivity] Error en ${label}:`, error);
      markLoaded();
    };

    const unsubSales = firestore()
      .collection('sales')
      .where('customerId', '==', customerId)
      .orderBy('createdAt', 'desc')
      .limit(MAX_ROWS)
      .onSnapshot((snap) => {
        setSales(snap ? snap.docs.map((d) => ({ id: d.id, ...d.data(), __source: 'sale' })) : []);
        markLoaded();
      }, onError('sales'));

    // El status va en el query. Antes se traían TODAS las preventas del cliente
    // (incluidas canceladas y en preparación) para descartarlas en JS acto seguido.
    const unsubPresales = firestore()
      .collection('presales')
      .where('customerId', '==', customerId)
      .where('status', 'in', COMPLETED_PRESALE_STATUSES)
      .orderBy('createdAt', 'desc')
      .limit(MAX_ROWS)
      .onSnapshot((snap) => {
        setPresales(snap ? snap.docs.map((d) => ({ id: d.id, ...d.data(), __source: 'presale' })) : []);
        markLoaded();
      }, onError('presales'));

    const unsubCredits = firestore()
      .collection('credits')
      .where('customerId', '==', customerId)
      .orderBy('createdAt', 'desc')
      .limit(MAX_ROWS)
      .onSnapshot((snap) => {
        setCredits(snap ? snap.docs.map((d) => ({ id: d.id, ...d.data() })) : []);
        markLoaded();
      }, onError('credits'));

    return () => { unsubSales(); unsubPresales(); unsubCredits(); };
  }, [customerId]);

  const purchases = useMemo(() => {
    const merged = [...sales, ...presales].map((p) => ({
      ...p,
      __date: toDateSafe(p.createdAt) || new Date(0),
    }));
    merged.sort((a, b) => b.__date - a.__date);
    return merged;
  }, [sales, presales]);

  return { purchases, credits, loading };
}
