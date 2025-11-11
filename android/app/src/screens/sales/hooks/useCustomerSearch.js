import { useState, useRef, useEffect } from 'react';
import { firestore } from '../../../services/firebaseConfig';

export default function useCustomerSearch() {
  const [customers, setCustomers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [query, setQuery] = useState('');
  const ref = useRef([]);

  useEffect(() => {
    const unsub = firestore()
      .collection('customers')
      .orderBy('firstName', 'asc')
      .onSnapshot(snapshot => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCustomers(data);
        ref.current = data;
      });
    return unsub;
  }, []);

  useEffect(() => {
    if (!query.trim()) return setFiltered([]);
    const lower = query.toLowerCase();
    const results = ref.current.filter(c =>
      `${c.firstName || ''} ${c.lastName || ''} ${c.cedula || ''}`
        .toLowerCase()
        .includes(lower)
    );
    setFiltered(results.slice(0, 20));
  }, [query]);

  return { customers, filtered, query, setQuery };
}
