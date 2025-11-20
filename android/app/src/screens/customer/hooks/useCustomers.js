import { useEffect, useState, useCallback, useRef } from 'react';
import * as customersService from '../services/customerService';

export function useCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const unsubRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    console.log('[useCustomers] mounting - subscribing');

    const unsub = customersService.fetchCustomers((list) => {
      console.log('[useCustomers] fetched list length:', (list && list.length) || 0);
      setCustomers(list || []);
      setLoading(false);
    });

    unsubRef.current = unsub;

    return () => {
      console.log('[useCustomers] unmount - unsubscribing');
      if (typeof unsubRef.current === 'function') unsubRef.current();
    };
  }, []);

  const create = useCallback(async (data) => {
    return customersService.createCustomer(data);
  }, []);

  const update = useCallback(async (id, data) => {
    return customersService.updateCustomer(id, data);
  }, []);

  const remove = useCallback(async (id) => {
    return customersService.deleteCustomer(id);
  }, []);

  return {
    customers,
    loading,
    error,
    create,
    update,
    remove,
    setCustomers,
  };
}
