// src/hooks/useSessionTimeout.js
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { SessionManager } from '../utils/SessionManager';

/**
 * useSessionTimeout(onSessionExpired, options)
 * - onSessionExpired: función que ejecutas para forzar logout / redireccionar a login
 * - options.timeoutMinutes (opcional) -> override del timeout (por defecto 15)
 *
 * Comportamiento:
 * - Al pasar a background guarda la hora (updateActivity)
 * - Al volver a foreground compara la diferencia. Si ha expirado, limpia y llama onSessionExpired()
 * - Previene dobles llamadas y maneja errores silenciosamente
 */
export default function useSessionTimeout(onSessionExpired, options = {}) {
  const appState = useRef(AppState.currentState);
  const calledRef = useRef(false); // evita llamadas dobles a onSessionExpired
  const timeoutMinutes = options.timeoutMinutes ?? undefined;

  useEffect(() => {
    calledRef.current = false;

    const handleChange = async (nextState) => {
      try {
        // Si vamos a background/inactive -> registramos actividad (momento de salida)
        if (nextState.match(/inactive|background/)) {
          // guardamos la hora de salida para calcular tiempo en background
          await SessionManager.updateActivity();
        }

        // Si venimos de background/inactive y entramos a active -> comprobar expiración
        if (appState.current.match(/inactive|background/) && nextState === 'active') {
          // consultamos si la sesión expiró. Si no hay timestamp, asumimos que no expiró.
          const expired = await SessionManager.hasSessionExpired(timeoutMinutes);
          if (expired && !calledRef.current) {
            calledRef.current = true;
            // clear local activity and execute callback
            await SessionManager.clear();
            // llamar el callback en next tick para evitar conflictos en la UI
            setTimeout(() => {
              try {
                onSessionExpired && onSessionExpired();
              } catch (e) {
                console.warn('onSessionExpired handler threw:', e);
              }
            }, 0);
          }
        }
      } catch (err) {
        console.warn('useSessionTimeout handleChange error:', err);
      } finally {
        appState.current = nextState;
      }
    };

    const subscription = AppState.addEventListener ? AppState.addEventListener('change', handleChange) : AppState.addEventListener('change', handleChange);

    return () => {
      // cleanup
      try {
        if (subscription && typeof subscription.remove === 'function') subscription.remove();
        else if (subscription && typeof subscription === 'function') subscription(); // older RN versions
      } catch (e) {
        /* ignore */
      }
    };
  }, [onSessionExpired, timeoutMinutes]);
}
