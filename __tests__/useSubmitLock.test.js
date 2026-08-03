/**
 * Regresión: doble toque ejecutaba la acción dos veces (dos preventas, dos
 * ventas rápidas, dos abonos).
 *
 * El caso que `disabled={loading}` NO cubre: los dos taps llegan antes de que
 * React re-renderice, así que ambos leen el estado viejo. Aquí se simula
 * disparando el handler dos veces seguidas SIN esperar el re-render.
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useSubmitLock } from '../android/app/src/hooks/useSubmitLock';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

test('dos toques seguidos ejecutan la acción una sola vez', async () => {
  const { result } = renderHook(() => useSubmitLock());
  const action = jest.fn(() => Promise.resolve('ok'));

  await act(async () => {
    // Ambos taps en la misma vuelta: ni siquiera hubo re-render entre ellos.
    await Promise.all([
      result.current.runLocked(action),
      result.current.runLocked(action),
    ]);
  });

  expect(action).toHaveBeenCalledTimes(1);
});

test('el segundo toque devuelve undefined y no lanza', async () => {
  const { result } = renderHook(() => useSubmitLock());
  const gate = deferred();
  const action = jest.fn(() => gate.promise);

  let first, second;
  await act(async () => {
    first = result.current.runLocked(action);
    second = result.current.runLocked(action);   // bloqueado
    gate.resolve('valor');
    [first, second] = [await first, await second];
  });

  expect(first).toBe('valor');
  expect(second).toBeUndefined();
  expect(action).toHaveBeenCalledTimes(1);
});

test('tras un error el cerrojo se libera y se puede reintentar', async () => {
  const { result } = renderHook(() => useSubmitLock());
  const action = jest.fn()
    .mockRejectedValueOnce(new Error('sin red'))
    .mockResolvedValueOnce('ok');

  await act(async () => {
    await expect(result.current.runLocked(action)).rejects.toThrow('sin red');
  });
  expect(result.current.submitting).toBe(false);

  // El reintento sí debe pasar: el fallo no puede dejar el botón muerto.
  await act(async () => {
    await expect(result.current.runLocked(action)).resolves.toBe('ok');
  });
  expect(action).toHaveBeenCalledTimes(2);
});

test('keepLockedOnSuccess mantiene el bloqueo tras el éxito', async () => {
  const { result } = renderHook(() => useSubmitLock());
  const action = jest.fn(() => Promise.resolve('ok'));

  // Caso real: la acción navega a la pantalla final; el botón no debe revivir
  // durante la transición y permitir un segundo cobro.
  await act(async () => {
    await result.current.runLocked(action, { keepLockedOnSuccess: true });
  });
  expect(result.current.submitting).toBe(true);

  await act(async () => {
    await result.current.runLocked(action);
  });
  expect(action).toHaveBeenCalledTimes(1);
});

test('sin keepLockedOnSuccess se libera y permite una segunda acción legítima', async () => {
  const { result } = renderHook(() => useSubmitLock());
  const action = jest.fn(() => Promise.resolve('ok'));

  await act(async () => { await result.current.runLocked(action); });
  expect(result.current.submitting).toBe(false);

  // Un segundo envío deliberado (no un doble toque) debe funcionar.
  await act(async () => { await result.current.runLocked(action); });
  expect(action).toHaveBeenCalledTimes(2);
});
