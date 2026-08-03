import { useCallback, useEffect, useMemo, useState } from 'react';
import { subscribeProducts } from '../../productsNew1/services/productsService';
import { StaffPurchaseItem } from '../types';

export interface CatalogProduct {
  id: string;
  name: string;
  stock: number;
  unitPrice: number;
  category?: string;
}

/** Mismo criterio que la venta rápida: `salePrice` manda, `price` es el respaldo. */
const resolvePrice = (product: any): number => {
  const value = product?.salePrice ?? product?.price;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Catálogo + carrito de la entrega de bodega a un trabajador.
 *
 * Las cantidades viven en un mapa `productId -> cantidad` en vez de un arreglo
 * de líneas: la pantalla necesita saber al instante cuánto lleva un producto
 * para pintar el contador, y con un arreglo habría que recorrerlo en cada fila.
 */
export const useStaffPurchaseCart = () => {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    const unsubscribe = subscribeProducts((items: any[]) => {
      setProducts(
        (items || []).map((p) => ({
          id: p.id,
          name: p.name || 'Producto sin nombre',
          stock: Number(p.stock) || 0,
          unitPrice: resolvePrice(p),
          category: p.category,
        })),
      );
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) => p.name.toLowerCase().includes(term));
  }, [products, search]);

  /** Suma `delta` respetando el stock disponible; nunca baja de cero. */
  const changeQuantity = useCallback((product: CatalogProduct, delta: number) => {
    setQuantities((prev) => {
      const next = (prev[product.id] || 0) + delta;
      if (next <= 0) {
        const rest = { ...prev };
        delete rest[product.id];
        return rest;
      }
      // El tope es el stock real: pedir más de lo que hay solo produciría un
      // error al confirmar, y es mejor no dejar llegar hasta ahí.
      return { ...prev, [product.id]: Math.min(next, product.stock) };
    });
  }, []);

  const clear = useCallback(() => setQuantities({}), []);

  const items: StaffPurchaseItem[] = useMemo(
    () =>
      Object.keys(quantities)
        .map((productId) => {
          const product = products.find((p) => p.id === productId);
          if (!product) return null;
          const quantity = quantities[productId];
          return {
            productId,
            productName: product.name,
            quantity,
            unitPrice: product.unitPrice,
            total: Number((product.unitPrice * quantity).toFixed(2)),
          };
        })
        .filter(Boolean) as StaffPurchaseItem[],
    [quantities, products],
  );

  const total = useMemo(
    () => Number(items.reduce((sum, i) => sum + i.total, 0).toFixed(2)),
    [items],
  );

  const totalUnits = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items],
  );

  return {
    products: filtered,
    loading,
    search,
    setSearch,
    quantities,
    changeQuantity,
    clear,
    items,
    total,
    totalUnits,
  };
};
