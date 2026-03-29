import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { db } from '../../../services/firebase';
import { DEFAULT_CATEGORY_LABEL, normalizeCategory } from '../constants/productCategories';
import { searchProductsByBarcodeOrName, subscribeProducts } from '../services/productsService';

const SEARCH_PAGE_SIZE = 250;

function mergeUniqueById(primary = [], secondary = []) {
  const seen = new Set();
  const merged = [];

  [...primary, ...secondary].forEach((item) => {
    if (!item?.id || seen.has(item.id)) return;
    seen.add(item.id);
    merged.push(item);
  });

  return merged;
}

/**
 * useProducts
 * - Carga inicial paginada de /products
 * - Soporta carga incremental para scroll en gran escala
 * - Busqueda remota global por nombre/codigo para no depender del primer lote
 */
export function useProducts({ pageSize = 100 } = {}) {
  const [rawProducts, setRawProducts] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [liveLimit, setLiveLimit] = useState(pageSize);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const mountedRef = useRef(true);

  const normalizedQuery = debouncedQuery.trim().toLowerCase();
  const isSearchMode = normalizedQuery.length > 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (mountedRef.current) setDebouncedQuery(query);
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || isSearchMode || !hasMore) return;
    setLoadingMore(true);
    setLiveLimit((prev) => prev + pageSize);
  }, [hasMore, isSearchMode, loading, loadingMore, pageSize]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isSearchMode) return undefined;

    setLoading(true);
    const unsubscribe = subscribeProducts(
      (items = [], err) => {
        if (!mountedRef.current) return;
        if (err) {
          console.error('useProducts realtime subscription error:', err);
          setRawProducts([]);
          setHasMore(false);
          setLoading(false);
          setLoadingMore(false);
          return;
        }

        setRawProducts(Array.isArray(items) ? items : []);
        setHasMore(Array.isArray(items) ? items.length >= liveLimit : false);
        setLoading(false);
        setLoadingMore(false);
      },
      {
        orderBy: 'name',
        limit: liveLimit,
      },
    );

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [isSearchMode, liveLimit]);

  useEffect(() => {
    let cancelled = false;

    if (!isSearchMode) {
      setSearchResults([]);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    (async () => {
      try {
        const remote = await searchProductsByBarcodeOrName(normalizedQuery, SEARCH_PAGE_SIZE);
        if (!mountedRef.current || cancelled) return;
        setSearchResults(Array.isArray(remote) ? remote : []);
      } catch (err) {
        console.error('useProducts search error:', err);
        if (!mountedRef.current || cancelled) return;
        setSearchResults([]);
      } finally {
        if (mountedRef.current && !cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSearchMode, normalizedQuery]);

  const clearQuery = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setSearchResults([]);
  }, []);

  const clearFilters = useCallback(() => {
    clearQuery();
    setCategoryFilter('all');
  }, [clearQuery]);

  const sourceProducts = useMemo(() => {
    if (!isSearchMode) return rawProducts;
    // Mantiene coincidencias remotas y permite fallback local por contains
    return mergeUniqueById(searchResults, rawProducts);
  }, [isSearchMode, rawProducts, searchResults]);

  const indexedProducts = useMemo(() => {
    return sourceProducts.map((p) => {
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
  }, [sourceProducts]);

  const categories = useMemo(() => {
    const uniques = new Set();
    indexedProducts.forEach((p) => {
      if (p._categoryNorm && p._categoryNorm !== DEFAULT_CATEGORY_LABEL) {
        uniques.add(p._categoryNorm);
      }
    });
    return Array.from(uniques).sort((a, b) => a.localeCompare(b));
  }, [indexedProducts]);

  const products = useMemo(() => {
    const baseList = categoryFilter === 'all'
      ? indexedProducts
      : indexedProducts.filter((p) => p._categoryNorm === categoryFilter);

    if (!normalizedQuery) return baseList;

    const exactBarcodeMatches = baseList.filter((p) => p._barcodeLower === normalizedQuery);
    if (exactBarcodeMatches.length > 0) return exactBarcodeMatches;

    return baseList.filter((p) => p._nameLower.includes(normalizedQuery) || p._barcodeLower.includes(normalizedQuery));
  }, [indexedProducts, normalizedQuery, categoryFilter]);

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

  const refresh = useCallback(async () => {
    setLiveLimit(pageSize);
  }, [pageSize]);

  return {
    products,
    rawProducts,
    loading,
    loadingMore,
    hasMore,
    setQuery,
    clearQuery,
    query,
    categories,
    categoryFilter,
    setCategoryFilter,
    clearFilters,
    getProductByBarcode,
    refresh,
    loadMore,
  };
}
