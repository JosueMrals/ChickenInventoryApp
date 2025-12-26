
import { useState, useEffect, useCallback } from 'react';
import {
  getSalesSummaryOptimized,
  getFinancialSummary,
  getActivityFeedPage
} from '../services/reportsService';

export const useReportsData = (dateFrom, dateTo) => {
  const [summary, setSummary] = useState(null);
  const [financial, setFinancial] = useState(null);
  const [operations, setOperations] = useState([]);
  const [cursors, setCursors] = useState({});
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      setOperations([]);
      setCursors({});
      setHasMore(true);

      const [salesData, financialData, activityData] = await Promise.all([
        getSalesSummaryOptimized({ from: dateFrom, to: dateTo }),
        getFinancialSummary({ from: dateFrom, to: dateTo }),
        getActivityFeedPage({ from: dateFrom, to: dateTo, limit: 10 })
      ]);

      setSummary(salesData);
      setFinancial(financialData);
      
      if (activityData.items.length > 0) {
        setOperations(activityData.items);
        setCursors(activityData.cursors);
      } else {
        setOperations([]);
        setHasMore(false);
      }

      setLoading(false);
    };

    loadInitialData();
  }, [dateFrom, dateTo]);

  const loadMoreOperations = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    
    const activityData = await getActivityFeedPage({
      from: dateFrom,
      to: dateTo,
      cursors,
      limit: 10
    });
    
    if (activityData.items.length > 0) {
      setOperations(prev => [...prev, ...activityData.items]);
      setCursors(activityData.cursors);
    } else {
      setHasMore(false);
    }
    
    setLoadingMore(false);
  }, [loadingMore, hasMore, dateFrom, dateTo, cursors]);

  return { summary, financial, operations, loading, loadingMore, loadMoreOperations, hasMore };
};
