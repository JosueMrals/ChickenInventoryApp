import { useState, useEffect } from 'react';

export function useDashboard() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    // Más adelante puedes cargar ventas u órdenes
    setItems([]);
  }, []);

  return { items };
}
