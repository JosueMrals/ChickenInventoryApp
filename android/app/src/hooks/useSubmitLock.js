import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Bloqueo de doble envío para acciones que escriben en Firestore.
 *
 * `disabled={loading}` NO basta: el prop solo surte efecto tras el re-render, y
 * dos toques rápidos (~50 ms) alcanzan a disparar el handler dos veces antes de
 * que React pinte. El cerrojo vive en un ref, que se actualiza de forma
 * síncrona: el segundo toque encuentra `true` en la misma vuelta del event loop
 * y sale sin ejecutar nada.
 *
 * Uso:
 *   const { submitting, runLocked } = useSubmitLock();
 *   <TouchableOpacity onPress={() => runLocked(handlePay)} disabled={submitting}>
 *
 * `runLocked` devuelve el valor del callback, o `undefined` si estaba bloqueado.
 * El cerrojo se libera al terminar salvo que se pase `keepLockedOnSuccess`, útil
 * cuando la acción navega a otra pantalla y no queremos que el botón reviva.
 */
export function useSubmitLock() {
  const lockRef = useRef(false);
  const mountedRef = useRef(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const release = useCallback(() => {
    lockRef.current = false;
    // Evita el warning de setState sobre un componente desmontado: tras navegar,
    // la pantalla puede haberse ido antes de que resuelva la promesa.
    if (mountedRef.current) setSubmitting(false);
  }, []);

  const runLocked = useCallback(async (action, { keepLockedOnSuccess = false } = {}) => {
    if (lockRef.current) return undefined;   // ← segundo toque: se descarta
    lockRef.current = true;
    if (mountedRef.current) setSubmitting(true);

    try {
      const result = await action();
      if (!keepLockedOnSuccess) release();
      return result;
    } catch (error) {
      release();   // en error siempre se libera, para poder reintentar
      throw error;
    }
  }, [release]);

  return { submitting, runLocked, release };
}

export default useSubmitLock;
