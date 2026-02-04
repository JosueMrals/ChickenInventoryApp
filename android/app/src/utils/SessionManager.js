// src/utils/SessionManager.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'lastActivity';
const DEFAULT_TIMEOUT_MINUTES = 15;
let writeTimer = null;
const WRITE_DEBOUNCE_MS = 1000; // evita escribir demasiadas veces en storage

export const SessionManager = {
  /**
   * Guarda la hora actual como última actividad.
   * Debounced para evitar muchas escrituras.
   */
  async updateActivity() {
    try {
      const now = Date.now();
      // debounce: si hay un timer, limpia y reprograma
      if (writeTimer) clearTimeout(writeTimer);
      writeTimer = setTimeout(async () => {
        try {
          await AsyncStorage.setItem(SESSION_KEY, String(now));
        } catch (e) {
          console.warn('SessionManager.updateActivity error saving:', e);
        } finally {
          writeTimer = null;
        }
      }, WRITE_DEBOUNCE_MS);
      // Nota: no await aquí (se escribe en el futuro) para no bloquear UI
      return true;
    } catch (err) {
      console.warn('SessionManager.updateActivity error:', err);
      return false;
    }
  },

  /**
   * Revisa si la sesión ha expirado comparando lastActivity con ahora.
   * Si no existe un timestamp guardado asumimos que la sesión sigue activa
   * (esto evita que el usuario sea deslogueado inmediatamente al abrir la app).
   *
   * @param {number} timeoutMinutes (opcional) - override del timeout por defecto
   * @returns {Promise<boolean>}
   */
  async hasSessionExpired(timeoutMinutes = DEFAULT_TIMEOUT_MINUTES) {
    try {
      const saved = await AsyncStorage.getItem(SESSION_KEY);
      if (!saved) {
        // No tenemos registro de actividad: no forzamos logout automático.
        return false;
      }
      const last = parseInt(saved, 10);
      if (Number.isNaN(last)) return false;

      const now = Date.now();
      const diffMinutes = (now - last) / 1000 / 60;
      return diffMinutes >= timeoutMinutes;
    } catch (err) {
      console.warn('SessionManager.hasSessionExpired error:', err);
      // Por seguridad, si falla la lectura no forzamos logout
      return false;
    }
  },

  /**
   * Borra el registro de actividad (por ejemplo al cerrar sesión).
   */
  async clear() {
    try {
      if (writeTimer) {
        clearTimeout(writeTimer);
        writeTimer = null;
      }
      await AsyncStorage.removeItem(SESSION_KEY);
    } catch (err) {
      console.warn('SessionManager.clear error:', err);
    }
  },

  /**
   * Helpers utilitarios:
   * - getLastActivity(): devuelve timestamp o null
   * - touch(): alias sincrónico que intenta actualizar (await)
   */
  async getLastActivity() {
    try {
      const saved = await AsyncStorage.getItem(SESSION_KEY);
      if (!saved) return null;
      const last = parseInt(saved, 10);
      if (Number.isNaN(last)) return null;
      return last;
    } catch (err) {
      console.warn('SessionManager.getLastActivity error:', err);
      return null;
    }
  },

  /**
   * touch: alias para updateActivity que espera la escritura.
   * Útil en puntos críticos (ej. login, logout).
   */
  async touch() {
    try {
      const now = Date.now();
      if (writeTimer) clearTimeout(writeTimer);
      writeTimer = null;
      await AsyncStorage.setItem(SESSION_KEY, String(now));
      return true;
    } catch (err) {
      console.warn('SessionManager.touch error:', err);
      return false;
    }
  },

  /**
   * keepAlive: si tienes un endpoint que mantiene sesión en servidor,
   * puedes implementar aquí el ping. Por defecto solo actualiza timestamp local.
   */
  async keepAlive() {
    // ejemplo: actualizar timestamp local; opcionalmente hacer un ping al servidor
    await SessionManager.touch();
    // si quieres, aquí haces fetch('/auth/keepalive') y controlas tokens.
  },

  // export constants para tests/config
  _internal: {
    SESSION_KEY,
    DEFAULT_TIMEOUT_MINUTES,
  },
};
