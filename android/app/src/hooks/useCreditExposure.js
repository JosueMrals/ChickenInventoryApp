import { useCallback, useEffect, useRef, useState } from 'react';
import { getCustomerOutstandingCredit } from '../screens/credits/services/creditsService';
import { computeCreditExposure } from '../utils/creditUtils';

/**
 * Disponibilidad de crédito del cliente considerando la deuda que ya tiene.
 *
 * Las tres vías de venta (pre-venta, edición de pre-venta y venta rápida)
 * validaban el límite contra el total de LA VENTA, no contra la exposición
 * acumulada: un cliente podía superar su límite tantas veces como facturas
 * distintas se le hicieran. Este hook centraliza el cálculo para que las tres
 * apliquen la misma regla.
 *
 * `excludeCreditId`: en edición, el crédito de la propia pre-venta ya está en la
 * deuda vigente; sin excluirlo se contaría dos veces.
 *
 * Sin señal el agregado falla y `outstanding` queda en null: la exposición cae
 * al comportamiento anterior (solo el total de la venta) y `verified` sale en
 * false para que la pantalla lo advierta en vez de aparentar un dato que no tiene.
 */
export const useCreditExposure = (customer, saleTotal, { excludeCreditId = null } = {}) => {
  const [outstanding, setOutstanding] = useState(null);
  // Arranca en true cuando hay cliente: hasta que la consulta resuelva NO se sabe
  // si el saldo es 0 o si no se pudo leer. Sin esta distinción, confirmar la venta
  // antes de que resolviera caía en el camino degradado y se saltaba el tope.
  const [loading, setLoading] = useState(!!customer?.id);

  const customerId = customer?.id || null;
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const refresh = useCallback(async () => {
    if (!customerId) {
      setOutstanding(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const value = await getCustomerOutstandingCredit(customerId, { excludeCreditId });
    // La pantalla puede cerrarse (o cambiar de cliente) antes de que resuelva.
    if (!mountedRef.current) return;
    setOutstanding(value);
    setLoading(false);
  }, [customerId, excludeCreditId]);

  // Se recalcula al cambiar de cliente, no en cada tecla del carrito: la deuda
  // vigente no depende del total de la venta.
  useEffect(() => { refresh(); }, [refresh]);

  return {
    ...computeCreditExposure({ customer, outstanding, saleTotal }),
    loading,
    refresh,
  };
};
