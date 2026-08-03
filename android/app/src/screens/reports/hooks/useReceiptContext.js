import { useEffect, useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import { buildUsersByEmailMap } from '../../../utils/userUtils';
import { getTicketCustomizationSettings } from '../../settings/ticketCustomization/ticketCustomizationService';

/**
 * Datos de apoyo del ticket en Reportes: mapa de usuarios (para mostrar el
 * NOMBRE del vendedor/entregador en vez de su correo) y la personalización del
 * ticket (logo de cabecera).
 *
 * Se resuelven una sola vez por sesión y se guardan a nivel de módulo: el ticket
 * de reportes es histórico, así que no necesita un listener en vivo como sí lo
 * usa la pantalla de venta recién hecha. Sin esta caché, abrir cada ticket de la
 * lista releía la colección `users` completa.
 */
let _usersByEmail = null;
let _ticketSettings = null;
let _pending = null;

async function loadReceiptContext() {
  if (_usersByEmail && _ticketSettings) {
    return { usersById: _usersByEmail, ticketSettings: _ticketSettings };
  }
  // Una sola carga en vuelo aunque se abran varios tickets seguidos.
  if (!_pending) {
    _pending = (async () => {
      const [usersSnap, settings] = await Promise.all([
        firestore().collection('users').get().catch(() => null),
        getTicketCustomizationSettings().catch(() => null),
      ]);

      _usersByEmail = usersSnap
        ? buildUsersByEmailMap(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
        : {};
      _ticketSettings = settings || {};
      return { usersById: _usersByEmail, ticketSettings: _ticketSettings };
    })().finally(() => { _pending = null; });
  }
  return _pending;
}

/** Permite refrescar el contexto (p. ej. si se cambia el logo del ticket). */
export const clearReceiptContextCache = () => {
  _usersByEmail = null;
  _ticketSettings = null;
};

export const useReceiptContext = (enabled = true) => {
  const [context, setContext] = useState({ usersById: {}, ticketSettings: null });

  useEffect(() => {
    if (!enabled) return undefined;
    let mounted = true;
    loadReceiptContext()
      .then((c) => { if (mounted) setContext(c); })
      .catch(() => {
        // El ticket se muestra igual: sin el mapa solo se ve el correo en vez
        // del nombre, y sin ajustes no se pinta el logo.
        if (mounted) setContext({ usersById: {}, ticketSettings: null });
      });
    return () => { mounted = false; };
  }, [enabled]);

  return context;
};
