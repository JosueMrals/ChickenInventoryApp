import { useEffect, useState, useRef, useCallback } from 'react';
import { firestore } from '../../../services/firebaseConfig';

export default function useProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef(null);

  useEffect(() => {
    unsubRef.current = firestore()
      .collection('products')
      .orderBy('name', 'asc')
      .onSnapshot(snapshot => {
        const data = snapshot?.docs?.map(d => ({ id: d.id, ...d.data() })) || [];
        setProducts(data);
        setLoading(false);
      }, (err) => {
        console.error('useProducts snapshot error', err);
        setLoading(false);
      });

    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, []);

  const refresh = useCallback(() => {
    // force re-fetch by detaching and re-attaching
    if (unsubRef.current) unsubRef.current();
    setLoading(true);
    unsubRef.current = firestore()
      .collection('products')
      .orderBy('name', 'asc')
      .onSnapshot(snapshot => {
        const data = snapshot?.docs?.map(d => ({ id: d.id, ...d.data() })) || [];
        setProducts(data);
        setLoading(false);
      }, (err) => {
        console.error('useProducts refresh error', err);
        setLoading(false);
      });
  }, []);

  return { products, loading, refresh };
}
