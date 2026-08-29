import { useEffect, useMemo, useState } from 'react';
import { subscribeGoodsReceipts } from '../../../services/receptionService';

// Opciones del filtro por tiempo. El corte se calcula contra createdAt en cliente
// (sobre la página ya cargada), evitando índices compuestos extra en Firestore.
export const TIME_FILTERS = [
  { key: 'all', label: 'Todo' },
  { key: 'today', label: 'Hoy' },
  { key: '7d', label: '7 días' },
  { key: '30d', label: '30 días' },
];

// Devuelve el timestamp (millis) mínimo para el filtro dado, o null si es 'all'.
function timeThreshold(key, now = new Date()) {
  if (key === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start.getTime();
  }
  if (key === '7d') return now.getTime() - 7 * 24 * 60 * 60 * 1000;
  if (key === '30d') return now.getTime() - 30 * 24 * 60 * 60 * 1000;
  return null;
}

// Millis de creación de una recepción, tolerante a Timestamp de Firestore,
// número, o pendiente de serverTimestamp (queda como null → se trata como reciente).
function createdMillis(receipt) {
  return receipt?.createdAt?.toMillis?.() ?? (typeof receipt?.createdAt === 'number' ? receipt.createdAt : null);
}

// Suscripción en tiempo real a las recepciones de mercancía.
// Expone filtros en memoria (texto, estado y tiempo) sobre la página ya cargada;
// para el histórico completo se sube `limit`.
export function useGoodsReceipts({ limit = 100 } = {}) {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'completed' | 'voided'
  const [timeFilter, setTimeFilter] = useState('all'); // 'all' | 'today' | '7d' | '30d'

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeGoodsReceipts(
      (docs) => {
        setReceipts(docs);
        setLoading(false);
      },
      { limit }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [limit]);

  // Filtrado por tiempo + estado. Sirve de base tanto para el resumen del periodo
  // como para la lista (que además aplica el texto de búsqueda).
  const byTimeAndStatus = useMemo(() => {
    const threshold = timeThreshold(timeFilter);
    return receipts.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (threshold != null) {
        const millis = createdMillis(r);
        // Sin fecha aún (serverTimestamp pendiente): se considera reciente y pasa.
        if (millis != null && millis < threshold) return false;
      }
      return true;
    });
  }, [receipts, statusFilter, timeFilter]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return byTimeAndStatus;
    return byTimeAndStatus.filter((r) => {
      const haystack = [
        r.supplier,
        r.reference,
        r.notes,
        r.createdBy,
        r.receiptNumber != null ? `#${r.receiptNumber}` : '',
        ...(Array.isArray(r.items) ? r.items.map((i) => i.productName) : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [byTimeAndStatus, search]);

  // Resumen del periodo seleccionado (solo completadas cuentan al inventario).
  // Se calcula sobre tiempo+estado (ignora el buscador) para que refleje "lo que
  // entró en este periodo" de forma estable mientras se escribe una búsqueda.
  const summary = useMemo(() => {
    const completed = byTimeAndStatus.filter((r) => r.status === 'completed');
    return {
      total: byTimeAndStatus.length,
      completedCount: completed.length,
      voidedCount: byTimeAndStatus.length - completed.length,
      totalUnits: completed.reduce((sum, r) => sum + (Number(r.totalUnits) || 0), 0),
      totalCost: completed.reduce((sum, r) => sum + (Number(r.totalCost) || 0), 0),
    };
  }, [byTimeAndStatus]);

  return {
    receipts: filtered,
    allReceipts: receipts,
    loading,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    timeFilter,
    setTimeFilter,
    summary,
  };
}

export default useGoodsReceipts;
