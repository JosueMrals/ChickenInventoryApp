import { useCallback, useEffect, useState } from 'react';
import {
  createSupplier,
  updateSupplier,
  deleteSupplier,
  subscribeSuppliers,
} from '../services/supplierService';

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeSuppliers((rows) => {
      setSuppliers(rows);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const saveSupplier = useCallback(async ({ id, ...input }) => {
    if (id) {
      await updateSupplier(id, input);
      return id;
    }
    return createSupplier(input);
  }, []);

  const removeSupplier = useCallback(async (id) => {
    await deleteSupplier(id);
  }, []);

  return { suppliers, loading, saveSupplier, removeSupplier };
}

export default useSuppliers;
