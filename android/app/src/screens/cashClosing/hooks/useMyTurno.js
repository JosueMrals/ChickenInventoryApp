import { useEffect, useMemo, useState } from 'react';
import { subscribeMyOpenTurno, subscribeMyUnclaimedCollections, sumCollections } from '../services/cashClosingService';

/** El turno abierto del usuario y lo que lleva cobrado sin reclamar todavía. */
export const useMyTurno = (uid) => {
  const [turno, setTurno] = useState(null);
  const [collections, setCollections] = useState([]);
  const [ready, setReady] = useState({ turno: false, collections: false });

  useEffect(() => {
    if (!uid) return undefined;
    const done = (key) => setReady((prev) => (prev[key] ? prev : { ...prev, [key]: true }));

    const unsubTurno = subscribeMyOpenTurno(uid, (t) => { setTurno(t); done('turno'); });
    const unsubCollections = subscribeMyUnclaimedCollections(uid, (list) => { setCollections(list); done('collections'); });

    return () => { unsubTurno(); unsubCollections(); };
  }, [uid]);

  const total = useMemo(() => sumCollections(collections), [collections]);
  const loading = !uid || !ready.turno || !ready.collections;

  return { turno, collections, total, loading };
};
