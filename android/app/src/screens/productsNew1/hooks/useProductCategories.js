import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createOrActivateCategory,
  deleteCategory,
  setCategoryActive,
  subscribeCategories,
  subscribeActiveCategories,
  updateCategory,
} from '../services/productCategoriesService';
import { normalizeCategory } from '../constants/productCategories';

export function useProductCategories(options = {}) {
  const activeOnly = options.activeOnly !== false;

  const [categoryRows, setCategoryRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const subscribeFn = activeOnly ? subscribeActiveCategories : subscribeCategories;
    const unsubscribe = subscribeFn((rows) => {
      setCategoryRows(Array.isArray(rows) ? rows : []);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [activeOnly]);

  const categories = useMemo(() => {
    return categoryRows
      .map((item) => normalizeCategory(item?.name))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [categoryRows]);

  const addCategory = useCallback(
    async (name, optionsArg = {}) => {
      const normalized = normalizeCategory(name);
      if (!normalized) throw new Error('Ingresa un nombre de categoria valido');
      await createOrActivateCategory(normalized, optionsArg);
    },
    []
  );

  const saveCategory = useCallback(
    async ({ id, name, activationRules = [] }) => {
      const normalized = normalizeCategory(name);
      if (!normalized) throw new Error('Ingresa un nombre de categoria valido');

      if (id) {
        await updateCategory(id, { name: normalized, activationRules });
        return;
      }

      await createOrActivateCategory(normalized, { activationRules });
    },
    []
  );

  const removeCategory = useCallback(async (categoryId) => {
    await setCategoryActive(categoryId, false);
  }, []);

  const activateCategory = useCallback(async (categoryId) => {
    await setCategoryActive(categoryId, true);
  }, []);

  const hardDeleteCategory = useCallback(async (categoryId) => {
    await deleteCategory(categoryId);
  }, []);

  return {
    categoryRows,
    categories,
    loading,
    addCategory,
    saveCategory,
    removeCategory,
    activateCategory,
    hardDeleteCategory,
  };
}

export default useProductCategories;
