import { useEffect, useState } from 'react';
import * as salesService from '../../sales/services/saleService';
import { startOfToday, startOfWeek, startOfMonth } from '../../utils/dateHelpers';

export function useSalesHistory(customerId) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'today' | 'week' | 'month' | 'all'

  useEffect(() => {
    if (!customerId) {
      setSales([]);
      setLoading(false);
      return;
    }

    let unsub;
    try {
      unsub = salesService.fetchSalesByCustomer(customerId, (list) => {
        setSales(list || []);
        setLoading(false);
      });
    } catch (e) {
      setSales([]);
      setLoading(false);
    }

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [customerId]);

  const filtered = sales.filter((s) => {
    if (!s.date) return true;
    const d = new Date(s.date);
    if (filter === 'all') return true;
    if (filter === 'today') return d >= startOfToday();
    if (filter === 'week') return d >= startOfWeek();
    if (filter === 'month') return d >= startOfMonth();
    return true;
  });

  return { sales, filtered, loading, filter, setFilter };
}
