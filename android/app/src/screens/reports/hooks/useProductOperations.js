import { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';

function normalizeCategory(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function extractCategory(data = {}) {
  const direct = normalizeCategory(data?.category);
  if (direct) return direct;

  const detailsCategory = normalizeCategory(data?.details?.category);
  if (detailsCategory) return detailsCategory;

  const changedCategory = normalizeCategory(data?.details?.changes?.category?.to);
  if (changedCategory) return changedCategory;

  return '';
}

export const useProductOperations = (dateFrom, dateTo) => {
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    
    let query = db.collection('product_movements').orderBy('timestamp', 'desc');

    if (dateFrom && dateTo) {
      query = query.where('timestamp', '>=', dateFrom).where('timestamp', '<=', dateTo);
    }

    const unsubscribe = query.onSnapshot(
      (snapshot) => {
        const ops = [];
        snapshot.forEach((doc) => {
          const data = doc.data() || {};
          ops.push({
            id: doc.id,
            ...data,
            category: extractCategory(data),
          });
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
