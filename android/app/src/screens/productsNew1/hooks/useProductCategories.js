import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createOrActivateCategory,
  deactivateCategory,
  subscribeActiveCategories,
} from '../services/productCategoriesService';
import { normalizeCategory } from '../constants/productCategories';

export function useProductCategories() {
  const [categoryRows, setCategoryRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeActiveCategories((rows) => {
      setCategoryRows(Array.isArray(rows) ? rows : []);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const categories = useMemo(() => {
    return categoryRows
      .map((item) => normalizeCategory(item?.name))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [categoryRows]);

  const addCategory = useCallback(async (name) => {
    const normalized = normalizeCategory(name);
    if (!normalized) throw new Error('Ingresa un nombre de categoria valido');
    await createOrActivateCategory(normalized);
  }, []);

  const removeCategory = useCallback(async (categoryId) => {
    await deactivateCategory(categoryId);
  }, []);

  return {
    categoryRows,
    categories,
    loading,
    addCategory,
    removeCategory,
  };
}

export default useProductCategories;

