import { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';

export const useProductOperations = (dateFrom, dateTo) => {
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    
    let query = db.collection('product_operations').orderBy('timestamp', 'desc');

    if (dateFrom && dateTo) {
      query = query.where('timestamp', '>=', dateFrom).where('timestamp', '<=', dateTo);
    }

    const unsubscribe = query.onSnapshot(
      (snapshot) => {
        const ops = [];
        snapshot.forEach((doc) => {
          ops.push({ id: doc.id, ...doc.data() });
        });
        setOperations(ops);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching product operations:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe(); // Cleanup listener on unmount
  }, [dateFrom, dateTo]);

  return { operations, loading };
};
