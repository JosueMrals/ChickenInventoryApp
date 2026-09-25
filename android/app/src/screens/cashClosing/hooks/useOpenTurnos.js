import { useEffect, useMemo, useState } from 'react';
import {
  subscribeOpenTurnos, subscribeAllUnclaimedCollections, groupAmountsByUid,
} from '../services/cashClosingService';
import { subscribeAllEligibleCashExpenses } from '../../expenses/services/expenseService';

const VACIO = { ids: [], total: 0 };

/**
 * Turnos con caja abierta ahora mismo, cada uno con su monto en vivo. El admin
 * los ve en todo momento para saber cuánto lleva cada trabajador y poder
 * cerrarle el turno.
 *
 * Tres suscripciones en total, no dos por trabajador: los cobros y los gastos
 * se traen completos (sin filtrar por dueño) y se reparten por uid en cliente
 * con groupAmountsByUid. Los `ids` que salen de ahí son los que reclamaría el
 * cierre — closeTurno los relee dentro de la transacción de todas formas, así
 * que esta lista nunca es la fuente de verdad final.
 */
export const useOpenTurnos = (enabled = true) => {
  const [turnos, setTurnos] = useState([]);
  const [collections, setCollections] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) { setTurnos([]); setLoading(false); return undefined; }
    const unsubTurnos = subscribeOpenTurnos((list) => { setTurnos(list); setLoading(false); });
    const unsubCollections = subscribeAllUnclaimedCollections(setCollections);
    const unsubExpenses = subscribeAllEligibleCashExpenses(setExpenses);
    return () => { unsubTurnos(); unsubCollections(); unsubExpenses(); };
  }, [enabled]);

  const conMontos = useMemo(() => {
    const ingresos = groupAmountsByUid(collections, 'uid');
    const egresos = groupAmountsByUid(expenses, 'createdByUid');
    return turnos.map((turno) => {
      const cobros = ingresos[turno.uid] || VACIO;
      const gastos = egresos[turno.uid] || VACIO;
      return {
        ...turno,
        ingresos: cobros.total,
        egresos: gastos.total,
        neto: Number((cobros.total - gastos.total).toFixed(2)),
        collectionIds: cobros.ids,
        expenseIds: gastos.ids,
      };
    });
  }, [turnos, collections, expenses]);

  return { turnos: conMontos, loading };
};
