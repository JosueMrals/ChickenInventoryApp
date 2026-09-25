import { useEffect, useMemo, useState } from 'react';
import { subscribeMyOpenTurno, subscribeMyUnclaimedCollections, sumCollections } from '../services/cashClosingService';
import { subscribeMyEligibleCashExpenses } from '../../expenses/services/expenseService';

/**
 * El turno abierto del usuario, lo cobrado sin reclamar y los gastos CASH
 * todavía sin liquidar (FASE E3) — todo en vivo. `netAmount` es solo para
 * mostrar en pantalla antes de cerrar: el `expectedAmount` real siempre se
 * recalcula dentro de la transacción de closeTurno(), nunca se confía en este
 * valor del cliente.
 */
export const useMyTurno = (uid) => {
  const [turno, setTurno] = useState(null);
  const [collections, setCollections] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [ready, setReady] = useState({ turno: false, collections: false, expenses: false });

  useEffect(() => {
    if (!uid) return undefined;
    const done = (key) => setReady((prev) => (prev[key] ? prev : { ...prev, [key]: true }));

    const unsubTurno = subscribeMyOpenTurno(uid, (t) => { setTurno(t); done('turno'); });
    const unsubCollections = subscribeMyUnclaimedCollections(uid, (list) => { setCollections(list); done('collections'); });
    const unsubExpenses = subscribeMyEligibleCashExpenses(uid, (list) => { setExpenses(list); done('expenses'); });

    return () => { unsubTurno(); unsubCollections(); unsubExpenses(); };
  }, [uid]);

  const total = useMemo(() => sumCollections(collections), [collections]);
  const cashExpensesTotal = useMemo(() => sumCollections(expenses), [expenses]);
  const netAmount = useMemo(() => Number((total - cashExpensesTotal).toFixed(2)), [total, cashExpensesTotal]);
  const loading = !uid || !ready.turno || !ready.collections || !ready.expenses;

  return { turno, collections, expenses, total, cashExpensesTotal, netAmount, loading };
};
