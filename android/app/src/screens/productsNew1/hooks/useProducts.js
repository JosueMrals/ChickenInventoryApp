import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { db } from '../../../services/firebase';
import { DEFAULT_CATEGORY_LABEL, normalizeCategory } from '../constants/productCategories';

/**
 * useProducts
 * - Suscribe en tiempo real a /products ordenado por name
 * - Provee filtrado local por name (parcial, case-insensitive)
 * - getProductByBarcode busca 1 producto exacto por barcode y devuelve el objeto o null
 */
export function useProducts({ pageSize = 200 } = {}) {
  const [rawProducts, setRawProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const mountedRef = useRef(true);

  // Debounce solo para el filtrado: el input se actualiza al instante.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mountedRef.current) setDebouncedQuery(query);
    }, 120);
    return () => clearTimeout(timer);
  }, [query]);

  const clearQuery = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
  }, []);

  const clearFilters = useCallback(() => {
    clearQuery();
    setCategoryFilter('all');
  }, [clearQuery]);

  // suscripción en tiempo real
  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);

    const coll = db.collection('products').orderBy('name').limit(pageSize);
    const unsubscribe = coll.onSnapshot(
      snapshot => {
        if (!mountedRef.current) return;
        const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setRawProducts(items);
        setLoading(false);
      },
      error => {
        console.error('useProducts onSnapshot error:', error);
        if (mountedRef.current) setLoading(false);
      }
    );

    return () => {
      mountedRef.current = false;
      if (unsubscribe) unsubscribe();
    };
  }, [pageSize]);

  const indexedProducts = useMemo(() => {
    return rawProducts.map((p) => {
      const name = (p?.name || '').toString();
      const barcode = (p?.barcode || '').toString();
      const category = normalizeCategory(p?.category) || DEFAULT_CATEGORY_LABEL;
      return {
        ...p,
        _nameLower: name.toLowerCase(),
        _barcodeLower: barcode.toLowerCase(),
        _categoryNorm: category,
      };
    });
  }, [rawProducts]);

  const categories = useMemo(() => {
    const uniques = new Set();
    indexedProducts.forEach((p) => {
      if (p._categoryNorm && p._categoryNorm !== DEFAULT_CATEGORY_LABEL) {
        uniques.add(p._categoryNorm);
      }
    });
    return Array.from(uniques).sort((a, b) => a.localeCompare(b));
  }, [indexedProducts]);

  // filtered products (client-side)
  const products = useMemo(() => {
    const baseList = categoryFilter === 'all'
      ? indexedProducts
      : indexedProducts.filter((p) => p._categoryNorm === categoryFilter);

    if (!debouncedQuery || debouncedQuery.trim() === '') return baseList;

    const q = debouncedQuery.trim().toLowerCase();
    const exactBarcodeMatches = baseList.filter((p) => p._barcodeLower === q);
    if (exactBarcodeMatches.length > 0) return exactBarcodeMatches;

    return baseList.filter((p) => p._nameLower.includes(q) || p._barcodeLower.includes(q));
  }, [indexedProducts, debouncedQuery, categoryFilter]);

  // get single product by barcode (returns object or null)
  const getProductByBarcode = useCallback(async (term) => {
    if (!term) return null;
    try {
      const snap = await db.collection('products').where('barcode', '==', term).limit(1).get();
      if (snap.empty) return null;
      const doc = snap.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (err) {
      console.error('getProductByBarcode error:', err);
      return null;
    }
  }, []);

  // manual refresh: re-lee la collection una vez (no reemplaza la suscripción)
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const snap = await db.collection('products').orderBy('name').limit(pageSize).get();
      if (mountedRef.current) setRawProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('useProducts refresh error:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [pageSize]);

  return {
    products,
    rawProducts,
    loading,
    setQuery,
    clearQuery,
    query,
    categories,
    categoryFilter,
    setCategoryFilter,
    clearFilters,
    getProductByBarcode, // devuelve single product o null
    refresh,
  };
}
