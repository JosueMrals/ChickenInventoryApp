import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { db } from '../../../services/firebase'; // ajusta ruta si es necesario
import firestore from '@react-native-firebase/firestore';

/**
 * useProducts
 * - Suscribe en tiempo real a /products ordenado por name
 * - Provee filtrado local por name (parcial, case-insensitive)
 * - getProductByBarcode busca 1 producto exacto por barcode y devuelve el objeto o null
 */
export function useProducts({ pageSize = 200 } = {}) {
  const [rawProducts, setRawProducts] = useState([]); // todos los productos tal como vienen de Firestore
  const [loading, setLoading] = useState(true);
  const [query, setQueryState] = useState('');
  const mountedRef = useRef(true);

  // debounce impl (sin depender de lodash)
  const debounceRef = useRef({ timer: null });
  function setQuery(q) {
    if (debounceRef.current.timer) clearTimeout(debounceRef.current.timer);
    const qStr = typeof q === 'string' ? q : String(q || '');
    debounceRef.current.timer = setTimeout(() => {
      if (mountedRef.current) setQueryState(qStr);
    }, 250);
  }

  function clearQuery() {
    if (debounceRef.current.timer) {
      clearTimeout(debounceRef.current.timer);
      debounceRef.current.timer = null;
    }
    setQueryState('');
  }

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
      if (debounceRef.current.timer) clearTimeout(debounceRef.current.timer);
    };
  }, [pageSize]);

  // filtered products (client-side): by name partial (case-insensitive) or barcode contains
  const products = useMemo(() => {
    if (!query || query.trim() === '') return rawProducts;
    const q = query.trim().toLowerCase();
    // try to match barcode exactly first (barcode often numeric / exact)
    const exactBarcodeMatches = rawProducts.filter(p => (p.barcode || '').toString() === q);
    if (exactBarcodeMatches.length > 0) return exactBarcodeMatches;
    // otherwise partial name or barcode contains
    return rawProducts.filter(p => {
      const name = (p.name || '').toString().toLowerCase();
      const barcode = (p.barcode || '').toString().toLowerCase();
      return name.includes(q) || barcode.includes(q);
    });
  }, [rawProducts, query]);

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
    getProductByBarcode, // devuelve single product o null
    refresh,
    _internal: { query } // expone el query por si necesitas debug
  };
}
