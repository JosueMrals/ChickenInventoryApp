import { useEffect, useState } from 'react';
import { subscribePendingReview } from '../services/cashClosingService';

/** Turnos cerrados esperando que el admin los marque completos o con faltante. */
export const usePendingReviews = () => {
  const [closings, setClosings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(
    () => subscribePendingReview((list) => { setClosings(list); setLoading(false); }),
    [],
  );

  return { closings, loading };
};
